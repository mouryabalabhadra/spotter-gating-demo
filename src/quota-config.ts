import {
    SpotterQuotaConfig,
    SpotterQuotaPeriod,
    SpotterQuotaScope,
} from '@thoughtspot/visual-embed-sdk';

/**
 * The demo's own view of the config console state. It is a superset of
 * {@link SpotterQuotaConfig}: everything under `quota` is passed straight to
 * the SDK, while the rest drives the demo chrome (persona selection, event log
 * filtering) and never reaches the embed.
 */
export interface DemoState {
    quota: SpotterQuotaConfig;
    /** Which demo persona is signed in. */
    personaId: string;
    /** Whether the host app considers this user subscribed. */
    subscribed: boolean;
}

export const DEFAULT_WARNING_MESSAGE =
    "You're approaching your question limit. Upgrade to keep asking.";

export const DEFAULT_BLOCKED_MESSAGE =
    "You've used all your questions for this period. Upgrade to continue.";

export const DEFAULT_CTA_LABEL = 'Upgrade plan';

/**
 * The starting upgrade surface: a three-tier plan picker.
 *
 * This is host-supplied markup — ThoughtSpot renders it verbatim (through
 * DOMPurify) instead of its own paywall, so everything it needs travels with
 * it. The demo's stylesheet does not apply, because the content is injected
 * inside the embed's iframe.
 *
 * Every rule is an inline `style` attribute for one reason: DOMPurify's default
 * tag list has no `<style>`, so a stylesheet is dropped and the markup renders
 * as an unstyled bullet list. The `style` attribute does survive.
 *
 * Two things the host cannot do from static markup, by design:
 *   - the "used" figure on the Free card is fixed text, because host HTML has
 *     no binding to the embed's live usage count;
 *   - the buttons are inert, because event handlers are stripped. Wire an
 *     `upgradeUrl`, or listen for SpotterUsageLimitUpgradePlanClicked, to make
 *     an upgrade actually do something.
 *
 * Prices and allowances are invented for the demo.
 */
export const DEFAULT_UPGRADE_CONTENT =
    `<div style="font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#1d1d1f"><h3 style="margin:0 0 4px;font-size:20px;font-weight:600">Upgrade your plan</h3><p style="margin:0 0 18px;color:#55565a">You've used every question in your plan. Pick a plan to keep asking.</p><ul style="display:flex;flex-wrap:wrap;gap:12px;margin:0;padding:0;list-style:none"><li style="flex:1 1 190px;display:flex;flex-direction:column;border:1px solid #e3e4e8;border-radius:10px;padding:16px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#55565a">Free</span></div><div style="display:flex;align-items:center;gap:10px;color:#55565a"><span style="display:inline-block;width:26px;height:26px;border:3px solid #d93025;border-radius:50%"></span><span>Limit reached</span></div><div style="font-size:22px;font-weight:600;margin-top:12px">$0</div><ul style="list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px solid #e3e4e8;color:#3c3d41"><li style="margin-bottom:6px">One data source</li><li style="margin-bottom:6px">Charts and tables</li><li style="margin-bottom:6px">Community support</li></ul><div style="margin-top:auto;padding-top:16px"><span style="display:block;text-align:center;border-radius:8px;padding:11px 12px;font-weight:600;border:1px solid #d7d8dd;color:#9a9ba0">Current plan</span></div></li><li style="flex:1 1 190px;display:flex;flex-direction:column;border:1px solid #2f6bff;border-radius:10px;padding:16px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#55565a">Pro</span><span style="background:#2f6bff;color:#fff;border-radius:999px;padding:3px 9px;font-size:10px;font-weight:600;text-transform:uppercase">Recommended</span></div><div style="font-size:34px;font-weight:600;line-height:1.1">500</div><div style="color:#55565a">questions a month</div><div style="font-size:22px;font-weight:600;margin-top:12px">$40</div><div style="color:#55565a;font-size:13px">per user, per month</div><ul style="list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px solid #e3e4e8;color:#3c3d41"><li style="margin-bottom:6px">Unlimited data sources</li><li style="margin-bottom:6px">Follow-up questions and drilldowns</li><li style="margin-bottom:6px">Scheduled liveboards</li><li style="margin-bottom:6px">Email support</li></ul><div style="margin-top:auto;padding-top:16px"><span style="display:block;text-align:center;border-radius:8px;padding:11px 12px;font-weight:600;border:1px solid #2f6bff;background:#2f6bff;color:#fff">Upgrade to Pro</span></div></li><li style="flex:1 1 190px;display:flex;flex-direction:column;border:1px solid #e3e4e8;border-radius:10px;padding:16px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#55565a">Enterprise</span></div><div style="font-size:34px;font-weight:600;line-height:1.1">Unlimited</div><div style="color:#55565a">questions</div><div style="font-size:22px;font-weight:600;margin-top:12px">Custom</div><ul style="list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px solid #e3e4e8;color:#3c3d41"><li style="margin-bottom:6px">Everything in Pro</li><li style="margin-bottom:6px">SSO and row-level security</li><li style="margin-bottom:6px">Dedicated support</li></ul><div style="margin-top:auto;padding-top:16px"><span style="display:block;text-align:center;border-radius:8px;padding:11px 12px;font-weight:600;border:1px solid #d7d8dd">Contact sales</span></div></li></ul><p style="margin:16px 0 0;color:#9a9ba0;font-size:12px">Demo pricing. No payment is taken and no plan is changed.</p></div>`;

