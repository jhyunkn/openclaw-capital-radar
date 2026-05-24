# Homepage Registry Readiness Audit

## Status

This audit maps the current homepage assembly path before a registry-driven rewrite.

The current system is stable enough to begin registry planning, but not ready for an immediate full replacement. The homepage is still assembled through a manifest-driven sequence of state generators, HTML injectors, cleanup scripts, and validation.

## Current canonical path

Production build path:

1. `package.json`
2. `npm run build:prod`
3. `scripts/run-build-pipeline.cjs`
4. `config/build-pipeline.json`
5. final ship stage: `scripts/render-capital-radar-home.cjs`
6. homepage manifest: `config/homepage-sections.json`

`render-capital-radar-home.cjs` is the current canonical orchestrator.

## Active section inventory

### 1. Decision Brief / Market Regime

Manifest section:

- `decision-brief-section`

State generators:

- `scripts/generate-operational-chart-state.cjs`
- `scripts/generate-confirmation-state.cjs`
- `scripts/generate-market-decision-brief-state.cjs`

Injector:

- `scripts/inject-market-decision-brief-home-modular.cjs`

Renderer:

- `components/radar/decision-brief/render.cjs`

Registry readiness:

- High.
- Already modular enough to be called by a future registry.

### 2. Operational Chart / Market Regime Map

Manifest section:

- `operational-chart-section`

State generators:

- `scripts/generate-operational-chart-state.cjs`
- `scripts/generate-decision-chart-annotation-state.cjs`

Injector:

- `scripts/inject-operational-chart-home.cjs`

Renderer:

- `components/radar/operational-chart/render.cjs`

Validation/reporting:

- `outputs/operational-chart-validation-report.json`
- chart validation inside `scripts/render-capital-radar-home.cjs`

Registry readiness:

- High after Phase 2.
- Renderer owns annotation composition and autoscale policy.
- Injector is now thin enough to become a compatibility wrapper.

### 3. Cross-Asset Lens

Manifest section:

- `market-lens-section`

State generator:

- `scripts/generate-market-lens-state.cjs`

Injector:

- `scripts/inject-market-lens-home-modular.cjs`

Renderer:

- `components/radar/market-lens/render.cjs`

Registry readiness:

- High.

### 4. Asset Allocation Route

Manifest section:

- `strategy-routing-section`

State generator:

- `scripts/generate-strategy-routing-state.cjs`

Injector:

- `scripts/inject-strategy-routing-home-modular.cjs`

Renderer:

- `components/radar/strategy-routing/render.cjs`

Registry readiness:

- High.

### 5. Holdings Translation

Manifest section:

- `holdings-section`

State and enrichment commands:

- `scripts/generate-research-universe-state.cjs`
- `scripts/run-research-collectors-safe.cjs`
- `scripts/generate-institutional-source-states.cjs`
- `scripts/generate-holding-zone-state.cjs`
- `scripts/annotate-holding-zone-source.cjs`
- `scripts/apply-strategy-route-to-holdings.cjs`
- `scripts/validate-holding-zone-state.cjs`

Injector:

- `scripts/inject-holdings-home-modular.cjs`

Post-injection cleanup:

- `scripts/strip-holdings-role-method-home.cjs`

Renderer:

- `components/radar/holdings/render.cjs`

Registry readiness:

- Medium.
- Renderer is modular, but the section still has a post-injection cleanup step.
- Before registry migration, determine whether `strip-holdings-role-method-home.cjs` is still necessary or should become renderer-owned formatting.

### 6. Opportunity Queue

Manifest section:

- `opportunities-section`

State and refinement commands:

- `scripts/generate-opportunity-band-state.cjs`
- `scripts/refine-opportunity-asymmetry-filter.cjs`
- `scripts/apply-strategy-route-to-opportunities.cjs`
- `scripts/enrich-opportunity-near-miss-diagnostics.cjs`

Injector:

- `scripts/inject-opportunities-home-modular.cjs`

Renderer:

- `components/radar/opportunities/render.cjs`

Registry readiness:

- Medium-high.
- The section is modular, but its state pipeline has several refinement passes.
- Registry should call only after state has been fully resolved.

### 7. Market Tape

Manifest section:

- `market-section`

State generator:

- `scripts/generate-market-tape-state.cjs`

Injector:

- `scripts/inject-market-tape-home-modular.cjs`

Renderer:

- `components/radar/market-tape/render.cjs`

Registry readiness:

- Medium.
- Manifest currently labels this as a temporary compatibility surface.
- Decide whether Market Tape remains part of the target homepage before registry rewrite.

### 8. Kostolany Egg Diagram

Manifest section:

- `kostolany-egg-section`

State generators:

