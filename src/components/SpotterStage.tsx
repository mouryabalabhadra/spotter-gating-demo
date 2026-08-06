import { SpotterQuotaConfig } from '@thoughtspot/visual-embed-sdk';
import { SpotterEmbed } from '@thoughtspot/visual-embed-sdk/react';
import type { MutableRefObject } from 'react';
import type { DemoConfig, Persona } from '../api';

type EmbedRef = MutableRefObject<InstanceType<typeof import(
    '@thoughtspot/visual-embed-sdk'
).SpotterEmbed> | null>;

interface Props {
    config: DemoConfig;
    persona: Persona | undefined;
    personas: Persona[];
    onSelectPersona: (id: string) => void;
    quota: SpotterQuotaConfig;
    /** Bumped to force a fresh embed when config or persona changes. */
    embedKey: string;
    embedRef: EmbedRef;
    onUpgradeClicked: (payload: unknown) => void;
    onQueryTriggered: (payload: unknown) => void;
    onLoad: () => void;
    onError: (payload: unknown) => void;
    /** True when /api/config could not be fetched at all. */
    configUnreachable: boolean;
    /**
     * True once the SDK has been initialised with the real ThoughtSpot host.
     * The embed reads the SDK's globals as it mounts, so mounting it earlier
     * would bake in whatever host was configured at the time.
     */
    sdkReady: boolean;
}

const Setup = ({
    config,
    unreachable,
}: {
    config: DemoConfig;
    unreachable: boolean;
}) => {
    // A failed /api/config fetch leaves `config` at its empty defaults, which
    // would otherwise render as "TS_HOST is empty" and send you editing a file
    // that is very likely already correct. Say what actually went wrong.
    if (unreachable) {
        return (
            <div className="placeholder">
                <h2>Can&rsquo;t reach the Worker</h2>
                <p>
                    <code>/api/config</code> did not respond, so the demo has no
                    ThoughtSpot host, model or personas to work with. Your{' '}
                    <code>wrangler.jsonc</code> is probably fine &mdash; the API
                    just isn&rsquo;t being served.
                </p>
                <p>
                    Run <code>pnpm preview</code> to serve the SPA and the Worker
                    together on <code>:8787</code>.
                </p>
                <p>
                    Using <code>pnpm dev</code> for hot reload? That serves only
                    the SPA on <code>:5173</code> and proxies{' '}
                    <code>/api</code> to <code>:8787</code>, so you need{' '}
                    <code>npx wrangler dev</code> running alongside it.
                </p>
            </div>
        );
    }

    return (
        <div className="placeholder">
            <h2>Token service not configured</h2>
            <p>
                The Worker reached us, but has no trusted-auth secret key yet, so
                it cannot sign this demo in. Set one and reload:
            </p>
            <p>
                <code>echo &apos;TS_SECRET_KEY=&quot;...&quot;&apos; &gt; .dev.vars</code>{' '}
                for local dev
                <br />
                <code>npx wrangler secret put TS_SECRET_KEY</code> for a deploy
            </p>
            {!config.thoughtSpotHost && (
                <p>
                    <b>TS_HOST is also empty.</b> Point it at your cluster in{' '}
                    <code>wrangler.jsonc</code>, e.g.{' '}
                    <code>https://team2.thoughtspot.cloud</code>.
                </p>
            )}
        </div>
    );
};

export const SpotterStage = ({
    config,
    persona,
    personas,
    onSelectPersona,
    quota,
    embedKey,
    embedRef,
    onUpgradeClicked,
    onQueryTriggered,
    onLoad,
    onError,
    configUnreachable,
    sdkReady,
}: Props) => (
    <section className="stage">
        <div className="stage__bar">
            <div className="stage__bar-label">
                <span className="stage__bar-eyebrow">
                    Demo control · not part of the embed
                </span>
                <span style={{ fontSize: '12.5px', color: 'var(--fg-muted)' }}>
                    {persona?.description ??
                        'Signed-in persona — each maps to a ThoughtSpot user'}
                </span>
            </div>
            <div className="personas">
                {personas.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        className="persona"
                        aria-pressed={option.id === persona?.id}
                        onClick={() => onSelectPersona(option.id)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="browser">
            <div className="browser__chrome">
                <span className="browser__dot" style={{ background: '#FF5F57' }} />
                <span className="browser__dot" style={{ background: '#FEBC2E' }} />
                <span className="browser__dot" style={{ background: '#28C840' }} />
                <div className="browser__url">app.yourproduct.io/analytics</div>
                <span className="browser__tag">embedded SDK</span>
            </div>

            {config.tokenServiceReady && !sdkReady ? (
                <div className="placeholder">
                    <p>Connecting to {config.thoughtSpotHost}&hellip;</p>
                </div>
            ) : config.tokenServiceReady ? (
                <div className="embed-host">
                    <SpotterEmbed
                        key={embedKey}
                        ref={embedRef as never}
                        worksheetId={config.modelId || undefined}
                        spotterQuota={quota}
                        frameParams={{ width: '100%', height: '100%' }}
                        onSpotterUsageLimitUpgradePlanClicked={onUpgradeClicked}
                        onSpotterQueryTriggered={onQueryTriggered}
                        onLoad={onLoad}
                        onError={onError}
                        updatedSpotterChatPrompt
                        showSpotterRadiance
                        spotterSidebarConfig={{
                            enablePastConversationsSidebar: true,
                            spotterSidebarDefaultExpanded: false,
                        }}
                        updatedSpotterExperience
                    />
                </div>
            ) : (
                <Setup config={config} unreachable={configUnreachable} />
            )}
        </div>
    </section>
);
