import {
    AuthType,
    HostEvent,
    SpotterQuotaConfig,
    SpotterQuotaScope,
} from '@thoughtspot/visual-embed-sdk';
import { useInit } from '@thoughtspot/visual-embed-sdk/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DemoConfig, EMPTY_CONFIG, fetchAuthToken, fetchDemoConfig } from './api';
import { ConfigConsole } from './components/ConfigConsole';
import { DemoEvent, EventStream } from './components/EventStream';
import { SpotterStage } from './components/SpotterStage';
import { buildCodeSnippet, DEFAULT_QUOTA } from './quota-config';

const TsMark = ({ size = 30, fill = '#04D1FF' }: { size?: number; fill?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <g fill={fill}>
            <rect x="3" y="3" width="18" height="3" rx="1" />
            <rect x="5.4" y="7" width="2.6" height="10" />
            <rect x="10.7" y="7" width="2.6" height="10" />
            <rect x="16" y="7" width="2.6" height="10" />
            <rect x="3" y="18" width="18" height="3" rx="1" />
        </g>
    </svg>
);

/**
 * Rejects config the embed would silently misinterpret, so the demo fails loud
 * at the console rather than quietly rendering a gate that never fires.
 */
const validate = (quota: SpotterQuotaConfig): string | null => {
    if (!quota.enabled) return null;
    if (quota.scope === SpotterQuotaScope.Group) {
        const groups = quota.groupLimits ?? [];
        if (groups.length === 0) return 'Group scope needs at least one group allowance.';
        const blank = groups.findIndex((g) => !g.groupId.trim());
        if (blank >= 0) return `Group #${blank + 1} needs a groupId.`;
        const bad = groups.find(
            (g) =>
                g.enabled !== false &&
                (g.warningThreshold ?? 0) > 0 &&
                (g.limit ?? 0) > 0 &&
                (g.warningThreshold as number) >= (g.limit as number),
        );
        if (bad) {
            return `'${bad.groupId}' warns at or past its limit — the warning would never show.`;
        }
        return null;
    }
    if ((quota.limit ?? 0) <= 0) return 'Set a limit above 0, or turn gating off.';
    if (
        (quota.warningThreshold ?? 0) > 0 &&
        (quota.warningThreshold as number) >= (quota.limit as number)
    ) {
        return 'warningThreshold is at or past the limit — the warning would never show.';
    }
    return null;
};

const stamp = () =>
    new Date().toLocaleTimeString('en-GB', { hour12: false });

/**
 * Runs the SDK's `init()`, and nothing else.
 *
 * It lives in its own component so it can be mounted *only* once the real
 * ThoughtSpot host is known, which neither obvious alternative allows:
 *   - falling back to `window.location.origin` points the SDK at this app, and
 *     a deployed Worker answers unknown paths with index.html
 *     (`not_found_handling: single-page-application`), so the demo loads itself
 *     into its own iframe, recursively;
 *   - passing an empty host throws "Error parsing ThoughtSpot host".
 *
 * `onReady` fires after init() has run so the caller can hold the embed back a
 * render: React runs child effects before parent ones, so an embed rendered in
 * the same pass would read the SDK's globals before init() had set them.
 */
const SdkInit = ({
    host,
    getAuthToken,
    onReady,
}: {
    host: string;
    getAuthToken: () => Promise<string>;
    onReady: () => void;
}) => {
    useInit({
        thoughtSpotHost: host,
        // Cookieless keeps persona switching clean: no ThoughtSpot session
        // cookie survives the switch, so each persona really is a fresh user.
        authType: AuthType.TrustedAuthTokenCookieless,
        getAuthToken,
        autoLogin: true,
    });
    useEffect(() => onReady(), [host, onReady]);
    return null;
};

export const App = () => {
    const [config, setConfig] = useState<DemoConfig>(EMPTY_CONFIG);
    const [configError, setConfigError] = useState<string | null>(null);
    const [personaId, setPersonaId] = useState<string>('');

    // `draft` is what the console edits; `applied` is what the embed runs.
    // Splitting them keeps every keystroke from tearing down the iframe.
    const [draft, setDraft] = useState<SpotterQuotaConfig>(DEFAULT_QUOTA);
    const [applied, setApplied] = useState<SpotterQuotaConfig>(DEFAULT_QUOTA);

    const [events, setEvents] = useState<DemoEvent[]>([]);
    const [subscribed, setSubscribed] = useState(false);
    const [askCount, setAskCount] = useState(0);
    const eventId = useRef(0);
    const embedRef = useRef<never>(null);

    // The token callback is registered once with the SDK, so it reads the
    // persona and the readiness flag through refs rather than closing over
    // stale state.
    const personaRef = useRef<string>('');
    personaRef.current = personaId;
    const readyRef = useRef(false);
    readyRef.current = config.tokenServiceReady;

    const log = useCallback(
        (label: string, detail: string, tone: DemoEvent['tone'] = 'info') => {
            eventId.current += 1;
            const entry: DemoEvent = {
                id: eventId.current,
                time: stamp(),
                label,
                detail,
                tone,
            };
            // Cap the log so a long demo session can't grow the DOM unbounded.
            setEvents((prev) => [...prev, entry].slice(-60));
        },
        [],
    );

    useEffect(() => {
        fetchDemoConfig()
            .then((next) => {
                setConfig(next);
                setPersonaId(next.personas[0]?.id ?? '');
            })
            .catch((err: Error) => setConfigError(err.message));
    }, []);

    const getAuthToken = useCallback(async () => {
        // The SDK asks for a token as soon as init() runs, before the operator
        // has necessarily configured the secret. Fail locally instead of firing
        // a request that can only 500 and filling the log with noise.
        if (!readyRef.current) {
            throw new Error('Token service not configured');
        }
        try {
            return await fetchAuthToken(personaRef.current || undefined);
        } catch (err) {
            log('auth.error', (err as Error).message, 'block');
            throw err;
        }
    }, [log]);

    // Flipped by SdkInit once init() has actually run. The embed reads the
    // SDK's globals as it mounts, so it must not mount before then.
    const [sdkReady, setSdkReady] = useState(false);
    const handleSdkReady = useCallback(() => setSdkReady(true), []);

    const persona = useMemo(
        () => config.personas.find((p) => p.id === personaId),
        [config.personas, personaId],
    );

    const validationError = useMemo(() => validate(draft), [draft]);
    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(applied),
        [draft, applied],
    );

    // Remount the embed when the applied config or the signed-in persona
    // changes; both need a fresh iframe and a fresh APP_INIT payload.
    const embedKey = useMemo(
        () => `${personaId}::${JSON.stringify(applied)}`,
        [personaId, applied],
    );

    const handleApply = useCallback(() => {
        setApplied(draft);
        setAskCount(0);
        log('config.apply', `limit ${draft.limit ?? '—'} · reloading embed`, 'host');
    }, [draft, log]);

    const handleResetConfig = useCallback(() => {
        setDraft(DEFAULT_QUOTA);
        log('config.reset', 'restored demo defaults', 'host');
    }, [log]);

    const handleSelectPersona = useCallback(
        (id: string) => {
            setPersonaId(id);
            setAskCount(0);
            setSubscribed(false);
            const next = config.personas.find((p) => p.id === id);
            log('persona.switch', next ? `${next.label} (${next.username})` : id, 'host');
        },
        [config.personas, log],
    );

    const setSubscription = useCallback(
        (next: boolean) => {
            const embed = embedRef.current as
                | { trigger: (event: HostEvent, payload: unknown) => unknown }
                | null;
            if (!embed) {
                log('host.error', 'embed not ready yet', 'block');
                return;
            }
            embed.trigger(HostEvent.SetSpotterSubscribed, { subscribed: next });
            setSubscribed(next);
            if (next) setAskCount(0);
            log(
                'HostEvent.SetSpotterSubscribed',
                `{ subscribed: ${next} }`,
                'host',
            );
        },
        [log],
    );

    /**
     * Puts the embed's own question count back to zero so the gate can be
     * demoed again without a new user or a new month.
     *
     * The count lives in the embed's localStorage, under the ThoughtSpot
     * origin, so the host page cannot clear it directly — it has to ask the
     * embed. `ResetSpotterUsage` does exactly that and leaves the subscription
     * state alone.
     *
     * The SetSpotterSubscribed pair behind it is a compatibility fallback for
     * clusters that predate ResetSpotterUsage and would otherwise ignore it:
     * marking the user subscribed zeroes the count as part of honouring the
     * upgrade, and clearing the flag puts the gate straight back. Both paths
     * land on "unsubscribed, count 0", so running both is harmless. Drop the
     * fallback once every cluster this demo points at understands the event.
     */
    const resetUsage = useCallback(() => {
        const embed = embedRef.current as
            | { trigger: (event: HostEvent, payload?: unknown) => unknown }
            | null;
        if (!embed) {
            log('host.error', 'embed not ready yet', 'block');
            return;
        }
        // Looked up rather than referenced directly: the vendored SDK branch
        // predates this event, so `HostEvent.ResetSpotterUsage` would not
        // compile. Reading it off the enum keeps the demo building against both
        // the current branch and a newer SDK that has it, and skips the trigger
        // when it is absent — the fallback below is what resets on those builds.
        const resetEvent = (HostEvent as Record<string, string>)
            .ResetSpotterUsage;
        if (resetEvent) embed.trigger(resetEvent as HostEvent);
        // Fallback — see above. Order matters: `true` is what zeroes the count,
        // `false` puts the gate back.
        embed.trigger(HostEvent.SetSpotterSubscribed, { subscribed: true });
        embed.trigger(HostEvent.SetSpotterSubscribed, { subscribed: false });
        setSubscribed(false);
        setAskCount(0);
        log('HostEvent.ResetSpotterUsage', 'question count back to 0', 'host');
    }, [log]);

    const onUpgradeClicked = useCallback(
        (payload: unknown) => {
            log(
                'SpotterUsageLimitUpgradePlanClicked',
                JSON.stringify(payload ?? {}),
                'block',
            );
        },
        [log],
    );

    const onQueryTriggered = useCallback(
        (payload: unknown) => {
            setAskCount((prev) => prev + 1);
            const query =
                (payload as { data?: { query?: string } } | undefined)?.data?.query ?? '';
            log('SpotterQueryTriggered', query ? `"${query}"` : 'question sent', 'info');
        },
        [log],
    );

    const onLoad = useCallback(() => log('Load', 'embed ready', 'info'), [log]);

    const onError = useCallback(
        (payload: unknown) => log('Error', JSON.stringify(payload ?? {}), 'block'),
        [log],
    );

    const snippet = useMemo(
        () => buildCodeSnippet(applied, config.modelId),
        [applied, config.modelId],
    );

    const limitForPersona = applied.limit ?? 0;
    const remaining = subscribed
        ? '∞'
        : String(Math.max(0, limitForPersona - askCount));

    return (
        <div className="shell">
            <header className="masthead">
                <div className="masthead__brand">
                    <TsMark />
                    <div>
                        <div className="eyebrow">ThoughtSpot · Spotter Embed SDK</div>
                        <div className="masthead__title">
                            Question gating &amp; pricing packages
                        </div>
                    </div>
                </div>
                <span className="pill">Product demo</span>
            </header>

            {configError && (
                <div className="alert" role="alert" style={{ marginBottom: 16 }}>
                    Could not load /api/config — {configError}
                </div>
            )}

            <div className="columns">
                <ConfigConsole
                    quota={draft}
                    onChange={setDraft}
                    dirty={dirty}
                    onApply={handleApply}
                    onReset={handleResetConfig}
                    error={validationError}
                />

                {/* Rendered before the stage so its effect — and therefore
                    init() — runs before the embed mounts. */}
                {config.thoughtSpotHost && (
                    <SdkInit
                        host={config.thoughtSpotHost}
                        getAuthToken={getAuthToken}
                        onReady={handleSdkReady}
                    />
                )}

                <SpotterStage
                    config={config}
                    persona={persona}
                    personas={config.personas}
                    onSelectPersona={handleSelectPersona}
                    quota={applied}
                    embedKey={embedKey}
                    embedRef={embedRef}
                    onUpgradeClicked={onUpgradeClicked}
                    onQueryTriggered={onQueryTriggered}
                    onLoad={onLoad}
                    onError={onError}
                    configUnreachable={configError !== null}
                    sdkReady={sdkReady}
                />

                <aside className="console" style={{ maxWidth: 412 }}>
                    <div className="console__head">
                        <span className="console__dot" />
                        <span className="console__sig">host app · entitlement</span>
                    </div>
                    <p className="console__blurb">
                        What your application does around the embed. Gating is
                        advisory UI — your backend stays the source of truth.
                    </p>

                    <div className="field field--split">
                        <div>
                            <label className="label">questions asked</label>
                            <div className="mono-input" style={{ fontSize: 22 }}>
                                {askCount}
                            </div>
                        </div>
                        <div>
                            <label className="label">remaining</label>
                            <div className="mono-input" style={{ fontSize: 22 }}>
                                {remaining}
                            </div>
                        </div>
                    </div>
                    <p className="hint" style={{ marginBottom: 14 }}>
                        Counted host-side from{' '}
                        <code>EmbedEvent.SpotterQueryTriggered</code>. The embed
                        keeps its own authoritative count.
                    </p>

                    <div className="btn-row" style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            className="btn btn--primary btn--wide"
                            onClick={() => setSubscription(true)}
                            disabled={subscribed}
                        >
                            Simulate successful upgrade
                        </button>
                        <button
                            type="button"
                            className="btn btn--wide"
                            onClick={() => setSubscription(false)}
                            disabled={!subscribed}
                        >
                            Simulate subscription lapse
                        </button>
                        <button
                            type="button"
                            className="btn btn--wide"
                            onClick={resetUsage}
                            title="Zero the embed's stored question count so the gate can be demoed again"
                        >
                            Reset usage count
                        </button>
                    </div>
                    <p className="hint" style={{ marginTop: -6, marginBottom: 16 }}>
                        Reset clears the count the embed keeps in its own
                        storage, so you can walk into the paywall again without
                        a new user or a new month.
                    </p>

                    <label className="label">live config</label>
                    <pre className="snippet">{snippet}</pre>

                    <label className="label">SDK event stream</label>
                    <EventStream events={events} />

                    <button
                        type="button"
                        className="btn"
                        style={{ width: '100%' }}
                        onClick={() => setEvents([])}
                    >
                        Clear log
                    </button>
                </aside>
            </div>
        </div>
    );
};
