# Component Registry

This registry defines Capital Radar visual intelligence components and their decision purpose.

## Status labels

- `existing` — already present in production or active renderer form.
- `prototype` — exists as visual experiment or documented concept, not reusable production component.
- `needed` — required component that has not been built yet.
- `deprecated` — old visual or one-off pattern that should not be extended.

## Components

| Component | Purpose | Input data | Decision supported | Status |
|---|---|---|---|---|
| TickerDecisionCard | Summarize one ticker's current decision posture. | `TickerSignal` | Add, hold, trim, avoid, watch, defend, or research-only. | prototype |
| PriceZoneMap | Show support, resistance, pivot, and invalidation zones against current price. | `TickerSignal.supportZones`, `TickerSignal.resistanceZones`, price | Where action changes based on price. | needed |
| ProbabilityBiasPanel | Show probabilityUp / probabilityBase / probabilityDown and directional skew. | `TickerSignal` probabilities | Whether upside asymmetry is attractive enough. | needed |
| ValuationRiskGauge | Translate valuation risk into visual pressure. | `valuationRisk`, valuation metrics when available | Whether valuation permits new capital. | needed |
| CatalystTimeline | Show upcoming catalysts and expected directionality. | `Catalyst[]` | Whether timing supports entry, patience, or defense. | needed |
| EntryExitBoard | Show action plan by price zone and catalyst state. | `TickerSignal`, zones, recommendedAction | Entry / add / trim / invalidation plan. | needed |
| MarketRegimeMap | Translate macro and technical regime into portfolio posture. | `MarketRegime` | Risk-on, selective, defensive, or wait posture. | existing / prototype |
| LiquidityConditionPanel | Show liquidity state and its risk-asset implication. | `MarketRegime.liquidityCondition`, future liquidity metrics | Whether speculative risk has liquidity support. | needed |
| KostolanyEggMap | Macro allocation cycle visual. | `kostolany-egg-state.json` or future `MarketRegime` schema | Broad allocation and equity rotation by cycle phase. | existing / prototype |

## Component rules

1. Every radar component must answer a decision question.
2. Every component must accept a stable data shape.
3. No component should hardcode a single ticker.
4. Mock data must come before live-data integration.
5. Standalone HTML may inspire components but should not be pasted into production routes.

## Next component priority

The next recommended component is `TickerDecisionCard`, because it creates the bridge from macro regime to individual ticker action. It should use `data/mock/pltr-signal.json` first.
