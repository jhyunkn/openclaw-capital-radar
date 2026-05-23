# Operational Chart Intelligence Plan

## Purpose

The Operational Chart must become a richer decision surface, not a simpler chart. Refactoring toward a single chart renderer is intended to protect intelligence, not remove it.

Single source of truth means:

- The chart has one governed composition layer.
- Every price series, annotation, callout, overlay, and scale rule is intentionally registered.
- No hidden post-render script rewrites chart behavior after the chart is already rendered.
- Complex intelligence is folded into the renderer through explicit contracts, not fragile string patches.

## Non-goals

This refactor must not:

- Remove annotation intelligence.
- Flatten the chart into a basic price chart.
- Delete scenario, macro, liquidity, volatility, or confirmation context.
- Reduce the chart to only candles and moving averages.
- Hide complexity merely to make the renderer shorter.

The target is a more intelligent chart with stronger governance.

## Current issue

The chart currently has a modular renderer, but two post-render mutation scripts still modify the chart after rendering:

- `scripts/enhance-decision-chart-v2.cjs`
- `scripts/patch-decision-chart-price-scale.cjs`

This creates a fragile chain:

1. Render chart.
2. Inject enhancement shell.
3. Patch runtime behavior.
4. Patch autoscale behavior.
5. Hope later annotations do not conflict.

That is acceptable as a transitional bridge, but not as the long-term architecture for an intelligent decision chart.

## Desired model

The chart should be treated as an intelligence engine with explicit layers.

### 1. Price layer

Owns:

- SPX candles
- Moving averages
- Current price marker
- Time scale
- Crosshair behavior

Scale authority:

- This layer is allowed to affect the main price scale.

### 2. Action-zone layer

Owns:

- Add zone
- Hold-above line
- Trim zone
- Defense-below line
- Hard-risk line
- Target line

Scale authority:

- This layer is allowed to affect the price scale because these levels are actionable.

### 3. Scenario layer

Owns:

- Bull/base/correction scenario values
- Scenario triggers
- Projected paths if/when enabled

Scale authority:

- Scenario cards are always safe.
- Scenario path lines must be explicitly marked as either:
  - `scale_affecting: false`, preferred default
  - `scale_affecting: true`, only when validated and bounded

Scenario overlays should not accidentally force the price axis to zero or distort the working range.

### 4. Annotation layer

Owns:

- Event markers
- Macro callouts
- Liquidity callouts
- Volatility warnings
- Fed/rates annotations
- Earnings or sector-rotation markers if added later

Scale authority:

- Annotation markers are visual/contextual by default.
- They should not affect price scale unless explicitly promoted to an actionable level.

### 5. Decision rail layer

Owns:

- Primary callout
- Secondary callouts
- Distance-from-now calculations
- Trigger text
- Rule text

Scale authority:

- No scale authority. This is interpretation, not plotted price authority.

### 6. Confirmation strip layer

Owns:

- RSI/MACD/VIX confirmation
- Breadth or liquidity confirmation if added later
- Risk-on/risk-off state
- Supportive/mixed/defensive labels

Scale authority:

- No scale authority.

### 7. Data-quality and source-confidence layer

Owns:

- Freshness labels
- Real/estimated/projected tags
- Source authority tier
- Confidence warnings
- Missing-data fallback warnings

Scale authority:

- No scale authority.

## Renderer contract

`components/radar/operational-chart/render.cjs` should eventually own these functions or equivalent modules:

- `buildChartPayload(state, annotationState)`
- `buildAutoscalePolicy(payload)`
- `buildAnnotationPolicy(payload)`
- `renderOperationalChartSection(state, annotationState)`
- `renderChartShell(state, annotationState)`
- `renderChartRuntime(payload)`
- `renderDecisionTopStrip(annotationState)`
- `renderDecisionRail(annotationState)`
- `renderConfirmationStrip(annotationState)`
- `renderLevelCards(state)`
- `renderScenarioCards(state)`

The chart renderer should be allowed to accept multiple validated state artifacts, rather than pretending the chart only receives one state file.

## State inputs

The intelligent chart may read from:

- `outputs/operational-chart-state.json`
- `outputs/decision-chart-annotation-state.json`
- future macro/liquidity/volatility annotation states

The injector should remain thin:

- load required states
- check render permissions
- call renderer
- insert section
- insert style
- write `index.html`

The injector should not decide how the chart intelligence works.

## Autoscale policy

The renderer must distinguish chart elements by scale authority.

### Allowed to affect scale

- candle OHLC range
- current price
- moving averages
- add zone
- trim zone
- hold-above level
- defense-below level
- hard-risk level
- target level

### Not allowed to affect scale by default

- volume bars
- decorative scenario paths
- unbounded projection lines
- annotation markers
- macro labels
- callout rails
- confirmation strips

### Rule

Anything projected or decorative must opt into scale authority. It should not get it by default.

## Migration plan

### Step 1 — Preserve behavior

Before deleting any post-processor, map its behavior.

`enhance-decision-chart-v2.cjs` currently contributes:

- top decision strip
- decision workboard wrapper
- primary callout
- side rail callouts
- confirmation strip
- chart height/layout adjustment

`patch-decision-chart-price-scale.cjs` currently contributes:

- removal of volume from main price pane
- removal of scenario path lines from main price pane
- autoscale clamp to actionable SPX levels
- protection against scenario artifacts distorting the axis

None of these behaviors should be lost.

### Step 2 — Fold enhancement into renderer

Move the top strip, rail, and confirmation strip into `renderOperationalChartSection` and related helper functions.

The renderer should read `decision-chart-annotation-state.json` directly or receive it from the injector.

### Step 3 — Fold scale protection into runtime

Move the autoscale protection logic into `renderChartRuntime` / `buildAutoscalePolicy`.

Do not use string patching after render.

### Step 4 — Remove post-render commands

Only after visual parity and deployment success:

- remove `node scripts/enhance-decision-chart-v2.cjs` from `homepage-sections.json`
- remove `node scripts/patch-decision-chart-price-scale.cjs` from `homepage-sections.json`

Keep the old files temporarily as rollback references.

### Step 5 — Add validation

Add a validator that checks:

- chart section exists exactly once
- decision rail exists when annotation state is permitted
- confirmation strip exists when annotation state is permitted
- no scenario path is allowed to affect scale unless explicitly marked
- no `[object Object]` leaks
- no duplicate chart runtime blocks

## Design principle

The Operational Chart is the highest-value decision surface in Capital Radar.

It should behave like an institutional decision cockpit:

- price shows where the market is
- bands show what to do
- annotations explain why
- rails show what would change the decision
- confirmation strips show whether the evidence agrees
- autoscale policy prevents intelligence overlays from corrupting readability

The chart should become more complex in intelligence, but more disciplined in assembly.
