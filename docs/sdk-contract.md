# SDK ⇄ conv-assist contract for Spotter question gating

Reference notes for PR
[scaligent/66377](https://galaxy.corp.thoughtspot.com/dev/scaligent/pull/66377)
and the matching `visual-embed-sdk` change.

## What the SDK now exposes

Public view config on `SpotterEmbedViewConfig` and `AppViewConfig`:

```ts
spotterQuota?: {
    enabled?: boolean;                    // default false — hosts opt in
    scope?: SpotterQuotaScope;            // User (default) | Group
    limit?: number;
    warningThreshold?: number;            // absolute count, not a percentage
    quotaPeriod?: SpotterQuotaPeriod;     // Total (default) | Monthly
    groupLimits?: SpotterQuotaGroupLimit[];
    upgradeContent?: string;              // host HTML for the upgrade surface
}
```

Events:

| Direction | Name | Wire value | Payload |
| --- | --- | --- | --- |
| app → host | `EmbedEvent.SpotterUsageLimitUpgradePlanClicked` | `spotterUsageLimitUpgradePlanClicked` | `{ usageCount, usageLimit, status }` |
| host → app | `HostEvent.SetSpotterSubscribed` | `SetSpotterSubscribed` | `{ subscribed?: boolean }` |

Types live in `src/types.ts` and are re-exported from `src/embed/conversation.ts`
for discoverability. They are **not** declared in `conversation.ts` directly:
`spotter-utils.ts` needs the enums at runtime, and importing them from
`conversation.ts` creates a module cycle (`spotter-utils → conversation →
spotter-utils`) that rollup warns about.

## How it reaches the app

`buildSpotterQuotaAppInitData` (`src/embed/spotter-utils.ts`) is called from
`SpotterEmbed.getAppInitData()` and `AppEmbed.getAppInitData()`. It flattens the
public config onto the `embedParams` names `useGatedSpotter` already reads:

| `spotterQuota.*` | `embedParams.*` |
| --- | --- |
| `limit` | `noOfAllowedMessages` |
| `warningThreshold` | `almostReachedThreshold` |
| `quotaPeriod === Monthly` | `spotterUsageMonthlyReset` |
| `groupLimits[]` | `spotterUsageLimits[]` (`limit`→`usageLimit`, `warningThreshold`→`almostReachedThreshold`, `upgradeUrl`→`upgradePlanUrl`) |
| `upgradeContent` | `gatedSpotterContent` |

The structured object is also forwarded verbatim as `embedParams.spotterQuota`,
so conv-assist can migrate off the flat names later without another SDK change.

Behaviour worth knowing:

- **`enabled: false` (or absent) emits nothing.** An embed without gating gets a
  byte-for-byte unchanged `APP_INIT` payload.
- **`groupLimits` is dropped unless `scope === Group`.** A stale array left on a
  user-scoped config would otherwise silently beat the top-level `limit`, since
  the app treats a matched group limit as the sole source of truth.
- **An omitted `groupLimits[].enabled` is sent as `true`.** `selectGroupLimit`
  filters on `limit.enabled`, so a missing flag would read as falsy and silently
  exclude the group.
- **`quotaPeriod` is only sent when set.** Absent means Total, which is the
  app's existing default; sending `spotterUsageMonthlyReset: false` explicitly
  would be equivalent but noisier.

## Open items on the conv-assist side

### 1. The demo defaults must go before merge — blocking

`use-gated-spotter.ts`:

```ts
const noOfAllowedMessages = groupLimit ? … : embedConfig?.embedParams?.noOfAllowedMessages ?? 3;
const almostReachedThreshold = groupLimit ? … : embedConfig?.embedParams?.almostReachedThreshold ?? 1;
```

With the SDK gating on `spotterQuota.enabled`, a host that has *not* opted in
sends no `noOfAllowedMessages` at all — and these fallbacks then meter every
embed at three questions. The file's own `TODO: PAYWALL` says as much.

Suggested shape: derive `isEnabled` from the presence of host config rather than
from a defaulted number, e.g.

```ts
const hostLimit = embedConfig?.embedParams?.noOfAllowedMessages;
const isEnabled = !isSubscribed && (!!groupLimit || typeof hostLimit === 'number') && …;
```

### 2. Event wire values must match exactly — verify

`@thoughtspot/embed-util` is a workspace package (`js/ts-packages/embed-util`)
and was not available to check. Confirm:

- `IncomingEventType.SetSpotterSubscribed === 'SetSpotterSubscribed'`
- `EventType.SpotterUsageLimitUpgradePlanClicked === 'spotterUsageLimitUpgradePlanClicked'`

The lower-camel value follows the convention of the other Spotter events added
in SDK 1.52/1.53 (`spotterConversationPinned`, `spotterConversationShared`, …).
If `embed-util` already uses a different casing, change the SDK to match it
rather than the other way round — the SDK value is not yet released.

### 3. `refundQuestion` has no SDK surface — by design, for now

`useGatedSpotter` exposes `refundQuestion()` so a failed send doesn't burn
quota, but nothing outside the app can call it. If hosts need to grant a refund
(e.g. their own API call failed after the question went out), that wants a
`HostEvent.RefundSpotterQuestion`. Deliberately left out until there's a
concrete ask.

### 4. Gating is UI enforcement only

The count lives in the browser's `localStorage`, namespaced per user GUID.
Clearing site data resets it. That is fine for a packaging/upsell motion and
should be stated plainly in the docs; anything with revenue attached needs a
server-side check as well.
