/** Runtime config served by the Worker. Mirrors `handleConfig` in worker/index.ts. */
export interface Persona {
    id: string;
    label: string;
    username: string;
    groups?: string[];
    description?: string;
}

export interface DemoConfig {
    thoughtSpotHost: string;
    modelId: string;
    personas: Persona[];
    defaultUsername: string;
    tokenServiceReady: boolean;
}

export const EMPTY_CONFIG: DemoConfig = {
    thoughtSpotHost: '',
    modelId: '',
    personas: [],
    defaultUsername: '',
    tokenServiceReady: false,
};

export const fetchDemoConfig = async (): Promise<DemoConfig> => {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`/api/config returned ${res.status}`);
    return (await res.json()) as DemoConfig;
};

/**
 * Fetches a ThoughtSpot login token for a persona.
 *
 * The Worker returns the token as plain text (what `getAuthToken` must resolve
 * to) and JSON only on failure, so a JSON content-type here always means the
 * request failed and the body carries the reason.
 */
export const fetchAuthToken = async (personaId?: string): Promise<string> => {
    const query = personaId ? `?persona=${encodeURIComponent(personaId)}` : '';
    const res = await fetch(`/api/token${query}`, { method: 'POST' });
    if (!res.ok) {
        let detail = `${res.status}`;
        try {
            const body = (await res.json()) as { error?: string; detail?: string };
            detail = [body.error, body.detail].filter(Boolean).join(' — ') || detail;
        } catch {
            // Non-JSON error body; the status code is all we have.
        }
        throw new Error(`Token request failed: ${detail}`);
    }
    return (await res.text()).trim();
};
