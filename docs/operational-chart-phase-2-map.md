# Operational Chart Phase 2 — Global Refactor Map

## Status

Phase 2 is structurally complete.

The Operational Chart now has renderer-owned annotation composition, renderer-owned autoscale policy, active-manifest validation, and a machine-readable validation report.

Completed implementation commits:

1. `75d33b7b38db3db174f25756fe35006a1249e387` — `Fold decision chart enhancement into Operational Chart renderer`
2. `548273bab43d9b61b49ce0ed48d6d0c0f53c9e68` — `Pass annotation state into Operational Chart renderer`
3. `c1c2da7d876e66f18fc8382b64d2ab0fbe0ae4f4` — `Remove Operational Chart enhancer command`
4. `977da7edc8bcc83db890886c931263eb815e16df` — `Add Operational Chart autoscale policy to renderer`
5. `2eb5b23109284b4314a3e5ab03224bf83df669fa` — `Remove Operational Chart price-scale patch command`
6. `d9b8fa98318ed55d341c1bd9e388ebffe7440f05` — `Add Operational Chart assembly validation`
7. `2f3f7201e0971c40e4eabde6d8aa1e381b13e07c` — `Write Operational Chart validation report`

## Position

Phase 2 was intentionally treated as a coordinated Operational Chart architecture change, not a sequence of unrelated cosmetic patches.

The goal was not to simplify the chart. The goal was to make the chart more capable by giving it a stronger intelligence contract and removing hidden post-render mutation passes.

## Completed Phase 2A — annotation ownership

The renderer now owns the decision enhancement layer:

- top decision strip
- primary callout
- side decision rail
- confirmation strip
- chart workboard layout
- annotation-state integration

The injector now passes both chart state and annotation state into the renderer:

- `outputs/operational-chart-state.json`
- `outputs/decision-chart-annotation-state.json`

The old enhancer command is removed from the active homepage pipeline:

- `node scripts/enhance-decision-chart-v2.cjs`

The old script may remain in the repo temporarily as a rollback/reference artifact, but it must not be active in `config/homepage-sections.json`.

## Completed Phase 2B — autoscale ownership

The renderer/runtime now owns scale policy directly.

The old price-scale patch command is removed from the active homepage pipeline:

- `node scripts/patch-decision-chart-price-scale.cjs`

The renderer now explicitly distinguishes scale authority.

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

## Completed Phase 2C — chart intelligence contract

The chart payload now includes an explicit `policy` object with autoscale authority.

The renderer treats scenario paths and volume as disabled / scale-neutral unless future logic explicitly validates them as bounded overlays.

## Completed Phase 2D — validation gate

The canonical homepage build now fails if either post-render command reappears in the active manifest:

- `node scripts/enhance-decision-chart-v2.cjs`
- `node scripts/patch-decision-chart-price-scale.cjs`

It also validates:

- exactly one chart container
- exactly one chart runtime block
- decision rail exists
- confirmation strip exists
- autoscale policy exists
- no legacy price-scale patch residue exists

## Completed Phase 2E — machine-readable chart report

The build now writes:

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

## Remaining follow-up

The following are intentionally deferred beyond Phase 2:

1. Visual QA on production for chart readability and mobile layout.
2. Move old post-render scripts into `scripts/legacy/` after one or two stable deployments.
3. Continue reducing homepage cleanup dependency.
4. Move toward registry-driven homepage assembly.
5. Improve market intelligence depth once assembly is stable.

## End state

At the end of Phase 2, the Operational Chart has:

- no active post-render enhancement command
- no active post-render price-scale patch command
- explicit annotation-state input
- explicit scale-authority policy
- integrated decision rail and confirmation strip
- renderer-owned chart runtime
- validation that catches malformed chart assembly before deployment
- machine-readable operational chart validation output

The chart is now more governed without becoming simpler.
