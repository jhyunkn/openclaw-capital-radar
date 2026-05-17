# Capital Radar Stabilization Plan

This repository is currently treated as a production dashboard with experimental analytical modules staged behind explicit build scripts.

## Production rule

The production build must remain boring and deployable.

If a module has not survived a Vercel deployment, it must not be included in `npm run build`.

## Current production build

Production uses:

```bash
npm run build
```

which delegates to:

```bash
npm run build:prod
```

`build:prod` includes only the currently deployable dashboard layers:

- report validation
- current review generation
- agent notes seeding
- holding page generation
- signal scorecards
- agent intelligence
- chart cognition
- static homepage build
- portfolio scoreboard
- action proximity
- strategy interpretations
- portfolio exposure map
- research candidate map / opportunity scout
- system quality score generation and public removal
- strategy command
- strategy cards
- safe homepage information hierarchy guide
- strategy interpreter workbenches
- chart-first workbenches
- proportion tuning
- production validations
- build version injection
- home runtime stripping
- Vercel output build
- public asset copy

## Experimental modules

These scripts exist but are not wired into production:

```bash
npm run build:experimental:thesis
npm run build:experimental:evidence
npm run build:experimental:all
```

### Thesis Dossier

Purpose:

- business model interpretation
- portfolio role
- base / bull / bear cases
- valuation question
- technical question
- trim / exit conditions
- data gaps

Status:

- conceptually valuable
- currently unstable in Vercel production build
- must be debugged outside production build
- direct production graduation attempt failed at commit `14ecbabab1a1c4eb96b08ebed15cc3da27262bd7`
- do not re-add `generate-thesis-dossiers.cjs` to `build:prod` until the script is proven through a non-production preflight or Vercel build logs identify and resolve the failure

### Research Evidence Engine

Purpose:

- evidence summary
- source list
- freshness timestamp
- valuation snapshot
- earnings / catalyst calendar
- macro sensitivity
- data confidence
- unresolved questions

Status:

- conceptually valuable
- depends on thesis and derived strategy outputs
- not production-wired until thesis path is stable

## Known failed graduation attempts

| Commit | Module | Result | Interpretation |
|---|---|---|---|
| `14ecbabab1a1c4eb96b08ebed15cc3da27262bd7` | Thesis Dossier JSON generation in `build:prod` | Vercel failure | The generator itself is not production-safe or has an environment/runtime assumption that fails on Vercel. |

## Stabilization principles

1. Do not mutate generated HTML with broad regex section extraction.
2. Prefer source builders over post-build injectors.
3. If an injector is necessary, use marker comments and idempotent insertion.
4. Production validation should check deploy-critical invariants only.
5. Analytical quality validation can exist, but should not block production until the module is proven.
6. Every production deploy must update the footer build hash.
7. Failed Vercel deploy means the module is not live, regardless of GitHub commit state.
8. Homepage hierarchy should eventually be implemented in the homepage source builder, not as post-build HTML surgery.
9. Ticker workbench sections should eventually be composed from one ticker page builder, not many independent injectors.
10. Experimental modules should graduate only after one successful deploy in isolation.

## Graduation checklist for experimental modules

A module can move from experimental to production only when:

- it runs locally or in CI without throwing
- it is idempotent
- it does not duplicate CSS repeatedly
- it does not remove unrelated sections
- it has minimal deploy-safe validation
- it survives one Vercel deployment by itself
- the footer build hash confirms it is live

## Current next stabilization work

1. Keep production on `build:prod`.
2. Confirm the footer updates after this stabilization commit.
3. Add a build manifest JSON describing included/excluded modules.
4. Refactor homepage hierarchy into `build-static-home.cjs` when ready.
5. Refactor ticker workbench composition into a single builder before reintroducing Thesis Dossier and Research Evidence Engine.
