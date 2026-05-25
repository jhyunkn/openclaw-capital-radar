# Capital Radar Product Architecture

Capital Radar is a research-grade investment intelligence system. Its purpose is to gather broad market and ticker-level evidence, organize that evidence into clear decision logic, and help the user understand what is happening in the world and markets so investment decisions become more reliable, transparent, and collaborative.

This document is the product architecture map. It should guide future development before section-level implementation work begins.

---

## 1. Mission

Capital Radar must become a daily research-to-decision operating system.

It should answer:

```text
What is happening in the world and market?
What does the market environment permit?
What do my current holdings require?
What opportunities deserve new capital?
What evidence supports or weakens each decision?
What would change the conclusion?
```

Capital Radar should not generate strategy from shallow metadata. It must gather, classify, verify, and display the evidence behind strategy.

The target chain is:

```text
Data -> Evidence -> Interpretation -> Permission -> Action -> Invalidation
```

---

## 2. Visual Principles

The current Capital Radar visual language should be preserved unless the information architecture requires change.

The product should follow the clarity standard of OpenAI's public website:

- restrained visual system
- generous spacing
- precise language
- few competing focal points
- quiet but high-confidence graphics
- visuals that explain rather than decorate
- no dashboard clutter for its own sake

New visuals are allowed when they expose evidence, reasoning, uncertainty, reliability, or decision logic. A visual module is infrastructure when it makes evidence usable.

Forbidden direction:

- foreign design language
- dark institutional inserts that do not belong to the current system
- decorative dashboards
- more panels that do not add decision function
- strategy claims without visible support

---

## 3. Target Homepage Architecture

The homepage should become a daily operating note organized by decision function, not by legacy artifacts.

### Layer 1: Macro Reading

Macro Reading integrates the current Egg diagram, Command Center, and Confirmation Board into one coherent market-regime read.

It answers:

- What macro phase are we in?
- What is the liquidity condition?
- What is the market posture?
- What signals confirm the posture?
- What signals contradict the posture?
- What asset classes, sectors, and themes are favored or blocked?
- What would invalidate the macro read?

The Egg diagram should remain because it is a useful graphic. It should become part of Macro Reading rather than a separate conceptual island.

The Confirmation Board should not remain a separate section. Its data should feed Macro Reading and Market Execution Map.

The Command Center should not remain a separate authority source. Its verbal summary should become the executive read inside Macro Reading.

### Layer 2: Market Execution Map

This is the current S&P 500 Decision Map. It is working and should be kept.

It answers:

- Where is the market now?
- Where is the add-review zone?
- Where is the hold-above line?
- Where is the trim/no-chase zone?
- Where is the defense line?
- What scenario path is active?
- What invalidates the current market route?

Development need:

The Decision Map should gain evidence support, not be replaced. It must explain why each zone is valid and which macro/market signals support or contradict it.

### Layer 3: Portfolio / Price Zone Radar

This is the current holdings and price-zone system. It is working and should be kept.

It answers:

- What do current holdings require today?
- Which holdings are near buy zones?
- Which are neutral holds?
- Which are overextended?
- Which need risk review?
- Which positions are too concentrated for more capital?

Development need:

Price Zone Radar must be enriched with ticker fundamentals, valuation, catalyst, and portfolio sizing evidence.

Each holding should eventually expose:

- market cap
- revenue growth
- EPS growth
- gross margin
- operating margin
- free cash flow
- debt and cash
- capex intensity
- P/E and forward P/E
- EV/EBITDA or EV/Sales where appropriate
- valuation vs growth
- sector/theme exposure
- next catalyst
- add/trim/invalidation level
- portfolio weight and sizing permission

### Layer 4: Opportunity Research Engine

This is currently the weakest layer and requires the largest rebuild.

It answers:

- Which candidates deserve research?
- Which deserve capital soon?
- Which are blocked?
- What is the thesis?
- What evidence supports the thesis?
- What evidence weakens it?
- What valuation condition matters?
- What catalyst matters?
- What would upgrade it?
- What would reject it?

Opportunity should become an evidence dossier system, not a thin ranking table.

### Layer 5: Evidence / Source / Trust Engine

This is the reliability layer underneath every visible section.

It answers:

- Where did the information come from?
- How fresh is it?
- Is it a fact, derived signal, model interpretation, or user portfolio field?
- Which claims does it support?
- Which claims are weakly supported?
- Which decision is using stale, missing, or proxy evidence?

The Evidence Engine can be visually quiet, but it must be present in the product logic. It should be available for audit and should feed OpenClaw validation.

---

## 4. What To Keep

### Keep the Decision Map

The Decision Map is one of the strongest pieces. It already translates broad market conditions into actionable boundaries. It should be refined with evidence and scenario logic, not replaced.

### Keep the Price Zone Radar

Price Zone Radar is also strong. It connects the system to actual holdings and action zones. It should be enriched with fundamental and valuation evidence.

### Keep the Egg Diagram

The Egg remains useful as a macro-cycle graphic, but it should be integrated into Macro Reading.

### Keep the current graphic language

The current visual language should remain the default. New displays must fit the current system unless there is a clear information-architecture reason to evolve it.

---

## 5. What To Integrate

### Egg + Command Center + Confirmation Board -> Macro Reading

These should no longer function as separate authority sources. They should become one integrated macro read.

Current issue:

```text
Egg says one thing.
Command Center says another thing.
Confirmation Board adds more signals.
The user must synthesize them manually.
```

Target state:

