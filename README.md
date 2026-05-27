# OpenClaw Capital Radar

Capital Radar is a private investment decision-support dashboard operated through OpenClaw and implemented through Codex or direct GitHub edits when Codex is unavailable.

It is designed to convert market evidence into disciplined portfolio action states:

- Watch
- Probe
- Add
- Hold
- Trim
- Exit

Capital Radar is not a generic finance blog, market-news feed, or startup landing page. It is a decision cockpit.

## Homepage architecture

The public homepage is a four-section decision surface:

1. Macro
2. Decision chart
3. Holdings
4. Opportunity

Supporting modules may exist as internal evidence inputs, but they should not return as standalone visible sections unless explicitly approved.

Disabled modules are not considered unnecessary. They are latent evidence modules that must be compressed into the mission of the four-section surface before returning visibly.

Current reintegration logic:

- Cross-Asset Lens -> Macro confirmation / contradiction / liquidity context.
- Asset Allocation Route -> Macro permission, Holdings sizing implication, Opportunity promotion gate.
- Market Tape -> Macro near-term confirmation / contradiction.
- Kostolany Egg -> Macro cycle regime interpretation.
- Trust / Data Quality -> source authority / freshness / confidence inside relevant sections.
- System Health -> internal edit-readiness unless explicitly surfaced as a small status badge.

## Repository model

This is a Node-generated static dashboard, not a standard React application.

Core files and directories:

- `AGENTS.md` — repo-native instructions for OpenClaw / Codex / direct edits.
- `config/homepage-sections.json` — homepage section policy and section command manifest.
- `config/build-pipeline.json` — staged production build pipeline.
- `scripts/render-capital-radar-home.cjs` — canonical homepage render orchestrator.
- `components/radar/` — modular section renderers.
- `data/` — report and market state inputs.
- `outputs/` — generated artifacts, reports, state, and previews.
- `public/` — static output for deployment.
- `docs/` — operating doctrine, workflow, audits, and reintegration plans.

## Build and verification commands

Use the narrowest verification command that fits the mission.

### UI-only homepage refinement

```bash
npm run build:fast
```

Fast build renders from existing artifacts, validates operational sections, and packages static output. It does not refresh live market data or replace the full production pipeline.

### Data / research refresh

```bash
npm run refresh:data
```

### Validation lane

```bash
npm run validate:lane
```

### Full production pipeline

```bash
npm run build:prod
```

### Homepage registry preview

```bash
npm run preview:homepage-registry:strict
```

### Build lane list

```bash
npm run lane:list
```

## Mission types

Every OpenClaw/Codex/direct-edit task should be classified before execution:

- INTEL — market, ticker, sector, portfolio, or macro research.
- DASHBOARD — visible web/UI refinement.
- PIPELINE — data, state, scripts, validators, or build system.
- VERIFY — inspect, run, compare, and report without edits.
- DOCTRINE — operating rules and repo documentation.
- ARCHIVE — record what changed, why it changed, and what should be remembered.

See `docs/OPENCLAW_MISSION_TYPES.md`.

## Capital Radar research standard

Market and ticker analysis should follow this structure:

1. Market regime
2. Liquidity condition
3. Sector/theme rotation
4. Ticker-specific thesis
5. Valuation/expectation gap
6. Entry timing
7. Invalidation signal
8. Position-sizing logic
9. Risk scenario
10. Final action state

No generic market commentary.

## Module reintegration rule

A disabled module can return only if it answers at least one of these:

1. Does it change the action state?
2. Does it change position size?
3. Does it change invalidation?
4. Does it change entry timing?
5. Does it reveal evidence quality or missing evidence?
6. Does it identify confirmation or contradiction?

If not, it remains internal evidence.

See `docs/MODULE_REINTEGRATION_MAP.md`.

## Workflow when Codex is unavailable

Do not attempt large rewrites manually.

Recommended sequence:

1. Create or update a GitHub issue as the control map.
2. Update doctrine before implementation.
3. Create a narrow branch.
4. Change one file or one module at a time.
5. Use existing verification scripts where possible.
6. Archive the result.

See `docs/NO_CODEX_WORKFLOW.md`.

## Deployment note

Do not claim production success from a local or repository edit alone.

Deployment success requires checking the deployment system separately and confirming production is ready.

## Operating law

No visible element belongs on Capital Radar unless it improves decision quality.

Evidence is allowed only when it changes permission, sizing, invalidation, timing, confidence, or action state.
