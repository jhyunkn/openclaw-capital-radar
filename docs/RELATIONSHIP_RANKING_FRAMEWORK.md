# Relationship Ranking Framework

## Purpose

The Relationship Ranking Engine decides which cross-asset relationships deserve attention before the user manually asks for them.

Capital Radar should not merely allow overlays. It should recommend the most informative overlays based on market state, historical context, data quality, and portfolio relevance.

## Product principle

```text
Asset classes are the library.
Relationships are the investigation.
Configuration is the synthesis.
History is the memory.
Portfolio translation is the action layer.
```

## Ranking question

For every market review, the engine asks:

```text
Which relationships contain the most decision-relevant information right now?
```

## Relationship candidate structure

Each relationship candidate should contain:

```json
{
  "id": "real_yield_vs_nasdaq_vs_credit",
  "canonical_question": "Money / Risk Appetite",
  "primary_series": "Real Yield",
  "overlay_series": ["Nasdaq", "HY OAS"],
  "relationship_type": ["divergence", "non_confirmation"],
  "score": 92,
  "confidence": "medium",
  "why_now": "Real yield and Nasdaq are both elevated while credit stress remains contained.",
  "historical_markers": ["1969-70", "1973-74", "1980-82", "2022"],
  "portfolio_relevance": "Risk assets may remain supported until credit or volatility confirms deterioration.",
  "missing_evidence": ["full history for Nasdaq proxy before 1971", "credit spread proxy for early regimes"]
}
```

## Scoring components

Relationship score is not simple correlation.

Use these components:

### 1. Divergence score

Measures whether historically related signals are moving apart.

Examples:

```text
Real Yield rising + Nasdaq rising
DXY rising + commodities rising
Credit spreads widening + VIX falling
```

High divergence means the relationship may contain hidden regime information.

### 2. Convergence score

Measures whether multiple independent signals are confirming the same pressure.

Examples:

```text
DXY rising + HY OAS widening + VIX rising
Oil rising + inflation breakevens rising + real yields rising
Liquidity rising + Bitcoin rising + growth leadership widening
```

High convergence means configuration confidence increases.

### 3. Non-confirmation score

Measures when one expected confirming signal refuses to confirm.

Examples:

```text
Real yields restrictive, but credit spreads contained
Dollar strong, but volatility contained
Equity index high, but breadth weak
```

Non-confirmation is important because it identifies where the market may still have room before stress becomes broad.

### 4. Regime-shift score

Measures whether a relationship has recently changed behavior compared with its own history.

Examples:

```text
Gold rising despite real yields rising
Equities rising despite tightening liquidity
Copper rising while oil falls
```

High regime-shift score means the relationship may be telling us a structural story rather than a cyclical one.

### 5. Historical similarity score

Measures whether the current relationship pattern resembles prior regimes.

Candidate analog periods:

```text
1907
1929-32
1937
1946-51
1969-70
1973-74
1980-82
1998
2000-02
2008
2020
2022
```

Older periods are allowed, but evidence quality must be disclosed.

### 6. Capital-importance score

Not every relationship matters equally.

Higher priority relationships affect portfolio allocation more directly:

```text
Real Yield vs Growth
DXY vs Liquidity
Credit vs Small Caps
Oil vs Inflation Expectations
Copper vs Semiconductors
Liquidity vs Bitcoin
```

Lower-priority relationships may still be useful but should not dominate the first screen unless their signal is unusually strong.

## Suggested weights for first implementation

```json
{
  "divergence": 25,
  "convergence": 20,
  "non_confirmation": 20,
  "regime_shift": 15,
  "historical_similarity": 10,
  "capital_importance": 10
}
```

These weights are provisional and should be adjusted after visual review.

## Output format

The engine should produce:

```text
Top relationships today
Relationship score
Signal type
Evidence basis
Historical analog candidates
Portfolio relevance
Missing evidence
Confidence level
```

## Visual placement

The Relationship Engine should be visually prominent, but not replace asset-class workbenches.

Recommended hierarchy:

```text
1. Current configuration summary
2. Top relationship overlays
3. Selected relationship chart
4. Historical analog candidates
5. Asset-class library / audit trail
```

## Guardrail

The AI should not only comment on relationships. It should prioritize which relationships deserve attention.

The user may still request custom overlays, but the default experience should be analyst-guided rather than empty-chart-tool guided.
