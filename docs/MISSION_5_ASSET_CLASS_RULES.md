# Mission 5 Asset-Class Rules

## Purpose

Mission 5 builds the Capital Radar macro evidence spine.

The goal is not to build an ETF dashboard, a market commentary page, or a collection of attractive cards. The goal is to build a master investment framework that can contain other frameworks, compare current data against historical configurations, infer capital behavior, and later allow Holdings to translate those behaviors into allocation, sizing, ruled zones, and invalidation.

## Non-negotiable hierarchy

```text
Asset-class evidence
-> diagnostic lenses
-> historical analogs
-> capital behavior
-> Holdings translation
```

Macro owns the first four layers. Holdings owns portfolio action.

## Macro vs Holdings

### Macro must answer

```text
What is happening across asset classes?
What diagnostic lenses confirm or contradict it?
What historical configurations are similar?
What capital behavior is being expressed?
What evidence is missing?
```

### Holdings must answer

```text
What does this mean for existing positions?
What should be held, added, reduced, hedged, or left alone?
What size is justified?
Where are entry zones and invalidation levels?
```

Macro must not become a portfolio recommendation page.

## Financial language requirement

Capital Radar should use current financial-market terminology on the surface.

Use:

```text
Money Market
Duration
Credit
Equities
FX & Funding
Volatility
Commodities
Real Assets
Monetary Alternatives
```

Do not replace these with abstract philosophical labels in the user-facing system. Ontological meanings may exist behind the scenes, but the interface should train financial fluency.

## Asset classes and governing questions

| Asset class | Governing question | Core behavior |
|---|---|---|
| Money Market | What is the reward for waiting? | wait vs speculate |
| Duration | What is the price of time? | pay for future cash flows vs demand present cash flows |
| Credit | How much repayment trust exists? | lend vs withdraw credit |
| Equities | How broadly is productive surplus being bought? | own broadly vs crowd into narrow leadership |
| FX & Funding | Where is global capital choosing monetary safety and funding access? | seek dollar safety, cheap funding, or cross-border escape |
| Volatility | How much disorder is being priced? | buy insurance vs sell insurance |
| Commodities | How scarce is the physical world? | seek inputs and scarcity exposure vs financial duration |
| Real Assets | How is collateral being priced against income and leverage? | seek tangible collateral vs avoid leverage |
| Monetary Alternatives | Is capital questioning sovereign money or chasing liquidity beta? | store value vs speculate |

## Diagnostic lenses

Diagnostic lenses are not asset classes. They are ways to interpret the asset-class evidence.

Required lenses include:

```text
Yield Curve
Real Yield
Dollar Trend
Global Liquidity
Sector Rotation
Volatility Regime
Credit Stress
Inflation / Scarcity
```

Examples:

```text
Yield curve = Duration lens
Real yield = Duration lens
DXY trend = FX & Funding lens
Sector rotation = Equities lens
Global M2 / liquidity = cross-asset liquidity lens
VIX = Volatility lens
Gold/Oil = Commodities and Monetary Alternatives lenses
```

## Required output for every asset-class state file

Each asset-class state generator should output:

```json
{
  "asset_class": "Credit",
  "primary_question": "How much repayment trust exists?",
  "coverage": "PARTIAL_VALIDATED_SEED",
  "datasets": {},
  "derived": {},
  "chart_series": {},
  "historical_reference": {},
  "capital_behavior": {},
  "missing_evidence": [],
  "analysis": {},
  "macro_gate_contribution": {}
}
```

## Required output for every workbench

Every asset-class workbench must show, in priority order:

```text
1. Raw chart
2. Current values
3. Historical references / percentile position
4. Missing evidence
5. Capital behavior label
```

Text should label data, not replace data.

## Visual doctrine

```text
Raw data
-> annotated data
-> comparative data
-> minimal text
```

Do not use long prose cards as the primary analytic object. The chart is the primary analytic object.

## Data doctrine

Datasets must be included because they explain capital behavior, not because they are easy to fetch.

The asset class is not the ETF.

Examples:

```text
FX & Funding != UUP
Volatility != VXX
Commodities != DBC
Equities != SPY
Monetary Alternatives != Bitcoin only
```

ETF/price proxies may be used temporarily for visual verification, but they must be treated as instruments, not as the ontology.

## Historical reference vs historical analog

Historical reference compares one dataset against past values.

Example:

```text
Current VIX vs 2008 VIX
Current HY OAS vs 2020 HY OAS
```

Historical analog compares configuration across multiple asset classes.

Example:

```text
Money restrictive
+ real yields high
+ credit benign
+ equity breadth narrow
+ dollar firm
+ volatility contained
```

Historical analogs must eventually be configuration-based, not story-based.

Bad:

```text
This looks like 2008.
```

Better:

```text
2008 similarity score: 78%
2022 similarity score: 71%
2020 similarity score: 18%
```

## Capital Behavior Engine rule

Each asset-class workbench must eventually produce a capital behavior object.

Minimum shape:

```json
{
  "behavior": "insurance pricing / disorder hedging",
  "current_condition": "Composite volatility stress is elevated",
  "strategy_posture": "Use volatility to constrain sizing unless credit and liquidity confirm risk expansion",
  "historical_analog_basis": ["2008 crisis volatility", "2020 COVID shock", "2022 rate shock"],
  "invalidation": "Falling volatility is not benign if credit, liquidity, or breadth deteriorate"
}
```

## Master framework ambition

Capital Radar should become a master framework that can contain and reconcile other frameworks:

```text
Dalio / debt cycle
Howell / global liquidity
Fidelity / sector rotation
Marks / cycle temperament
Soros / reflexivity
Graham / valuation discipline
Taleb / barbell / fragility
Fed / rate framework
Risk-on / risk-off
Yield curve / recession framework
Dollar cycle
Commodity scarcity
Crypto / liquidity cycle
```

Each external framework becomes a diagnostic lens inside Capital Radar, not the whole system.

## Mission 5 completion criteria

Mission 5 is not complete until the following asset classes each have dataset cache, state generator, workbench renderer, injector, Macro wiring, and missing-evidence disclosure:

```text
Money Market
Duration
Credit
Equities
FX & Funding
Volatility
Commodities
Real Assets
Monetary Alternatives
```

Mission 5J should then build the integration layer:

```text
Asset-class evidence
+ diagnostic lenses
+ historical analog configuration
+ capital behavior
```

Only after that should Holdings translate the macro state into portfolio action.