```text
Macro Reading synthesizes all of them into one readable market regime explanation.
```

The Confirmation Board's contents should not disappear. They should be placed where they matter:

- VIX and volatility -> Macro Reading and Decision Map
- TLT / rates -> Macro Reading and valuation context
- BTC / liquidity beta -> Macro Reading and speculative-risk permission
- QQQ / growth leadership -> Macro Reading and growth-equity permission
- credit spreads -> Macro Reading and risk budget

---

## 6. What To Rebuild

### Opportunity

Opportunity must be rebuilt from ranking table to evidence-backed research engine.

Each opportunity should include:

```text
Ticker
Thesis
Theme
Why it matters
What may be underpriced
Fundamental evidence
Valuation evidence
Catalyst evidence
Technical entry evidence
Portfolio relevance
Evidence for
Evidence against
Missing / weak evidence
Upgrade trigger
Reject trigger
Suggested action permission
Invalidation
Source / reliability note
```

The homepage version can remain compact. The deeper evidence trail can live in linked artifacts or ticker pages.

---

## 7. Data Requirements

Capital Radar must expand from market-state metadata into a richer data model.

### Macro data

- Fed policy rate
- Fed expectations
- inflation trend
- real rates
- yield curve
- dollar trend
- oil trend
- gold trend
- credit spreads
- high-yield OAS
- financial conditions
- liquidity proxies
- money market flows where available

### Market structure data

- SPX trend
- QQQ trend
- VIX
- breadth
- sector leadership
- advance/decline
- momentum
- moving averages
- volume confirmation
- positioning or sentiment proxies when available

### Sector/theme data

- sector relative strength
- theme momentum
- AI capex evidence
- power/grid/data-center demand
- crypto liquidity
- healthcare trend evidence
- industrial/defense policy tailwinds
- earnings revision trend by theme

### Ticker fundamentals

- market cap
- revenue growth
- EPS growth
- gross margin
- operating margin
- net margin
- free cash flow
- debt
- cash
- capex
- share count / dilution
- guidance

### Ticker valuation

- P/E
- forward P/E
- EV/Sales
- EV/EBITDA
- price/sales
- free cash flow yield
- valuation vs history
- valuation vs peers
- valuation vs growth
- analyst revision trend
- earnings surprise history

### Ticker catalysts

- earnings date
- guidance update
- product launch
- contract win
- regulatory catalyst
- policy exposure
- M&A or partnership
- insider activity
- institutional ownership changes
- short interest

### Portfolio data

- position size
- cost basis
- unrealized gain/loss
- portfolio weight
- theme concentration
- correlation to current holdings
- cash available
- max add size
- risk budget

---

## 8. Strategy Output Contract

Every strategy claim must be traceable.

Required structure:

```text
Decision
Evidence for
Evidence against
Weak or missing evidence
Allowed action
Blocked action
Entry trigger
Invalidation
Position-sizing logic
Confidence / reliability note
```

Forbidden strategy patterns:

- price-only ticker recommendation
- broad macro statement without macro evidence
- opportunity ranking without thesis support
- confident action without invalidation
- buy/sell language without sizing and trigger
- strategy that cannot be traced to source or evidence field

Preferred language:

- allowed if
- blocked because
- wait until
- add only inside
- trim if
- invalidated by
- promote to research if
- promote to capital if

---

## 9. OpenClaw Reliability Role

OpenClaw should become the reliability and research execution layer.

It should help Capital Radar by:

- collecting source data
- validating source freshness
- classifying data by evidence cluster
- detecting missing fields
- challenging weak claims
- flagging stale or proxy evidence
- separating fact from derived signal and model interpretation
- building ticker evidence dossiers
- writing source reliability reports
- preventing unsupported strategy claims from rendering as high-confidence output

OpenClaw should not merely generate more text. It should improve truthfulness and evidence coverage.

---

## 10. Implementation Sequence

### Phase 1: Architecture lock

- Maintain this product architecture document.
- Maintain the mission doctrine.
- Maintain the investment evidence taxonomy.

### Phase 2: Evidence mapping

- Map existing artifacts into evidence clusters.
- Generate an evidence coverage report for Macro, Decision Map, Price Zone Radar, and Opportunity.
- Identify fields that already exist versus fields that OpenClaw must collect.

### Phase 3: Opportunity rebuild

- Turn Opportunity into evidence-backed research cards.
- Build deeper opportunity dossiers.
- Add upgrade/reject gates.
- Add source reliability status.

### Phase 4: Price Zone enrichment

- Add ticker fundamentals and valuation support to holding cards or linked holding pages.
- Add sizing permission and concentration logic.

### Phase 5: Decision Map evidence support

- Keep the chart and zones.
- Add evidence justification for add/hold/trim/defense zones.
- Show confirming and contradicting signals inside the map logic.

### Phase 6: Macro Reading integration

- Integrate Egg, Command Center, and Confirmation Board.
- Make Macro Reading the single source of market-regime authority.

### Phase 7: Homepage refinement

- Render the homepage as a daily operating note:

```text
Macro Reading
Market Execution Map
Portfolio / Price Zone Radar
Opportunity Research
Evidence / Trust access
```

The page should remain clear, restrained, and readable.

---

## 11. Product Judgment Standard

A future Capital Radar change is valid only if it improves at least one of the following:

- evidence depth
- data reliability
- decision transparency
- user education
- portfolio relevance
- actionability
- visual clarity
- source auditability

A change is invalid if it only adds visual novelty, generic market commentary, or unsupported strategy language.
