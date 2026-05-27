# Capital Radar Agent Instructions

## Project identity

Capital Radar is a private investment decision-support dashboard operated through OpenClaw and implemented through Codex or direct GitHub edits when Codex is unavailable.

It is not a generic finance blog, not a market-news page, and not a startup landing page. It is a decision surface for converting market evidence into portfolio action states.

## Product architecture

The public homepage is a four-section decision surface:

1. Macro
2. Decision chart
3. Holdings
4. Opportunity

Supporting modules may exist as internal evidence inputs, but they should not return as standalone visible homepage sections unless explicitly approved.

Latent modules should be compressed into the four-section surface:

- Cross-Asset Lens -> Macro confirmation, contradiction, liquidity, and intermarket context.
- Asset Allocation Route -> Macro permission, Holdings sizing posture, Opportunity promotion gate.
- Market Tape -> Macro near-term confirmation or contradiction.
- Kostolany Egg -> Macro cycle regime interpretation, not a standalone diagram.
- Trust / Data Quality -> source authority, freshness, and confidence signals inside each relevant section.
- System Health -> internal edit-readiness artifact unless explicitly surfaced as a small status badge.

## Investment analysis standard

Do not provide generic market commentary. All ticker, sector, or portfolio analysis should be structured as decision support:

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

Allowed final action states:

- Watch
- Probe
- Add
- Hold
- Trim
- Exit

A research candidate is not a buy recommendation. A visible opportunity must show what would promote it, what would invalidate it, and what evidence is missing.

## Repository model

This is a Node-generated static dashboard. Do not assume this is a normal React app.

Canonical concepts:

- `config/homepage-sections.json` controls homepage section policy.
- `config/build-pipeline.json` controls the staged production pipeline.
- `scripts/render-capital-radar-home.cjs` is the canonical homepage render orchestrator.
- Section renderers live under `components/radar/`.
- Generated state and reports live under `outputs/`.
- Packaged static output lives under `public/`.

## Build commands

Use the narrowest verification command that matches the mission.

For UI-only homepage refinements:

```bash
npm run build:fast
```

For data/research artifact refresh:

```bash
npm run refresh:data
```

For validation-only work:

```bash
npm run validate:lane
```

For production-grade confidence:

```bash
npm run build:prod
```

For homepage registry preview checks:

```bash
npm run preview:homepage-registry:strict
```

Do not claim deployment or production success unless Vercel/GitHub deployment status has been checked separately.

## Change discipline

Default to the smallest safe change.

Before editing code, classify the mission:

- INTEL: market/ticker research only.
- DASHBOARD: visible web/UI refinement.
- PIPELINE: data, state, scripts, validation, or build system.
- VERIFY: read/run/report only.
- DOCTRINE: repo rules and operating documents.
- ARCHIVE: changelog, roadmap, or decision memory.

Do not mix INTEL, DASHBOARD, PIPELINE, and DEPLOYMENT work in the same change unless explicitly approved.

## Four-section rule

Do not add visible standalone homepage sections.

If a disabled module is needed, integrate its decision value into one of the four sections:

- Macro: regime, liquidity, cycle, confirmation, contradiction, permission.
- Decision chart: price zones, technical confirmation, support/resistance, invalidation.
- Holdings: current positions, thesis status, zone logic, sizing, invalidation.
- Opportunity: asymmetric candidates, promotion gates, evidence gaps, near-misses.

A module can return only if it answers:

> Does this make the user more capable of deciding Watch / Probe / Add / Hold / Trim / Exit?

If not, keep it internal.

## Forbidden behaviors

- Do not add generic financial disclaimers as filler.
- Do not turn candidates into recommendations without action-state logic.
- Do not create new visible homepage sections by default.
- Do not bypass `config/homepage-sections.json` for homepage architecture.
- Do not edit generated artifacts unless the mission explicitly requires generated output changes.
- Do not perform broad visual redesigns while solving data or pipeline issues.
- Do not remove validators to make a build pass.
- Do not claim deployment success without external verification.

## Completion report

Every mission should report:

1. Mission type
2. Files changed
3. What changed
4. Verification run
5. Result
6. Remaining risk
7. Whether follow-up archive/doctrine updates are needed
