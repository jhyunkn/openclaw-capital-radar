# Operational Chart Phase 2 Closeout

## Status

Operational Chart Phase 2 is structurally complete.

The chart now has renderer-owned annotation composition, renderer-owned autoscale policy, active-manifest validation, and a machine-readable validation report.

## Completed implementation commits

1. `75d33b7b38db3db174f25756fe35006a1249e387` — `Fold decision chart enhancement into Operational Chart renderer`
2. `548273bab43d9b61b49ce0ed48d6d0c0f53c9e68` — `Pass annotation state into Operational Chart renderer`
3. `c1c2da7d876e66f18fc8382b64d2ab0fbe0ae4f4` — `Remove Operational Chart enhancer command`
4. `977da7edc8bcc83db890886c931263eb815e16df` — `Add Operational Chart autoscale policy to renderer`
5. `2eb5b23109284b4314a3e5ab03224bf83df669fa` — `Remove Operational Chart price-scale patch command`
6. `d9b8fa98318ed55d341c1bd9e388ebffe7440f05` — `Add Operational Chart assembly validation`
7. `2f3f7201e0971c40e4eabde6d8aa1e381b13e07c` — `Write Operational Chart validation report`

## Renderer ownership

`components/radar/operational-chart/render.cjs` now owns:

- chart section rendering
- chart runtime generation
- annotation-state integration
- top decision strip
- primary callout
- side decision rail
- confirmation strip
- chart workboard layout
- explicit autoscale policy
- scale-authority classification

## Injector ownership

`scripts/inject-operational-chart-home.cjs` remains intentionally thin.

It loads:

- `outputs/operational-chart-state.json`
- `outputs/decision-chart-annotation-state.json`

It passes both states into the renderer and should not own chart intelligence policy.

## Removed from active manifest

The active homepage manifest must not call:

- `node scripts/enhance-decision-chart-v2.cjs`
- `node scripts/patch-decision-chart-price-scale.cjs`

These scripts may remain temporarily as rollback/reference artifacts only. They are not part of active homepage assembly.

## Autoscale authority

Scale-affecting items:

- candles
- moving averages
- add zone
- trim zone
- hold above
- defense below
- hard risk
- target
- current price

Scale-neutral items:

- volume
- scenario paths
- projection paths
- annotation markers
- decision rail
- confirmation strip

Projected or decorative elements remain scale-neutral unless explicitly validated and promoted in a future chart contract.

## Machine-readable validation

The canonical homepage build now writes:

- `outputs/operational-chart-validation-report.json`

The report includes:

- `chart_container_count`
- `runtime_count`
- `annotation_layer_present`
- `decision_rail_present`
- `confirmation_strip_present`
- `autoscale_policy_present`
- `legacy_patch_residue_present`
- `scale_affecting_items`
- `scale_neutral_items`
- `warnings`
- `status`

## Build validation

The canonical homepage build fails if either old chart post-render command reappears in the active manifest:

- `node scripts/enhance-decision-chart-v2.cjs`
- `node scripts/patch-decision-chart-price-scale.cjs`

It also fails if the rendered chart is missing the chart container, runtime, decision rail, confirmation strip, or autoscale policy.

## Trust-strip naming check

A repository search for active `trust-strip` usage returned no matches during this closeout. No blind rename was performed.

If future active usage appears, the recommended rename remains:

- `trust-strip` -> `metric-strip`

## Remaining follow-up

1. Visual QA the Operational Chart on production.
2. Keep old post-render scripts as rollback references for one or two stable deployments.
3. Then move old post-render scripts to `scripts/legacy/` or add hard legacy headers.
4. Continue reducing homepage cleanup dependency.
5. Move toward registry-driven homepage assembly.
6. Improve market intelligence depth once assembly is stable.

## End state

The Operational Chart is now more governed without becoming simpler.

It has one renderer-owned chart intelligence path, explicit scale authority, integrated annotation composition, and a validation report that can be inspected by future agents or build checks.
