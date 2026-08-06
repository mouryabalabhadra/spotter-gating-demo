import {
    SpotterQuotaConfig,
    SpotterQuotaGroupLimit,
    SpotterQuotaPeriod,
    SpotterQuotaScope,
} from '@thoughtspot/visual-embed-sdk';
import { FIELD_LIMITS } from '../quota-config';

interface Props {
    quota: SpotterQuotaConfig;
    onChange: (next: SpotterQuotaConfig) => void;
    /** Set when the draft config differs from what the embed is running. */
    dirty: boolean;
    onApply: () => void;
    onReset: () => void;
    /** Validation message, or null when the draft is applyable. */
    error: string | null;
}

const Toggle = ({
    on,
    onClick,
    label,
}: {
    on: boolean;
    onClick: () => void;
    label: string;
}) => (
    <button
        type="button"
        className="toggle"
        aria-pressed={on}
        aria-label={label}
        onClick={onClick}
    >
        <span />
    </button>
);

const Segmented = <T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (next: T) => void;
}) => (
    <div className="seg">
        {options.map((option) => (
            <button
                key={option.value}
                type="button"
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
            >
                {option.label}
            </button>
        ))}
    </div>
);

export const ConfigConsole = ({
    quota,
    onChange,
    dirty,
    onApply,
    onReset,
    error,
}: Props) => {
    const patch = (partial: Partial<SpotterQuotaConfig>) =>
        onChange({ ...quota, ...partial });

    const patchGroup = (index: number, partial: Partial<SpotterQuotaGroupLimit>) => {
        const groupLimits = [...(quota.groupLimits ?? [])];
        groupLimits[index] = { ...groupLimits[index], ...partial };
        onChange({ ...quota, groupLimits });
    };

    const isGroupScoped = quota.scope === SpotterQuotaScope.Group;

    return (
        <aside className="console">
            <div className="console__head">
                <span className="console__dot" />
                <span className="console__sig">
                    new SpotterEmbed({'{ spotterQuota }'})
                </span>
            </div>
            <p className="console__blurb">
                Developer-owned — zero ThoughtSpot admin. Edits here become the
                view config on the live Spotter embed.
            </p>

            <div className="field">
                <div className="row-between">
                    <label className="label" style={{ margin: 0 }}>
                        spotterQuota.enabled
                    </label>
                    <Toggle
                        on={!!quota.enabled}
                        label="Enable question gating"
                        onClick={() => patch({ enabled: !quota.enabled })}
                    />
                </div>
                <p className="hint">
                    Off by default in the SDK. With gating off, no quota params
                    reach the embed and Spotter behaves exactly as it does today.
                </p>
            </div>

            <div className="field">
                <label className="label">scope · pool boundary</label>
                <Segmented
                    value={quota.scope ?? SpotterQuotaScope.User}
                    options={[
                        { value: SpotterQuotaScope.User, label: 'per user' },
                        { value: SpotterQuotaScope.Group, label: 'per group' },
                    ]}
                    onChange={(scope) => patch({ scope })}
                />
                <p className="hint">
                    {isGroupScoped
                        ? 'Each ThoughtSpot group gets its own allowance. A user in several groups gets the least restrictive matching limit.'
                        : 'Every user is metered independently against the limit below.'}
                </p>
            </div>

            {!isGroupScoped && (
                <div className="field field--split">
                    <div>
                        <label className="label">limit</label>
                        <input
                            type="number"
                            min={0}
                            value={quota.limit ?? 0}
                            onChange={(e) =>
                                patch({ limit: Number(e.target.value) })
                            }
                        />
                    </div>
                    <div>
                        <label className="label">warningThreshold</label>
                        <input
                            type="number"
                            min={0}
                            value={quota.warningThreshold ?? 0}
                            onChange={(e) =>
                                patch({ warningThreshold: Number(e.target.value) })
                            }
                        />
                    </div>
                </div>
            )}

            {isGroupScoped && (
                <div className="field">
                    <label className="label">groupLimits · pricing packages</label>
                    {(quota.groupLimits ?? []).map((group, index) => (
                        <div
                            key={`${group.groupId}-${index}`}
                            style={{
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--r-md)',
                                padding: '10px',
                                marginBottom: '8px',
                            }}
                        >
                            <div className="row-between">
                                <input
                                    type="text"
                                    className="mono-input"
                                    value={group.groupId}
                                    maxLength={FIELD_LIMITS.groupId}
                                    onChange={(e) =>
                                        patchGroup(index, { groupId: e.target.value })
                                    }
                                    style={{ fontSize: '12.5px' }}
                                />
                                <Toggle
                                    on={group.enabled !== false}
                                    label={`Enable ${group.groupId} allowance`}
                                    onClick={() =>
                                        patchGroup(index, {
                                            enabled: group.enabled === false,
                                        })
                                    }
                                />
                            </div>
                            <div className="field--split" style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="label">limit</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={group.limit ?? 0}
                                        onChange={(e) =>
                                            patchGroup(index, {
                                                limit: Number(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="label">warn at</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={group.warningThreshold ?? 0}
                                        onChange={(e) =>
                                            patchGroup(index, {
                                                warningThreshold: Number(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            </div>
                            <label className="label" style={{ marginTop: 8 }}>
                                upgradeUrl · optional
                            </label>
                            <input
                                type="url"
                                placeholder="https://example.com/pricing"
                                value={group.upgradeUrl ?? ''}
                                onChange={(e) =>
                                    patchGroup(index, { upgradeUrl: e.target.value })
                                }
                            />
                        </div>
                    ))}
                    <p className="hint">
                        <code>groupId</code> is a ThoughtSpot group name or GUID.
                        Set <code>upgradeUrl</code> to send the CTA to your own
                        pricing page instead of the in-embed surface.
                    </p>
                </div>
            )}

            <div className="note">
                <div className="note__title">Freemium gate</div>
                <p>
                    For a “first N free, then pay” motion, leave{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
                        quotaPeriod
                    </span>{' '}
                    on <b>total</b> and set the limit to the free count — the
                    upgrade content drives the sell. No trial setting needed.
                </p>
            </div>

            <div className="field">
                <label className="label">quotaPeriod · developer-owned reset</label>
                <Segmented
                    value={quota.quotaPeriod ?? SpotterQuotaPeriod.Total}
                    options={[
                        { value: SpotterQuotaPeriod.Total, label: 'total' },
                        { value: SpotterQuotaPeriod.Monthly, label: 'monthly' },
                    ]}
                    onChange={(quotaPeriod) => patch({ quotaPeriod })}
                />
                <p className="hint">
                    {quota.quotaPeriod === SpotterQuotaPeriod.Monthly
                        ? 'Count resets at the start of each calendar month.'
                        : 'Count never resets — only an upgrade lifts the gate.'}
                </p>
            </div>

            <div className="section">
                <label className="label">upgradeContent · host HTML</label>
                <textarea
                    className="code"
                    rows={7}
                    maxLength={FIELD_LIMITS.upgradeContent}
                    value={quota.upgradeContent ?? ''}
                    onChange={(e) => patch({ upgradeContent: e.target.value })}
                />
                <div className="counter">
                    {(quota.upgradeContent ?? '').length} / {FIELD_LIMITS.upgradeContent}
                </div>
                <p className="hint">
                    Rendered inline in the upgrade surface.{' '}
                    <span style={{ color: 'var(--ts-cyan-light)' }}>
                        &lt;script&gt;, event handlers and javascript: URLs are
                        stripped
                    </span>{' '}
                    before render. Leave blank to fall back to the built-in copy.
                </p>
            </div>

            {error && (
                <div className="alert" role="alert">
                    {error}
                </div>
            )}

            <div className="btn-row">
                <button
                    type="button"
                    className="btn btn--primary btn--wide"
                    disabled={!dirty || !!error}
                    onClick={onApply}
                >
                    {dirty ? 'Apply to embed · reloads Spotter' : 'Embed is up to date'}
                </button>
                <button type="button" className="btn" onClick={onReset}>
                    Reset config
                </button>
            </div>
        </aside>
    );
};
