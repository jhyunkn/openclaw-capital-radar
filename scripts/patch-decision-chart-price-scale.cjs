// LEGACY / DISABLED
//
// Do not add this script back to config/homepage-sections.json.
// Operational Chart Phase 2 moved price-scale authority into:
//   components/radar/operational-chart/render.cjs
//
// Former responsibility:
// - remove volume from the main SPX price pane
// - remove scenario/projection line series from the main price pane
// - prevent scenario artifacts from distorting the price axis
// - clamp autoscale to actionable SPX values only
//
// Current authority:
// - The Operational Chart renderer owns autoscale policy through buildAutoscalePolicy().
// - Volume and scenario paths are scale-neutral by default.
// - scripts/render-capital-radar-home.cjs fails the build if this command reappears in the active manifest.
//
// Historical implementation is preserved in git history before this disable commit.

throw new Error('Legacy disabled: Operational Chart price-scale policy is renderer-owned. Do not run patch-decision-chart-price-scale.cjs.');
