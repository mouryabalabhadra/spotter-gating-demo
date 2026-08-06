/**
 * Cloudflare Worker for the Spotter gating demo.
 *
 * Responsibilities:
 *   GET  /api/config  — non-secret runtime config for the SPA (host, model,
 *                       persona list). Lets the same build point at any
 *                       cluster without a rebuild.
 *   POST /api/token   — mints a short-lived ThoughtSpot login token using the
 *                       trusted-auth secret key. The secret never leaves the
 *                       Worker; the browser only ever sees the token.
 *   everything else   — the built SPA, from the ASSETS binding.
 */

export interface Persona {
	/** Stable id used by the SPA and echoed back on the token request. */
	id: string;
	/** Label shown on the persona chip. */
	label: string;
	/** ThoughtSpot username this persona logs in as. */
	username: string;
	/** ThoughtSpot group names/GUIDs, used for group-scoped quota demos. */
	groups?: string[];
	/** Short line describing the package this persona is on. */
	description?: string;
}

export interface Env {
	ASSETS: Fetcher;
	TS_HOST: string;
	TS_MODEL_ID?: string;
	TS_DEFAULT_USERNAME?: string;
	TS_PERSONAS?: string;
	TS_AUTO_CREATE_USERS?: string;
	/** Trusted-auth secret key. Set with `wrangler secret put TS_SECRET_KEY`. */
	TS_SECRET_KEY?: string;
}

/** Token lifetime. Short on purpose — the SDK refreshes near expiry. */
const TOKEN_VALIDITY_SECONDS = 300;

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});

/**
 * Trailing slashes on the configured host produce `//api/rest/...` paths that
 * some proxies reject, so normalise once here rather than at each call site.
 */
const normaliseHost = (host: string): string => host.trim().replace(/\/+$/, '');

const parsePersonas = (raw: string | undefined): Persona[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// Drop malformed entries rather than failing the whole config request —
		// a typo in one persona shouldn't blank the demo.
		return parsed.filter(
			(p): p is Persona =>
				!!p && typeof p.id === 'string' && typeof p.username === 'string',
		);
	} catch {
		return [];
	}
};

const handleConfig = (env: Env): Response => {
	const personas = parsePersonas(env.TS_PERSONAS);
	return json({
		thoughtSpotHost: normaliseHost(env.TS_HOST ?? ''),
		modelId: env.TS_MODEL_ID ?? '',
		personas,
		defaultUsername: env.TS_DEFAULT_USERNAME ?? personas[0]?.username ?? '',
		// The SPA disables the embed and explains what to configure when this is
		// false, instead of rendering a login-failure iframe.
		tokenServiceReady: !!env.TS_SECRET_KEY && !!env.TS_HOST,
	});
};

const handleToken = async (request: Request, env: Env): Promise<Response> => {
	if (!env.TS_SECRET_KEY) {
		return json(
			{ error: 'TS_SECRET_KEY is not set. Run: wrangler secret put TS_SECRET_KEY' },
			500,
		);
	}
	const host = normaliseHost(env.TS_HOST ?? '');
	if (!host) return json({ error: 'TS_HOST is not set.' }, 500);

	const personas = parsePersonas(env.TS_PERSONAS);
	const url = new URL(request.url);
	const personaId = url.searchParams.get('persona');
	const persona = personas.find((p) => p.id === personaId);

	// A requested-but-unknown persona is a client bug, not a reason to silently
	// hand back a token for somebody else.
	if (personaId && !persona) {
		return json({ error: `Unknown persona '${personaId}'.` }, 400);
	}

	const username = persona?.username ?? env.TS_DEFAULT_USERNAME;
	if (!username) {
		return json(
			{ error: 'No username resolved. Set TS_DEFAULT_USERNAME or TS_PERSONAS.' },
			500,
		);
	}

	const autoCreate = env.TS_AUTO_CREATE_USERS === 'true';
	const body: Record<string, unknown> = {
		username,
		secret_key: env.TS_SECRET_KEY,
		validity_time_in_sec: TOKEN_VALIDITY_SECONDS,
	};
	if (autoCreate) {
		body.auto_create = true;
		body.display_name = persona?.label ?? username;
		if (persona?.groups?.length) body.group_identifiers = persona.groups;
	}

	let upstream: Response;
	try {
		upstream = await fetch(`${host}/api/rest/2.0/auth/token/full`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				// Workers' fetch() sends no User-Agent by default; some clusters'
				// edge WAF 403s requests with none, so set one explicitly.
				'user-agent': 'spotter-gating-demo-worker',
			},
			body: JSON.stringify(body),
		});
	} catch (err) {
		return json({ error: `Could not reach ${host}: ${String(err)}` }, 502);
	}

	if (!upstream.ok) {
		// Forward ThoughtSpot's own message — it names the actual problem
		// (trusted auth off, bad secret, unknown user) far better than we could.
		const detail = await upstream.text();
		return json(
			{ error: `Token request failed (${upstream.status})`, detail },
			upstream.status,
		);
	}

	const data = (await upstream.json()) as { token?: string };
	if (!data.token) return json({ error: 'Token missing from response.' }, 502);

	// Plain text, because that is what `EmbedConfig.getAuthToken` expects to
	// resolve to on the client.
	return new Response(data.token, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store',
		},
	});
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (pathname === '/api/config') return handleConfig(env);
		if (pathname === '/api/token') return handleToken(request, env);

		// Not an API route — let the static asset handler serve the SPA.
		return env.ASSETS.fetch(request);
	},
};
