# Homepage Assembly Audit

## Status

The homepage is now controlled by a canonical manifest-driven render path:

- `package.json` uses `npm run build:prod` -> `scripts/run-build-pipeline.cjs`.
- `config/build-pipeline.json` final `ship` stage calls `scripts/render-capital-radar-home.cjs`.
- `scripts/render-capital-radar-home.cjs` reads `config/homepage-sections.json`, runs section commands, runs cleanup, validates required sections, and writes `outputs/capital-radar-home-build-report.json`.

This means the correct next step is not to create a new top-level orchestrator. The next step is to reduce the number of legacy mutation scripts underneath the existing orchestrator.

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

## Modularized sections

These sections now have modular renderers:

- `components/radar/operational-chart/render.cjs`
- `components/radar/strategy-routing/render.cjs`
- `components/radar/holdings/render.cjs`
- `components/radar/opportunities/render.cjs`
- `components/radar/market-tape/render.cjs`
- `components/radar/kostolany-egg/render.cjs`

## Remaining active legacy injectors

These active homepage scripts still mix state loading, HTML rendering, CSS injection, nav mutation, and `index.html` replacement:

- `scripts/inject-market-decision-brief-home.cjs`
- `scripts/inject-market-lens-home.cjs`

They should be migrated next into modular renderers:

- `components/radar/decision-brief/render.cjs`
- `components/radar/market-lens/render.cjs`

## Remaining post-render mutation scripts

Operational Chart is modularized, but two active scripts still mutate the chart after rendering:

- `scripts/enhance-decision-chart-v2.cjs`
- `scripts/patch-decision-chart-price-scale.cjs`

These should be absorbed into `components/radar/operational-chart/render.cjs` so the chart renderer is the single source of truth.

## Cleanup scripts still active

These scripts remain active as legacy guardrails:

- `scripts/strip-legacy-brief-strategy-home.cjs`
- `scripts/strip-visual-regime-home.cjs`
- `scripts/normalize-homepage-sections.cjs`

They are useful during transition, but they should eventually become unnecessary once section assembly becomes fully deterministic.

## Naming debt

The standalone Trust Strip section has been removed, but active modules still use the CSS class `trust-strip` as a generic metric summary layout. This is semantically confusing.

Recommended rename:

- `trust-strip` -> `metric-strip`

Apply this only after confirming visual parity, because Holdings, Opportunity Queue, and Market Tape rely on this shared layout.

## Recommended next sequence

### Phase 1 — finish renderer modularity

1. Modularize Decision Brief.
2. Modularize Cross-Asset Lens.
3. Confirm all enabled visible sections have renderers under `components/radar/*/render.cjs`.

### Phase 2 — absorb chart post-processors

1. Move `enhance-decision-chart-v2.cjs` logic into Operational Chart renderer.
2. Move `patch-decision-chart-price-scale.cjs` logic into Operational Chart runtime generation.
3. Remove those two commands from `homepage-sections.json` once visual parity is confirmed.

### Phase 3 — reduce cleanup dependency

1. Keep cleanup scripts active while migration continues.
2. Add explicit duplicate/legacy validation to `render-capital-radar-home.cjs` if needed.
3. Remove legacy strip scripts only after repeated successful builds.

### Phase 4 — rename metric strip

1. Rename `.trust-strip` to `.metric-strip` in active renderers.
2. Keep a temporary compatibility alias if needed.
3. Remove ambiguity between product section and layout class.

## Architecture target

Final desired state:

- State generators produce validated JSON artifacts.
- Section renderers turn artifacts into HTML/CSS/runtime.
- Thin injectors are temporary compatibility only.
- `render-capital-radar-home.cjs` remains the canonical orchestrator.
- Cleanup scripts become guardrails, not core assembly logic.
- The homepage is rendered once from manifest authority, not assembled through fragile chained mutations.
