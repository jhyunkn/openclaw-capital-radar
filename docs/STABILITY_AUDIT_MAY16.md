# Stability Audit — May 16

## Scope

Foundation inspection only. No design changes and no feature additions.

Production URL:

- https://openclaw-capital-radar.vercel.app/

Live footer observed by user:

- `build: 0995053`

## Executive finding

The current production site is operationally stable enough to preserve, but the repository is not fully development-stable. The most important issue is divergence between live production and `main`: live production is at `0995053`, while `main` contains later commits that did not deploy because Vercel hit a build-rate limit.

## Phase 1 — Repository state

### Findings

- Live production build: `0995053a5eb02ab17a387e6a03e2111809d38c04`.
- `main` is ahead of live by two commits:
  - `8fee1aa86b8f0b6d89fa0df6784d47468e684c3d` — Add static build health page generator.
  - `1a72695622036c267ee9c11bdb6130760fbebc5c` — Wire build health page into production build.
- The later Vercel deployment failed due account/project build-rate-limit, not a confirmed code error.
- Existing branches observed:
  - `main`
  - `preflight/thesis`
  - `vercel/vercel-speed-insights-to-proje-ulwox1`
  - `stability-audit-may16`

### Fix applied

- On `stability-audit-may16`, removed `scripts/build-health-page.cjs` from `build:prod` to align the audit branch with the live-proven production pipeline.

## Phase 2 — Build health

### Findings

- Direct clean local build could not be executed through the current connector/tool surface.
- `package.json` has no configured linter or typechecker script.
- `build:prod` remains a long shell chain of Node scripts. This is functional but fragile because one script failure blocks the whole build and makes root-cause isolation difficult.
- No package dependency inventory could be produced without local checkout execution.

### Structural issue

The build is still a script chain rather than an orchestrated build graph with named phases and isolated diagnostics.

## Phase 3 — Deployment health

### Findings

- Live production footer indicates `0995053`.
- GitHub/Vercel status for `0995053` is successful.
- Later commit `1a72695` failed because Vercel returned a build-rate-limit URL.
- Full Vercel build logs are not accessible through the current connector authorization for the project scope.
- Environment variable verification could not be completed because Vercel project settings/logs are not accessible.

### Risk

Vercel build-rate-limit makes deployment verification unreliable until cleared or testing is moved to GitHub Actions.

## Phase 4 — Data pipeline integrity

### Findings

- Yahoo Finance and FRED fetch success in production could not be verified from build logs due Vercel access limitation.
- Existing system has previously shown real data in production, but this audit cannot certify freshness without logs or live output fetch access.
- Data pipeline failure mode remains a high-priority audit item: missing env vars or failed fetches must not leave UI in indefinite loading states.

## Phase 5 — Report generation integrity

### Findings

- `/outputs/live-capital-radar.md` could not be fetched through the available web tool during this audit.
- Expected schedule is 8:30 AM ET, but schedule execution and freshness could not be verified without deployment logs or output access.

### Risk

The report may be operationally present but cannot be certified fresh from available connector evidence.

## Phase 6 — Error handling audit

### Findings

- GitHub connector search did not return direct matches for `Loading`, `console.log`, or `catch`; this search is not a full grep and should not be treated as exhaustive.
- Known architectural risk remains: many generated pages are modified by post-build injectors. Regex-based or broad HTML mutation can create silent rendering regressions.
- Fetch timeout audit could not be completed without full codebase grep/local execution.

## Phase 7 — Client-side health

### Findings

- Browser console, network tab, Lighthouse, and mobile viewport inspection could not be executed through the current tool surface.
- User-confirmed footer shows `0995053`, so the page is loading at least to footer render.
- Internal anchors were not independently verified in browser.

## Phase 8 — Security and secrets

### Findings

- No evidence of committed API keys was found in the inspected snippets.
- `.env` / `.gitignore` verification was not completed in this pass.
- Client-side secret exposure could not be fully certified without full codebase grep.

## Phase 9 — Dependency health

### Findings

- `npm outdated` and `npm audit` could not be run through the current connector/tool surface.
- No dependency age/security conclusion can be made from available evidence.

## Issues fixed in this audit branch

| Commit | Fix | Reason |
|---|---|---|
| `afa19781343c22c83eaf55d304e67220e8eda5a4` | Removed unverified build-health page generation from `build:prod` on audit branch | Align production build path with live-proven `0995053` pipeline and avoid deploying unverified code during stability audit. |

## Issues found but not fixed

| Severity | Issue | Recommended action |
|---|---|---|
| Critical | Live production and `main` diverged after Vercel build-rate-limit failure | Do not treat latest `main` as deployed. Clear Vercel limit or use GitHub Actions as the preflight/deploy gate. |
| High | Vercel logs and env vars are not accessible through current authorization | Reauthorize Vercel connector for `jhyunkns-projects` or manually export last five deployment logs. |
| High | No confirmed clean local build in this audit | Add GitHub Actions workflow for `npm run build:prod` on pull requests/branches. |
| High | Thesis Dossier / Research Evidence remain experimental and not production-proven | Keep excluded from `build:prod` until preflight and isolated deploy pass. |
| Medium | Build command is a long serial shell chain | Replace with a build orchestrator script that logs phase names, timings, and failures. |
| Medium | Homepage hierarchy and ticker workbenches still depend on multiple post-build injectors | Move composition into source builders before adding new modules. |
| Medium | No linter/typechecker configured | Add only after stabilizing build graph; do not add dependencies during this audit. |
| Medium | Data freshness cannot be certified from current access | Add generated freshness metadata and expose it in `outputs/build-manifest.json`. |
| Low | Stale branch `vercel/vercel-speed-insights-to-proje-ulwox1` exists | Review and delete if no longer needed. |

## Single most important next action

Create a CI build gate on GitHub Actions that runs `npm run build:prod` and `npm run preflight:thesis` on `stability-audit-may16` and future feature branches before anything is allowed into production.

## Stability grade

FRAGILE — production itself is currently working, but the repo is not yet structurally reliable enough for new analytical modules because live/main divergence, limited deploy logs, and unproven experimental scripts remain unresolved.
