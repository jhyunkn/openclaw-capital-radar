# Homepage Assembly Audit

## Status

The homepage is controlled by a canonical manifest-driven render path:

- `package.json` uses `npm run build:prod` -> `scripts/run-build-pipeline.cjs`.
- `config/build-pipeline.json` final `ship` stage calls `scripts/render-capital-radar-home.cjs`.
- `scripts/render-capital-radar-home.cjs` reads `config/homepage-sections.json`, runs section commands, runs cleanup, validates required sections, and writes `outputs/capital-radar-home-build-report.json`.
- The same canonical build also writes `outputs/operational-chart-validation-report.json`.

The top-level orchestrator is correct. The remaining architecture work is to reduce legacy cleanup dependency and eventually move from chained injectors to registry-driven assembly.

## Current homepage order

The current enabled homepage order is:

1. Market Regime / Decision Brief
2. Operational Chart
3. Cross-Asset Lens
4. Strategy Routing
5. Holdings
6. Opportunity Queue
7. Market Tape
8. Kostolany Egg

Disabled:

- Trust / Data Quality
- Macro Cycle Board

## Modularized visible sections

These sections now have modular renderer paths:

- `components/radar/decision-brief/render.cjs`
- `components/radar/operational-chart/render.cjs`
- `components/radar/market-lens/render.cjs`
- `components/radar/strategy-routing/render.cjs`
- `components/radar/holdings/render.cjs`
- `components/radar/opportunities/render.cjs`
- `components/radar/market-tape/render.cjs`
- `components/radar/kostolany-egg/render.cjs`

## Operational Chart Phase 2 status

Operational Chart Phase 2 is structurally complete.

The Operational Chart renderer now owns:

- chart section rendering
- chart runtime generation
- annotation-state integration
- top decision strip
- primary callout
- side decision rail
- confirmation strip
- workboard layout
- explicit autoscale policy
- scale-authority classification

The active homepage manifest no longer calls these post-render mutation scripts:

- `node scripts/enhance-decision-chart-v2.cjs`
- `node scripts/patch-decision-chart-price-scale.cjs`

The scripts may remain temporarily as rollback/reference artifacts, but they must not be active in `config/homepage-sections.json`.

The canonical homepage build fails if either old chart post-render command reappears in the active manifest.

## Operational Chart validation report

The build now writes:

- `outputs/operational-chart-validation-report.json`

The report checks and records:

- chart container count
- chart runtime count
- annotation layer presence
- decision rail presence
- confirmation strip presence
- autoscale policy presence
- legacy patch residue presence
- scale-affecting items
- scale-neutral items
- warnings
- status

## Cleanup scripts still active

These scripts remain active as legacy guardrails:

- `scripts/strip-legacy-brief-strategy-home.cjs`
- `scripts/strip-visual-regime-home.cjs`
- `scripts/normalize-homepage-sections.cjs`

They are useful during transition, but they should eventually become unnecessary once section assembly becomes fully deterministic.

## Naming debt

The standalone Trust Strip section has been removed. A repository search for active `trust-strip` usage returned no current matches at the time of this update. Do not perform blind renames; only rename confirmed active layout usage.

If future active usage appears, recommended rename:

- `trust-strip` -> `metric-strip`

## Recommended next sequence

### Phase 3 — stabilize and archive

1. Visual QA the Operational Chart on production.
2. Keep old chart post-render scripts as rollback references for one or two stable deployments.
3. Then move them to `scripts/legacy/` or add hard legacy headers if moving files is not worth the churn.

### Phase 4 — reduce cleanup dependency

1. Keep cleanup scripts active while migration continues.
2. Move more duplicate/legacy checks into canonical validation.
3. Remove legacy strip scripts only after repeated successful builds.

### Phase 5 — registry-driven homepage assembly

1. Create a section registry that imports renderers.
2. Assemble the homepage in one deterministic pass.
3. Convert injectors into compatibility wrappers or retire them.

## Architecture target

Final desired state:

- State generators produce validated JSON artifacts.
- Section renderers turn artifacts into HTML/CSS/runtime.
- Thin injectors are temporary compatibility only.
- `render-capital-radar-home.cjs` remains the canonical orchestrator.
- Cleanup scripts become guardrails, not core assembly logic.
- The homepage is rendered once from manifest authority, not assembled through fragile chained mutations.
