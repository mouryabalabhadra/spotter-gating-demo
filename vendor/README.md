# Vendored Visual Embed SDK

`spotterQuota` question gating is not on a published release of
`@thoughtspot/visual-embed-sdk`, so this demo builds against a tarball of the
branch instead of a registry version.

| | |
|---|---|
| Source | https://github.com/thoughtspot/visual-embed-sdk |
| Branch | `spotter-question-gating` |
| Commit | `d86b44d` — *SCAL-XXXXXX: Add host-owned Spotter question gating to the embed SDK* |
| Version in tarball | `1.51.0` (the branch's `package.json`; **not** the published 1.51.0) |

## Why a tarball rather than a git dependency

A `github:` dependency does not work here. The branch ships source only —
`lib/`, `dist/` and `cjs/` are gitignored — while `package.json` `exports`
resolves to `./lib/src/index.js`. npm and pnpm build git dependencies by
running a `prepare` script, and this package has none (only `prepublishOnly`,
which git installs skip). Installing straight from the branch therefore yields
a package with no entry point.

Cloudflare builds this repo from GitHub, so the SDK has to be obtainable from
the repo alone — hence a committed tarball. Note the SDK is a **build-time**
dependency only: Vite bundles it into `dist/`, and `worker/index.ts` imports
nothing, so nothing needs it at runtime.

## Refreshing it

```bash
git clone --depth 1 --branch spotter-question-gating \
  https://github.com/thoughtspot/visual-embed-sdk.git sdk-src
cd sdk-src
printf 'registry=https://registry.npmjs.org/\n' > .npmrc   # see ../.npmrc
npm ci --legacy-peer-deps        # plain `npm ci` fails on a rollup peer conflict
npm run tsc                      # lib/ + cjs/
npm run build                    # dist/
npm pack --pack-destination ../vendor
```

Rename the result to include the commit, update the `file:` path in
`package.json`, then `pnpm install` to refresh the lockfile.
