# Mission 5J Traceability Doctrine

## Purpose

Mission 5J converts the asset-class evidence spine into a unified market framework.

The integration layer must remain transparent, falsifiable, and auditable. Capital Radar must never become a black-box macro oracle.

## Non-negotiable rule

Every output must be traceable through this chain:

```text
Dataset
-> Lens
-> Configuration
-> Historical Analog
-> Capital Behavior
```

If any link is missing, the output must be labeled incomplete.

## What 5J builds

Mission 5J builds four engines:

```text
1. Lens Engine
2. Configuration Engine
3. Historical Analog Engine
4. Capital Behavior Engine
```

These engines do not replace the asset-class workbenches. They synthesize them.

## Engine 1: Lens Engine

The Lens Engine converts asset-class datasets into interpretable diagnostic states.

Required lenses include:

```text
Yield Curve State
Real Yield State
Liquidity State
Dollar State
Credit State
Equity Breadth State
Volatility State
Commodity Scarcity State
Collateral State
Monetary Trust State
```

A lens is not an asset class. A lens is a way to interpret evidence.

## Engine 2: Configuration Engine

The Configuration Engine creates the market fingerprint.

Example output:

```json
{
  "money_market": "restrictive",
  "duration": "restrictive",
  "credit": "healthy",
  "equities": "narrow",
  "fx_funding": "dollar_firm",
  "volatility": "contained",
  "commodities": "tight",
  "real_assets": "collateral_expensive",
  "monetary_alternatives": "strengthening"
}
```

This is the central state object that later powers historical analogs and capital behavior.

## Engine 3: Historical Analog Engine

Historical analogs must compare configurations, not stories.

Forbidden:

```text
This feels like 2008.
```

Allowed:

```json
{
  "2022_tightening_shock": 84,
  "2008_gfc": 61,
  "2020_covid_shock": 22,
  "2000_dotcom": 18
}
```

Similarity must be explainable by visible evidence.

## Engine 4: Capital Behavior Engine

The Capital Behavior Engine converts configuration and analog evidence into behavior scores.

Allowed behavior categories:

```text
Wait
Lend
Own
Defend
Store Value
Speculate
Seek Scarcity
Seek Liquidity
```

Example output:

```json
{
  "own": 48,
  "lend": 22,
  "wait": 14,
  "defend": 9,
  "store_value": 5,
  "speculate": 2
}
```

These are not portfolio instructions. Holdings translates them later.

## Macro vs Holdings

Macro may say:

```text
Risk permission is constrained.
Capital behavior favors waiting and selective ownership.
Store-value demand is rising.
```

Macro must not say:

```text
Buy this ticker.
Sell this holding.
Allocate 15% now.
```

Holdings owns allocation, sizing, ruled zones, and invalidation.

## Evidence standard

Every generated integration output must include:

```text
Input datasets
Lens states
Configuration states
Analog basis
Missing evidence
Invalidation condition
```

If evidence is seed-only, partial, proxy-based, or missing, the output must state that clearly.

## Falsifiability requirement

The system must make outputs inspectable.

If Capital Radar says:

```text
Store Value increasing
```

then the user must be able to inspect:

```text
Gold
Bitcoin
Silver
Real Yield
Dollar
Historical Analog
```

and understand why.

No hidden reasoning. No untraceable AI synthesis. No narrative-only conclusions.

## Strategic purpose

Mission 5J is the nervous system of Capital Radar.

The asset-class workbenches are evidence organs. 5J connects them into a market-state framework capable of containing other frameworks such as:

```text
Debt cycle
Global liquidity
Sector rotation
Dollar cycle
Yield curve recession framework
Risk-on / risk-off
Reflexivity
Value discipline
Barbell / fragility
Crypto liquidity cycle
```

Each external framework becomes a lens inside Capital Radar, not the whole system.