export const DEFAULT_QUOTA: SpotterQuotaConfig = {
    enabled: true,
    scope: SpotterQuotaScope.User,
    limit: 5,
    warningThreshold: 3,
    quotaPeriod: SpotterQuotaPeriod.Monthly,
    upgradeContent: DEFAULT_UPGRADE_CONTENT,
    groupLimits: [
        {
            groupId: 'Free',
            enabled: true,
            limit: 5,
            warningThreshold: 3,
            upgradeUrl: '',
        },
        {
            groupId: 'Pro',
            enabled: true,
            limit: 200,
            warningThreshold: 180,
            upgradeUrl: '',
        },
        {
            groupId: 'Enterprise',
            enabled: true,
            limit: 2000,
            warningThreshold: 1900,
            upgradeUrl: '',
        },
    ],
};

/**
 * Field length caps, mirrored from the design prototype. Enforced in the
 * console so the demo can't produce config the real UI would truncate.
 *
 * `upgradeContent` is sized for a self-contained upgrade surface: the markup
 * renders inside the embed's iframe, so it has to carry its own styles rather
 * than borrow the host page's. The default plan picker alone is ~3.9k.
 */
export const FIELD_LIMITS = {
    upgradeContent: 5000,
    groupId: 40,
} as const;

/**
 * Renders the quota config as the `new SpotterEmbed(...)` call a developer
 * would actually paste into their app.
 *
 * Keys the host left at their default are dropped, so the snippet stays an
 * honest minimal example rather than a dump of every field.
 */
export const buildCodeSnippet = (
    quota: SpotterQuotaConfig,
    modelId: string,
): string => {
    const isGroupScoped = quota.scope === SpotterQuotaScope.Group;
    // Each entry is a complete line including its own trailing comma. Joining
    // with ',' instead would put a comma after `groupLimits: [` too.
    const lines: string[] = [];
    const push = (text: string) => lines.push(`        ${text},`);

    push(`enabled: ${quota.enabled ? 'true' : 'false'}`);
    if (isGroupScoped) push('scope: SpotterQuotaScope.Group');
    if (!isGroupScoped && quota.limit !== undefined) push(`limit: ${quota.limit}`);
    if (!isGroupScoped && quota.warningThreshold !== undefined) {
        push(`warningThreshold: ${quota.warningThreshold}`);
    }
    if (quota.quotaPeriod === SpotterQuotaPeriod.Monthly) {
        push('quotaPeriod: SpotterQuotaPeriod.Monthly');
    }
    if (isGroupScoped && quota.groupLimits?.length) {
        lines.push('        groupLimits: [');
        quota.groupLimits.forEach((group) => {
            const parts = [`groupId: '${group.groupId}'`];
            if (group.limit !== undefined) parts.push(`limit: ${group.limit}`);
            if (group.warningThreshold !== undefined) {
                parts.push(`warningThreshold: ${group.warningThreshold}`);
            }
            if (group.upgradeUrl) parts.push(`upgradeUrl: '${group.upgradeUrl}'`);
            if (group.enabled === false) parts.push('enabled: false');
            lines.push(`            { ${parts.join(', ')} },`);
        });
        lines.push('        ],');
    }
    if (quota.upgradeContent) {
        // The real markup, not an elision, so the snippet is something you can
        // paste and run. It goes inside a template literal, so a backtick or a
        // `${` in the host's HTML would otherwise close the literal early or
        // start an interpolation — escape both, and the backslashes first so
        // the escapes added below are not themselves re-escaped.
        const escaped = quota.upgradeContent
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
        // Emitted verbatim on one line: the value is the string, so wrapping it
        // for readability would put newlines into the markup the host sends.
        lines.push(`        upgradeContent: \`${escaped}\`,`);
    }

    return `import {
    SpotterEmbed, EmbedEvent, HostEvent,
    SpotterQuotaScope, SpotterQuotaPeriod,
} from '@thoughtspot/visual-embed-sdk';

const embed = new SpotterEmbed('#tsEmbed', {
    worksheetId: '${modelId || '<model-guid>'}',
    spotterQuota: {
${lines.join('\n')}
    },
});

embed.on(EmbedEvent.SpotterUsageLimitUpgradePlanClicked, (p) => {
    // p: { usageCount, usageLimit, status }
    openCheckout(p);
});

// After checkout succeeds, lift the gate:
embed.trigger(HostEvent.SetSpotterSubscribed, { subscribed: true });

embed.render();`;
};
