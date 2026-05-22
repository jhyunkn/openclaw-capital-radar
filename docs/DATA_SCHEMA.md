# Data Schema

Capital Radar visuals should be driven by stable data shapes before any live data is connected.

The initial shared TypeScript interfaces live in:

```txt
lib/types/radar.ts
```

The first mock ticker data file lives in:

```txt
data/mock/pltr-signal.json
```

## TickerSignal

A `TickerSignal` represents the decision-support state for one ticker.

Required fields:

| Field | Type | Purpose |
|---|---|---|
| `ticker` | string | Ticker symbol. |
| `price` | number | Current or mock current price. |
| `directionalBias` | enum | Bullish / constructive / neutral / cautious / bearish posture. |
| `probabilityUp` | number | Upside scenario probability from 0–100. |
| `probabilityBase` | number | Base scenario probability from 0–100. |
| `probabilityDown` | number | Downside scenario probability from 0–100. |
| `supportZones` | `SupportResistanceZone[]` | Areas where buyers or thesis support should appear. |
| `resistanceZones` | `SupportResistanceZone[]` | Areas where supply, trim logic, or confirmation thresholds appear. |
| `valuationRisk` | enum | Low / moderate / high / extreme valuation pressure. |
| `technicalRegime` | enum | Uptrend / range / breakdown / recovery / transition. |
| `thesis` | string | Core investment thesis. |
| `invalidation` | string | What would break the thesis or action. |
| `recommendedAction` | `RadarAction` | Add / hold / trim / avoid / watch / defend / research-only. |

Optional fields:

- `asOf`
- `liquidityCondition`
- `catalysts`
- `riskScenarios`

## MarketRegime

A `MarketRegime` describes the macro and market-structure context that should condition ticker-level actions.

Core fields:

- `id`
- `label`
- `phase`
- `liquidityCondition`
- `technicalRegime`
- `volatilityState`
- `recommendedRiskPosture`

## SupportResistanceZone

A support or resistance zone is an actionable price area, not just a chart annotation.

Fields:

- `label`
- `low`
- `high`
- `type`
- `relevance`
- `reasoning`

## Catalyst

A catalyst explains why timing may matter.

Fields:

- `date`
- `title`
- `type`
- `expectedImpact`
- `notes`

## RiskScenario

A risk scenario defines what can go wrong and what the radar should do in response.

Fields:

- `name`
- `probability`
- `downsideLevel`
- `trigger`
- `response`

## Schema rule

If a component cannot render from mock JSON that follows these schemas, it is not ready for live-data integration.
