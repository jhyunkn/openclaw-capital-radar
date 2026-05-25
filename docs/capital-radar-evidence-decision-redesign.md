# Capital Radar Evidence-to-Decision Redesign

Status: draft research/product architecture
Date: 2026-05-25
Owner: finance-leader
Purpose: Replace thin signal-to-strategy output with a research accumulation and shared reasoning system.

## Core correction

Capital Radar must not pretend to make decisions from a thin layer of signals. A dashboard sentence such as `risk-on but extended` is only useful if the page shows:

1. what data was collected,
2. when each source was refreshed,
3. how reliable/fresh each source is,
4. what evidence supports the conclusion,
5. what evidence contradicts it,
6. what is unknown,
7. what action is allowed or blocked,
8. what trigger would change the conclusion.

The product should behave like a private investment research desk and shared thinking table, not an oracle or polished strategy veneer.

## Current factual state

Current live/public data state already exposes some refresh metadata:

- report generated: `public/data/report-state.live.json.meta.generatedAt`
- build normalized: `public/data/report-state.live.json.meta.normalizedAtBuild`
- Yahoo public chart fetch: `outputs/data-health.json.sources.yahooFinance.lastSuccessfulFetchAt`
- FRED fetch: `outputs/data-health.json.sources.fred.lastSuccessfulFetchAt`
- source ledger generated: `outputs/source-reliability-ledger.json.generatedAt`

But the homepage does not make this prominent enough. Jun does not need a generic daily-delta card before the data is trustworthy; first priority is a clear **Data Refresh / Evidence Coverage** strip.

## Research basis / external source notes

### SEC EDGAR APIs
SEC `data.sec.gov` exposes public JSON APIs without authentication/API keys. It includes company submissions history and XBRL financial statement facts from 10-K, 10-Q, 8-K, 20-F, 40-F, 6-K and variants. SEC says APIs are updated in real time as submissions disseminate, with submissions typically under one second delay and XBRL typically under one minute, though delays can be longer during peak filing times. Bulk companyfacts/submissions ZIP files are republished nightly around 3:00 a.m. ET.

Implication: Capital Radar can build primary-source filing and fundamentals evidence from SEC submissions and XBRL companyfacts, and should show filing/XBRL freshness separately from market-price freshness.

Source checked: `https://www.sec.gov/search-filings/edgar-application-programming-interfaces` fetched 2026-05-25.

### FRED
FRED API supports economic series observations, releases, release dates, sources, updates, and vintage dates. It can retrieve entire histories and release-level data.

Implication: Capital Radar should not just show latest macro values. It should track release cadence, update/vintage dates, and whether macro evidence is current enough for decision use.

Source checked: `https://fred.stlouisfed.org/docs/api/fred/` fetched 2026-05-25.

### Local design doctrine
OpenClaw's design doctrine requires cognitive fluency before feature density, visible hierarchy without explanation, a narrative focal point, and a clear first impression. The current Capital Radar page violates this when all modules compete equally and the visible first screen starts directly with a framework diagram instead of an action/evidence orientation.

Source checked: `openclaw-state/universal-design-doctrine.md` and `prompt-library/validation/design-quality-gate.md`.

## Required data domains

Capital Radar should collect evidence in these domains. Each evidence object must carry source, as-of time, reliability tier, freshness status, and decision relevance.

### 1. Market price / technical state
- Current price, close, intraday when available
- 1D / 5D / 1M / 3M / YTD return
- Moving averages: 20D / 50D / 100D / 200D
- RSI / MACD / momentum proxy
- ATR / realized volatility
- Volume vs average volume / relative volume
- Support, resistance, buy/review zone, trim/review zone, stop/review line
- Breadth: advancing/declining, sector breadth, above 50D/200D if source available

Use: timing, risk, entry discipline, confirmation only. Price data alone cannot justify thesis or capital deployment.

### 2. Macro / liquidity / credit
- Fed policy rate, 2Y, 10Y, 2s10s, real yields if available
- Inflation: CPI/PCE/breakevens
- Credit spreads: HY OAS / IG spreads
- Dollar, oil, gold
- Liquidity proxies: reserve balances, RRP, TGA where feasible
- VIX / volatility regime

