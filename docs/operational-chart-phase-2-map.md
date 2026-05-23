# Operational Chart Phase 2 — Global Refactor Map

## Position

Phase 2 should be treated as a coordinated Operational Chart architecture change, not a sequence of unrelated cosmetic patches.

The goal is not to simplify the chart. The goal is to make the chart more capable by giving it a stronger intelligence contract and removing hidden post-render mutation passes.

## Why a global change is appropriate now

The chart is already carrying several forms of decision intelligence:

- price series
- moving averages
- actionable price levels
- scenario cards
- confirmation signals
- decision callouts
- annotation state
- chart-height and workboard layout
- autoscale protection

Small patches helped us migrate safely from legacy injectors into modular renderers. But at this point, too many small patches can create a new problem: architecture drift.

A bounded global change is now better because the Operational Chart needs one coherent contract for:

- what data enters the chart
- what intelligence gets rendered
- what affects price scale
- what remains visual-only
- what validation must pass before publishing

## What Phase 2 should include

### Phase 2A — complete annotation ownership

Status: mostly complete.

The renderer now owns the decision enhancement layer:

- top decision strip
- primary callout
- side decision rail
- confirmation strip
- chart workboard layout
- annotation-state integration

The old enhancer command should remain removed from the active homepage pipeline:

- `scripts/enhance-decision-chart-v2.cjs`

Keep the file temporarily as rollback/reference only.

### Phase 2B — absorb price-scale protection

Move the behavior from:

- `scripts/patch-decision-chart-price-scale.cjs`

into:

- `components/radar/operational-chart/render.cjs`

The renderer/runtime should own scale policy directly.

Required behavior to preserve:

- volume cannot distort the main price scale
- scenario paths cannot force the price axis out of range
- actionable SPX levels remain scale-authorized
- decorative or projected elements are scale-neutral by default
- target/hard-risk/add/trim lines stay visible without destroying working range

### Phase 2C — introduce chart intelligence contract

Create an explicit internal payload model, even if it remains plain JavaScript for now.

Recommended payload shape:

```js
{
  series: {
    price: [],
    movingAverages: [],
    scaleAuthorizedLines: [],
    scaleNeutralOverlays: []
  },
  annotations: {
    markers: [],
    callouts: [],
    rail: [],
    confirmationStrip: []
  },
  policy: {
    autoscale: {},
    overlayAuthority: {},
    renderPermissions: {}
  },
  diagnostics: {
    sourceFreshness: {},
    missingData: [],
    validationWarnings: []
  }
}
```

This does not need to be over-engineered. It only needs to make authority explicit.

### Phase 2D — add validation gate

Add or extend validation so the production build fails if the chart is malformed.

Validation should check:

- exactly one `operational-chart-section`
- exactly one chart container
- exactly one chart runtime block
- decision rail exists when annotation state permits it
- confirmation strip exists when annotation state permits it
- no `[object Object]` leak
- no duplicate post-render enhancement shell
- no active command still calls `enhance-decision-chart-v2.cjs`
- no active command still calls `patch-decision-chart-price-scale.cjs` after scale policy is absorbed

### Phase 2E — remove obsolete command from manifest

After scale policy is inside the renderer:

- remove `node scripts/patch-decision-chart-price-scale.cjs` from `config/homepage-sections.json`

Keep the script file temporarily as rollback/reference.

### Phase 2F — update audit docs

Update:

- `docs/homepage-assembly-audit.md`
- `docs/operational-chart-intelligence-plan.md`

The docs should state that the Operational Chart renderer owns both annotation composition and price-scale policy.

## Why not one massive rewrite

A massive rewrite would be dangerous if it changes too many unrelated systems at once:

- data generation
- visual rendering
- runtime chart behavior
- homepage pipeline
- validators
- cleanup scripts
- section naming
- deployment behavior

That would make failure diagnosis harder.

Instead, Phase 2 should be one global refactor with a clear blast radius:

- Operational Chart renderer
- Operational Chart injector
- homepage manifest command list
- chart validation
- chart docs

Do not touch unrelated modules such as Holdings, Opportunity Queue, Market Tape, Market Lens, or Kostolany Egg during this phase.

## Recommended implementation commit group

The next implementation should be one coordinated group of commits or one PR-level change:

1. `Add Operational Chart autoscale policy to renderer`
2. `Remove Operational Chart price-scale patch command`
3. `Add Operational Chart validation checks`
4. `Update Operational Chart Phase 2 docs`

If the connector supports only direct commits to main, do these in sequence but treat them as one logical unit and verify deployment at the end.

## Decision rule

Use small commits for traceability, but make a global phase-level change.

In other words:

- small commits are okay
- small thinking is not okay
- each commit should advance the same Phase 2 architecture target

## End state

At the end of Phase 2, the Operational Chart should have:

- no post-render enhancement command
- no post-render price-scale patch command
- explicit annotation-state input
- explicit scale-authority policy
- integrated decision rail and confirmation strip
- renderer-owned chart runtime
- validation that catches malformed chart assembly before deployment

The chart should become more intelligent, not simpler.
