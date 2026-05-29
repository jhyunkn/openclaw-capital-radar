# Capital Behavior Engine

## Purpose

Capital Radar is not an ETF dashboard and not a macro commentary page.

The system exists to observe durable asset-class state variables, compare them against historical conditions, infer repeatable capital behavior, and prepare transparent strategy logic.

The goal is not to predict an exact outcome. The goal is to recognize historically similar capital conditions early enough to prepare.

## Core chain

```text
Asset-class ontology
-> governing question
-> required dataset
-> historical analog comparison
-> capital behavior inferred
-> strategy posture
-> Holdings translation
```

## System rule

The asset-class question is only useful if it connects to a repeatable capital behavior.

A dataset is not included because it is easy to fetch. A dataset is included because it helps identify how capital historically behaves under similar conditions.

## Macro and Holdings responsibilities

Macro reads the landscape:

```text
What are the durable asset-class conditions?
How do current readings compare to historical analogs?
What capital behaviors are being expressed?
What evidence is missing?
```

Holdings translates the landscape:

```text
What does this mean for current positions?
Should exposure be held, added, reduced, hedged, or left alone?
Where are ruled zones and invalidation points?
What position size is justified by the evidence?
```

## Durable capital behaviors

The system should infer behavior such as:

```text
wait
lend
withdraw credit
own productive surplus
crowd into narrow leadership
buy future optionality
seek monetary safety
hedge disorder
store value
seek collateral
chase liquidity beta
prepare for scarcity
```

These behaviors are more timeless than individual instruments.

## Asset-class behavior map

| Asset class | Governing question | Capital behavior inferred | Strategy posture generated |
|---|---|---|---|
| Money / Cash | What is the reward for waiting? | Wait vs speculate | Cash as option value; risk size constrained when cash is competitive |
| Sovereign Bonds / Duration | What is the price of time? | Pay for future cash flows vs demand present cash flows | Long-duration assets need falling real yields or curve support |
| Credit | How much repayment trust exists? | Lend vs withdraw | Broad risk needs credit trust; widening spreads reduce risk permission |
| Equity Ownership | How broadly is productive surplus being bought? | Own broadly vs crowd narrowly | Broad participation supports stronger risk allocation; narrow leadership requires caution |
| Long-Duration Growth / Innovation Optionality | How far into the future is capital willing to pay? | Buy optionality vs demand current earnings | Innovation exposure needs liquidity, duration, and risk appetite confirmation |
| Real Assets | How is tangible collateral priced against income and leverage? | Seek collateral vs avoid leverage | Real assets need income/leverage support; rate pressure constrains allocation |
| Commodities / Inputs | How scarce is the physical world? | Prepare for scarcity vs disinflation | Scarcity regimes favor inputs/real assets; falling scarcity supports financial duration |
| Monetary Alternatives | Is capital questioning sovereign money or chasing liquidity beta? | Store value vs speculate | Gold/BTC signals must be separated into trust hedge and liquidity beta |
| FX / Dollar | Where is global capital choosing monetary safety and funding access? | Seek dollar safety vs leave dollar | Strong dollar/funding stress tightens global risk; weak dollar supports global reflation |
| Volatility / Insurance | How much disorder is being priced? | Hedge disorder vs sell insurance | High volatility constrains sizing; falling volatility can permit risk expansion |

## Historical analog method

For each asset class, the system should compare current readings against historically similar configurations.

A historical analog is not merely the same price level. It is a similar condition across multiple state variables.

Example:

```text
Money competitive
+ real yields high
+ credit spreads widening
+ equity breadth narrow
```

This is not the same market as:

```text
Money competitive
+ real yields falling
+ credit spreads tightening
+ equity breadth broadening
```

The first condition implies caution and liquidity preservation. The second may imply a future risk window forming.

## Strategy posture vocabulary

The Capital Behavior Engine should generate posture, not direct prediction.

Allowed posture language:

```text
Risk permission expanding
Risk permission constrained
Liquidity preferred
Duration support improving
Credit trust deteriorating
Equity breadth confirming
Equity breadth fragile
Scarcity pressure rising
Dollar pressure tightening
Volatility regime unstable
```

Forbidden posture language:

```text
Buy now
Sell now
This will happen
Guaranteed rotation
Certain crash
```

## Evidence standard

Every behavior inference must show:

```text
current data
historical reference
comparison basis
missing evidence
invalidation condition
```

If the evidence is incomplete, the system must say so.

## Mission 5 implication

Mission 5 should continue building each asset-class workbench, but every workbench must eventually output a capital behavior object.

Minimum required output:

```json
{
  "asset_class": "Credit",
  "governing_question": "How much repayment trust exists?",
  "current_condition": "spreads benign but weakest-credit stress rising",
  "historical_analog_basis": ["2007 pre-crisis compression", "2021 liquidity compression", "2022 tightening shock"],
  "capital_behavior": "lending trust still present but fragility increasing",
  "strategy_posture": "risk permission conditional, do not chase broad beta without confirmation",
  "missing_evidence": ["default rates", "lending standards", "private credit stress"],
  "invalidation": "HY and CCC spreads materially widen while bank credit contracts"
}
```

## Final architecture

```text
Macro
= evidence, analog, capital behavior

Holdings
= position, sizing, ruled zones, invalidation, action
```

This keeps Capital Radar systematic, historically grounded, and allocation-relevant without collapsing into an ETF dashboard or generic market commentary.