Use: regime permission and risk budget. Must show which macro variables are fresh, stale, or next-release pending.

### 3. Sector / theme evidence
- Sector relative strength
- ETF proxies and constituents
- Theme exposure map: AI infra, data centers, energy/nuclear, crypto/stablecoin, defense, healthcare, payments, etc.
- Theme-specific leading indicators: power demand/capex for data centers, BTC/liquidity for crypto beta, rate sensitivity for long-duration growth.

Use: explain why a ticker belongs in a current opportunity lane or should be constrained.

### 4. Company primary evidence
- SEC submissions list and latest 10-K/10-Q/8-K
- XBRL company facts: revenue, gross margin, operating income, net income, cash, debt, shares, SBC, capex, FCF proxy if derivable
- Filing excerpts or links for material claims
- Earnings date, transcript/presentation links where available
- Management guidance and changes vs prior guidance

Use: thesis validation. Without this, the system should say “research-only,” not generate confident posture.

### 5. Valuation / expectation gap
- Market cap / enterprise value if available
- Revenue growth / margin / earnings trend
- FCF yield / forward PE / sales multiple where available and sourced
- Peer comps where meaningful
- What future is priced in, not just whether price is up/down
- Analyst estimate revisions if source available; otherwise mark missing

Use: decide whether a good company is actually actionable.

### 6. News / catalysts / events
- Material company news with source and timestamp
- Earnings, product, regulatory, financing, dilution, M&A, analyst days
- News materiality score: not every headline matters
- Contradictory news and risk events

Use: explain why a decision changed or why a watch item became urgent.

### 7. Portfolio / exposure / risk
- Position size, market value, portfolio weight
- Cost basis when Jun provides it; otherwise mark unavailable
- Concentration by theme, beta, liquidity bucket, levered product exposure
- Max loss / drawdown sensitivity scenario
- Add/trim sizing rules by risk budget

Use: the same ticker can be attractive but still blocked because portfolio exposure is already too high.

### 8. Source quality and freshness
For every field:
- source id
- source type: primary, market data, macro, news, social/video, internal
- as-of timestamp
- fetch timestamp
- stale threshold
- reliability tier
- allowed use: fact, market signal, thesis support, background, hypothesis only
- blocking behavior if stale/missing

Use: make trust visible before decision language.

## Evidence object schema

```json
{
  "id": "MSFT-filing-revenue-growth-2026Q1",
  "ticker": "MSFT",
  "domain": "company_primary",
  "claim": "Revenue growth remained positive in latest reported quarter.",
  "fact": 123.45,
  "unit": "USD billions or percent",
  "direction": "supports | contradicts | neutral | unknown",
  "source": {
    "name": "SEC companyfacts",
    "url": "https://data.sec.gov/api/xbrl/companyfacts/CIK....json",
    "type": "primary",
    "trustTier": "primary",
    "asOf": "2026-...",
    "fetchedAt": "2026-..."
  },
  "freshness": {
    "status": "fresh | aging | stale | missing",
    "staleAfterHours": 24
  },
  "decisionUse": ["thesis", "valuation", "risk", "permission"],
  "confidence": "high | medium | low",
  "requiresCrossCheck": false,
  "notes": "short human-readable explanation"
}
```

## Decision packet schema

Every decision on the dashboard should be a packet, not a sentence.

```json
{
  "ticker": "BMNR",
  "question": "Should we add, hold, trim, or research only?",
  "currentPermission": "research_only | verify_first | add_review | hold | trim_review | exit_review",
  "answer": "Do not add full size now; require staged review only if evidence conditions improve.",
  "evidenceFor": [],
  "evidenceAgainst": [],
  "unknowns": [],
  "conflicts": [],
  "actionConditions": [
    "price enters ruled zone",
    "liquidity confirms",
    "primary-source thesis evidence complete"
  ],
  "invalidation": [],
  "sizingRule": "blocked until evidence complete",
  "confidence": {
    "level": "low | medium | high",
    "reason": "low because primary thesis evidence missing"
  },
  "lastRefreshed": {
    "marketData": "timestamp",
    "filings": "timestamp",
    "macro": "timestamp",
    "news": "timestamp"
  }
}
```

