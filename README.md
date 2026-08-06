# Spotter question gating — product demo

An interactive demo of **host-owned question gating and pricing packages** for
embedded ThoughtSpot Spotter. A developer-facing config console on the left
drives a real `SpotterEmbed` on the right, so you can show a prospect the exact
`spotterQuota` view config that produces the behaviour they're watching.

Deploys to Cloudflare Workers, same shape as `thoughtspot-mcp-server`: a Vite
React SPA served from the `ASSETS` binding, plus a small Worker that mints
ThoughtSpot login tokens so the trusted-auth secret never reaches the browser.

## What it demonstrates

| Surface | SDK API |
| --- | --- |
| Per-user allowance | `spotterQuota.limit` / `warningThreshold` |
| Per-package allowance | `spotterQuota.scope: Group` + `groupLimits[]` |
| Freemium vs monthly reset | `spotterQuota.quotaPeriod` |
| Custom upgrade surface | `spotterQuota.upgradeContent` (host HTML) |
| Upgrade CTA clicked | `EmbedEvent.SpotterUsageLimitUpgradePlanClicked` |
| Lift the gate after checkout | `HostEvent.SetSpotterSubscribed` |

None of it requires ThoughtSpot admin configuration — that is the point of the
demo.

## Prerequisites

1. **A local build of the embed SDK.** This app depends on
   `file:../visual-embed-sdk`, because `spotterQuota` is not in a published
   release yet.

   ```bash
   cd ../visual-embed-sdk
   npm install
   npm run build          # produces lib/ and dist/
   ```

2. **Trusted authentication enabled** on your cluster, with a secret key from
   **Develop → Customizations → Security Settings**.

3. A **Spotter-enabled model** (worksheet) GUID.

## Setup

```bash
npm install
```

Edit `wrangler.jsonc` → `vars`:

```jsonc
"TS_HOST": "https://your-instance.thoughtspot.cloud",
"TS_MODEL_ID": "<model-guid>",
"TS_AUTO_CREATE_USERS": "false",
"TS_PERSONAS": "[{\"id\":\"free\",\"label\":\"Free\",\"username\":\"demo_free\",\"groups\":[\"Free\"],\"description\":\"Free package — 5 questions/month\"},{\"id\":\"pro\",\"label\":\"Pro\",\"username\":\"demo_pro\",\"groups\":[\"Pro\"],\"description\":\"Pro package — 200 questions/month\"}]"
```

Then set the secret (never put this in `wrangler.jsonc`):

```bash
npx wrangler secret put TS_SECRET_KEY
```

For local development, put it in `.dev.vars` instead — see `.dev.vars.example`.

### Personas

Each persona is one ThoughtSpot user. Switching personas in the UI re-mints a
token for that user, so a group-scoped quota really does resolve differently
per persona. Set `TS_AUTO_CREATE_USERS` to `"true"` to just-in-time provision
the persona users and their group membership on first token request; leave it
`"false"` if the users already exist.

## Run

```bash
npm run preview     # builds, then serves the real Worker on :8787
```

or, for fast SPA iteration with hot reload:

```bash
npx wrangler dev    # terminal 1 — the API on :8787
npm run dev         # terminal 2 — Vite on :5173, proxying /api to :8787
```

## Deploy

```bash
npm run deploy
```

## How it hangs together

```
browser ──/api/config──▶ Worker ──▶ (non-secret runtime config)
browser ──/api/token───▶ Worker ──▶ POST {TS_HOST}/api/rest/2.0/auth/token/full
                                     { username, secret_key }
        ◀── plain-text login token ──┘

<SpotterEmbed spotterQuota={...} />  ──▶  APP_INIT payload  ──▶  conv-assist
```

The SDK translates the public `spotterQuota` object into the flat `embedParams`
keys the embedded Spotter app reads (`noOfAllowedMessages`,
`almostReachedThreshold`, `spotterUsageLimits`, `spotterUsageMonthlyReset`,
`gatedSpotterContent`) — see `buildSpotterQuotaAppInitData` in
`visual-embed-sdk/src/embed/spotter-utils.ts`.

## Notes and limitations

- **Applying config reloads the embed.** `spotterQuota` is delivered in the
  `APP_INIT` payload, so it is read once per iframe. The console stages edits
  and applies them on a button press rather than on every keystroke.
- **The host-side counter is a mirror, not the source of truth.** It counts
  `SpotterQueryTriggered` events. The embed keeps its own count, persisted per
  user in `localStorage`.
- **Gating is UI enforcement.** It stops a user asking more questions in this
  surface; it is not a server-side quota. Enforce entitlement in your backend
  too if that matters commercially.
