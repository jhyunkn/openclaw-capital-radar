# Capital Radar Mission Doctrine

Capital Radar is a research-grade investment intelligence system. It is not a decorative dashboard, a market summary page, or a strategy sentence generator.

Its purpose is to gather broad, current, multi-layer market and ticker evidence; organize that evidence into digestible decision logic; and make the reasoning transparent enough for the investor and the system to challenge the conclusion together.

## Core Mission

Capital Radar must help answer the daily investor question:

> Given the current world, market regime, liquidity condition, sector rotation, ticker fundamentals, portfolio exposure, and risk setup, what decisions are permitted, blocked, or pending evidence?

The system should educate the user while it informs action. It should make the user more capable of understanding markets, not merely dependent on a generated recommendation.

## Non-Negotiable Product Principles

### 1. Evidence before strategy

No strategy statement should appear as a confident recommendation unless it can be traced to an evidence chain.

A decision must be supported by:

- macro regime evidence
- liquidity and rates evidence
- market structure evidence
- sector/theme evidence
- ticker-specific fundamental evidence
- valuation/expectation evidence
- technical/entry evidence
- portfolio exposure evidence
- explicit invalidation evidence

### 2. Transparency over authority

Capital Radar must not sound confident because language is polished. It must be credible because the evidence path is visible.

Every major action should be traceable through:

```text
Evidence -> Interpretation -> Permission -> Action -> Invalidation
```

### 3. Digestibility without simplification

The system should compress complexity, not erase it.

The daily surface should show the minimum decision-critical view, while deeper evidence remains accessible underneath. The user should be able to move from simple conclusion to full support trail.

### 4. Current visual language is the default

Capital Radar's existing visual identity should be preserved unless the information architecture requires a change. New modules must match the current level of graphic restraint and clarity.

The visual reference is the clarity of OpenAI's public website: restrained composition, generous spacing, precise language, low decoration, and graphics that explain rather than compete for attention.

### 5. Ticker decisions require ticker facts

Ticker strategy cannot be generated only from price action or broad market regime.

Ticker pages and decision states should include, where available:

- market cap
- revenue growth
- EPS growth
- gross margin / operating margin / net margin
- free cash flow
- debt and cash
- capex intensity
- P/E and forward P/E
- EV/EBITDA or EV/Sales where appropriate
- valuation vs growth
- earnings date and guidance
- analyst revisions or expectation movement
- sector/theme relevance
- catalyst calendar
- technical entry zone
- downside/invalidation line

### 6. Strategy must be conditional

Capital Radar should avoid unconditional statements such as "buy," "sell," or "hold" without context.

Preferred language:

- allowed if...
- blocked because...
- wait until...
- add only inside...
- trim if...
- invalidated by...
- promote to research if...

### 7. The system should support collaboration

The goal is not to hide the reasoning. The goal is to let the user and system examine the same evidence and improve the conclusion together.

The user should be able to challenge:

- source quality
- evidence relevance
- confidence level
- valuation assumption
- entry timing
- risk sizing
- invalidation threshold

## Target Output Standard

A Capital Radar decision should read like an institutional investment note compressed into a usable operating surface:

```text
Posture:
Risk-on but extended.

Evidence:
SPX trend is supportive, volatility is contained, but growth leadership is stretched and rates remain a valuation headwind.

Portfolio permission:
Hold existing core exposure. New adds require price-zone confirmation and source-quality support.

Ticker implication:
BMNR remains position-monitor / staged-add only because speculative liquidity and crypto-beta evidence are not strong enough for aggressive sizing.

Invalidation:
If SPX loses the 200D with volatility expansion, reduce risk budget and pause new speculative adds.

Evidence quality:
Price and volatility data are strong. Valuation and ticker-specific catalyst evidence require full ticker dossier review.
```

## Development Direction

Capital Radar should develop in this sequence:

1. Build the evidence taxonomy.
2. Map existing artifacts into evidence categories.
3. Identify missing ticker and macro fields.
4. Generate evidence packets for each holding and candidate ticker.
5. Generate decision memos from evidence packets.
6. Render only the most digestible decision layer on the homepage.
7. Keep full evidence trails available as drill-down artifacts.