- `scripts/generate-operational-chart-state.cjs`
- `scripts/generate-confirmation-state.cjs`
- `scripts/generate-market-lens-state.cjs`
- `scripts/generate-strategy-routing-state.cjs`
- `scripts/generate-trust-strip-state.cjs`
- `scripts/generate-macro-cycle-state.cjs`
- `scripts/generate-kostolany-egg-state.cjs`

Injector:

- `scripts/inject-kostolany-egg-v3-home.cjs`

Renderer:

- `components/radar/kostolany-egg/render.cjs`

Registry readiness:

- Medium.
- Renderer is modular, but this section currently depends on several upstream states, including compatibility trust/macro state generation.

## Active cleanup inventory

### `scripts/strip-legacy-brief-strategy-home.cjs`

Status:

- Active.
- Instrumented.
- Current observed report: `NOOP`, 0 bytes removed, 0 operations.

Report:

- `outputs/homepage-legacy-strip-report.json`

Main build report integration:

- `outputs/capital-radar-home-build-report.json` now references the strip report and summarizes its status.

Registry readiness implication:

- Keep active for one more meaningful homepage deployment.
- If repeated `NOOP`, disable from active cleanup and keep as legacy guardrail.

### `scripts/normalize-homepage-sections.cjs`

Status:

- Active.
- Still useful.

Reason:

- Chained injectors can still create duplicate sections or nav links.
- Registry-driven assembly should eventually make this script unnecessary.

Registry readiness implication:

- Keep active until the registry assembles sections in a single deterministic pass.

### Removed active cleanup

`node scripts/strip-visual-regime-home.cjs` has been removed from active cleanup.

Its protection moved into canonical validation.

## Current validation inventory

Validation currently checks:

- banned active chart commands do not reappear
- required active sections exist exactly once
- legacy section IDs are absent
- banned legacy phrases are absent
- legacy visual-regime selectors are absent
- `[object Object]` does not leak into homepage
- Operational Decision Chart exists
- Market Decision Brief exists
- Operational Chart container/runtime/annotation/autoscale report is valid

## Registry target model

The target registry architecture should be:

```txt
state generators -> validated JSON artifacts
section registry -> calls renderers in approved order
renderers -> return section HTML/CSS/runtime
single homepage assembly pass -> writes index.html
validation -> rejects malformed output
cleanup scripts -> legacy rollback tools only
```

## Proposed registry shape

A future registry file could look like:

```js
module.exports = [
  {
    id: 'decision-brief-section',
    name: 'Market Regime',
    stateFiles: [
      'outputs/market-decision-brief-state.json',
      'outputs/confirmation-state.json'
    ],
    renderer: require('../components/radar/decision-brief/render.cjs'),
    required: true
  },
  {
    id: 'operational-chart-section',
    name: 'Market Regime Map',
    stateFiles: [
      'outputs/operational-chart-state.json',
      'outputs/decision-chart-annotation-state.json'
    ],
    renderer: require('../components/radar/operational-chart/render.cjs'),
    required: true
  }
]
```

The registry should not initially own state generation. State generation can remain manifest-driven until section assembly is deterministic.

## Migration sequence

### Phase R1 — observation and guardrails

Completed / in progress:

- strip report instrumented
- strip report referenced in main build report
- strip report printed in build logs
- visual-regime cleanup removed from active cleanup
- chart post-render scripts marked legacy/disabled

### Phase R2 — registry-readiness cleanup

Next candidates:

1. Observe one more `NOOP` strip report after a meaningful homepage change.
2. Disable `strip-legacy-brief-strategy-home.cjs` from active cleanup if still `NOOP`.
3. Audit `strip-holdings-role-method-home.cjs` and move its responsibility into the Holdings renderer if safe.
4. Keep `normalize-homepage-sections.cjs` active.

### Phase R3 — section registry prototype

Build a non-authoritative prototype:

- `scripts/homepage-section-registry.cjs`
- `scripts/render-homepage-from-registry.preview.cjs`
- output: `outputs/homepage-registry-preview.html`

This must not replace `index.html` yet.

Purpose:

- prove renderers can assemble in one pass
- compare preview against current homepage
- surface missing renderer contracts before touching production

### Phase R4 — production registry migration

Only after preview parity:

- switch `render-capital-radar-home.cjs` from chained injectors to registry assembly
- keep old injectors as compatibility wrappers for one stable period
- remove cleanup dependency after validation proves parity

## Immediate next recommendation

The next implementation after this audit should be:

1. Verify the build-log line:
   - `Legacy strip report: NOOP; 0 bytes removed; 0 operations; retirement_signal=...`
2. Audit `strip-holdings-role-method-home.cjs`.
3. If that script is cosmetic-only, move its behavior into `components/radar/holdings/render.cjs`.

Do not begin the full registry rewrite until the Holdings post-injection cleanup is resolved or explicitly accepted as a known compatibility exception.