## Homepage information architecture

Replace the current equal-weight module stack with this hierarchy:

### A. Data Refresh / Evidence Coverage strip
First visible strip. Jun asked for this explicitly.

Show:
- Market prices last refreshed
- Macro/FRED last refreshed
- SEC filings/XBRL last refreshed
- News/source scan last refreshed
- YouTube/source-pool scan last refreshed if available
- Portfolio file last updated
- Evidence coverage score by holdings and candidates
- Any stale/blocking source

This should be factual, small, and always visible near the top.

### B. Decision table / shared thinking table
A compact table for the few active questions:
- `What question are we deciding?`
- `Current answer`
- `Evidence for`
- `Evidence against`
- `Unknowns`
- `Permission`
- `Trigger to change`
- `Confidence`

This is the heart of the product. It should make the reasoning path visible.

### C. Market regime proof, not regime claim
Instead of `risk-on but extended` as headline, show:
- Market claim
- Evidence supporting
- Evidence contradicting
- Data freshness
- Confidence and permission implication

### D. Holdings research matrix
For each holding:
- price zone
- permission
- thesis completeness
- valuation completeness
- risk/exposure status
- latest material source
- missing evidence

The card should answer: “Can we actually make a decision here, or are we pretending?”

### E. Ticker decision packets
Expandable deep cards for BMNR, TSNF, CONL, TSLT first.
Each packet shows the evidence argument and the current action constraints.

### F. Source library / evidence ledger
Not a decorative section. This is the audit trail:
- source list
- refresh cadence
- current freshness
- reliability
- allowed use
- fields powered

## Anti-patterns to avoid

- Strategy sentence before evidence.
- `Buy` labels without permission context.
- A single confidence score without showing what is missing.
- Treating Yahoo price metadata as thesis evidence.
- Treating YouTube/news as authority instead of hypothesis generation.
- Showing 15 “promotion review” candidates when the real state is mostly “watch / collect evidence.”
- Combining data from different as-of dates without visible freshness labels.
- Equal-weight dashboard modules that force Jun to reconstruct the argument manually.

## Implementation backlog

### Phase 1 — Trust and freshness
1. Add homepage Data Refresh / Evidence Coverage strip.
2. Add source freshness validator: market, FRED, SEC, news, portfolio.
3. Change generic “promotion review” language to more selective buckets.
4. Make stale/missing evidence block confident decision language.

### Phase 2 — Evidence collection spine
1. Build SEC companyfacts/submissions collector for holdings and high-priority candidates.
2. Build filing evidence extractor: latest 10-K, 10-Q, 8-K dates and material filing links.
3. Expand FRED macro collector with release/freshness metadata.
4. Add company/news/catalyst collector with materiality scoring.
5. Add source ledger rows per evidence field, not just per source family.

### Phase 3 — Decision packets
1. Create decision packets for BMNR and TSNF first.
2. Create loss-minimization packets for CONL and TSLT.
3. For each packet, show evidence for/against/unknowns/conflicts/triggers.
4. Block any packet from “add/trim confidence” unless minimum evidence coverage is satisfied.

### Phase 4 — Shared reasoning UI
1. Build the decision table / shared thinking table.
2. Add expandable evidence rows and links to raw/source artifacts.
3. Let Jun see and challenge the evidence rather than only read generated conclusions.

## Minimum evidence requirements before action confidence

### For any holding add-review
- fresh market data
- primary company source or filing evidence
- valuation/expectation context
- risk/exposure check
- macro/sector permission
- explicit invalidation
- confidence reason

### For speculative / levered products
- above plus liquidity/volatility state
- decay/path-dependency explanation
- staged sizing rule
- loss-minimization exit plan
- strict evidence threshold before adding

### For candidates
- primary source evidence
- thesis summary
- why now
- valuation/asymmetry
- risk and invalidation
- portfolio role
- source freshness

## Near-term decision

Do not start BMNR/TSNF conclusions by writing conclusions. Start by building the evidence packet schema and collectors, then let the packet produce a permission state. The dashboard should visibly say when evidence is not enough.
