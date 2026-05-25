# Capital Radar Evidence-to-Decision Implementation Plan

Status: implementation plan
Date: 2026-05-25
Owner: finance-leader
Related spec: `docs/capital-radar-evidence-decision-redesign.md`

## Why this plan exists

Jun's critique is correct: Capital Radar should not generate polished decision language from a thin layer of market metadata. It should gather enough real evidence, show what is known/stale/missing/conflicting, and make the reasoning process visible so Jun and WeiAI can decide together.

The goal is a forensic investment research cockpit: calm, source-backed, reviewable, and explicit about uncertainty.

## Product principles

1. **Evidence before decision** — no confident action language unless evidence coverage supports it.
2. **Freshness is first-class** — show when market, macro, SEC/company, news, and portfolio data were refreshed.
3. **Confidence requires a reason** — never show a naked confidence score; show why confidence is high/medium/low.
4. **Contradictions are visible** — disconfirming evidence belongs near the decision, not buried.
5. **Decision packets, not strategy blurbs** — every major holding/candidate decision needs evidence for, evidence against, unknowns, triggers, invalidation, permission, and next review.
6. **Progressive disclosure** — top page shows decision + key evidence; expanded views show methodology, source excerpts, raw fields, and model inputs.
7. **No oracle posture** — Capital Radar is a shared thinking table, not an automatic broker.

## Target homepage hierarchy

### 1. Data Refresh / Evidence Coverage strip
First visible strip. This replaces vague confidence with operational trust.

Show:
- Market prices last refreshed
- Macro/FRED last refreshed
- SEC filings/XBRL last refreshed
- News/source scan last refreshed
- YouTube/source-pool scan last refreshed if available
- Portfolio file last updated
- Evidence coverage: holdings / candidates / blocked packets
- Stale or missing blockers

This satisfies Jun's direct request: no generic #4/daily delta if it does not mean much; first show when web/data was refreshed.

### 2. Active Decision Table
The core shared-thinking table.

Columns:
- Question
- Current answer
- Evidence for
- Evidence against
- Unknowns
- Permission
- Trigger to change
- Confidence reason
- Last refreshed

Initial rows:
- Market regime: can we add risk or only hold?
- BMNR: research-only or add-review?
- TSNF: research-only or add-review?
- CONL: loss-minimization exit plan?
- TSLT: trim/rebound plan?
- Opportunity queue: which candidates deserve packets?

### 3. Market Regime Proof
Do not headline `risk-on but extended` alone. Show:
- Claim
- Supporting evidence
- Contradicting evidence
- Unknowns / stale fields
- Permission implication
- Trigger that changes route

### 4. Holdings Research Matrix
Each holding row should expose whether a real decision is possible:
- price/zone status
- permission
- thesis completeness
- valuation completeness
- filing/company evidence freshness
- macro/sector alignment
- risk/exposure status
- missing critical fields

### 5. Decision Packets
Expandable packets for the holdings that matter most now.

Packet sections:
- Decision question
- Current permission
- Base / bull / bear case
- Evidence for
- Evidence against
- Unknowns
- Contradictions
- Source freshness
- Invalidation
- Sizing/risk rule
- Review date / next data needed

### 6. Source Quality / Freshness Ledger
A visible audit trail:
- source name
- source type
- last pulled
- source as-of date
- latency
- credibility tier
- allowed use
- fields powered
- status: fresh / aging / stale / missing / conflicting

## Data stack priorities

### Market / technical
Collect:
- price, returns, 20/50/100/200D MAs, RSI/MACD/momentum, ATR/volatility, volume/relative volume, support/resistance, buy/trim/stop/review zones.

Cadence:
- intraday 5–15m while market open if feasible; otherwise daily with clear timestamp.

### Macro / liquidity / credit
Collect:
- FRED series observations, release dates, update dates, vintage/revision dates.
- 2Y, 10Y, curve, real yields if feasible, CPI/PCE/inflation expectations, HY OAS/credit stress, liquidity proxies.

Cadence:
- daily + release-day event refresh.

### SEC / company primary evidence
Collect:
- SEC submissions, latest 10-K/10-Q/8-K, XBRL companyfacts/concepts, revenue/margins/cash/debt/shares/capex/FCF proxies, filing links and accession metadata.

Cadence:
- 15–60m RSS/submission checks during business day for active holdings/candidates; nightly normalization.

### Valuation / expectation gap
Collect:
- market cap, EV, P/E, forward P/E when sourced, EV/sales, EV/EBITDA, FCF yield, historical bands, peer comps, growth-adjusted metrics, earnings date and revisions where available.

Cadence:
- daily for market-derived valuation; quarterly/event-driven for filing-derived fundamentals.

### News / catalysts / events
Collect:
- material headlines, source, timestamp, event type, ticker/theme, materiality 0–5, whether it supports/contradicts thesis.

Cadence:
- daily minimum; event-driven where adapters exist.

### Portfolio / risk
Collect:
- shares, market value, weight, cost basis if Jun provides it, theme concentration, beta/liquidity bucket, levered/decay exposure, drawdown scenarios.

Cadence:
- on portfolio update + daily price refresh.

## Evidence schema MVP

Use `DecisionEvidence` objects:

```json
{
  "id": "ticker-domain-claim-date",
  "ticker": "BMNR",
  "domain": "company_primary | valuation | market | macro | sector_theme | news_events | portfolio_risk | invalidation",
  "claim": "plain-language factual or interpretive claim",
  "direction": "supports | contradicts | neutral | unknown",
  "source": {
    "name": "SEC companyfacts",
    "url": "...",
    "type": "primary | market_data | macro | news | social_video | internal",
    "trustTier": "primary | high | medium | weak",
    "asOf": "datetime",
    "fetchedAt": "datetime"
  },
  "freshness": {
    "status": "fresh | aging | stale | missing",
    "staleAfterHours": 24
  },
  "decisionUse": ["thesis", "valuation", "risk", "permission"],
  "confidence": "high | medium | low",
  "requiresCrossCheck": true,
  "notes": "why this matters"
}
```

## Decision packet MVP

```json
{
  "ticker": "BMNR",
  "question": "Can BMNR move from research-only to add-review?",
  "currentPermission": "research_only",
  "answer": "Not enough evidence yet.",
  "evidenceFor": [],
  "evidenceAgainst": [],
  "unknowns": [],
  "conflicts": [],
  "actionConditions": [],
  "invalidation": [],
  "sizingRule": "blocked until evidence coverage complete",
  "confidence": {
    "level": "low",
    "reason": "primary thesis / valuation / dilution-risk evidence incomplete"
  },
  "lastRefreshed": {
    "marketData": null,
    "macro": null,
    "filings": null,
    "news": null,
    "portfolio": null
  }
}
```

## UI patterns to use

- Overview first, details on demand.
- Evidence cards grouped by filings, transcripts, news, macro, fundamentals, valuation, alternative data, analyst/sentiment notes.
- Contradiction panel near every thesis.
- Signal timeline: events, stale sources, thesis edits, review milestones.
- Status tags: Fresh, Stale, Conflicting, Unverified, Needs review, High variance.
- Decision-log pattern: context, decision, evidence, alternatives, consequences, review date.
- Comments/notes should anchor to evidence, not float as generic text.

## Anti-patterns to remove

- Strategy sentence before evidence.
- `AI confidence 87%` without rationale.
- Bloomberg-terminal density without hierarchy.
- Hidden contradictions.
- Freshness as tiny footer text only.
- Treating Yahoo price data as thesis evidence.
- Treating YouTube/news as authority rather than hypothesis sources.
- Calling 15 candidates “promotion review” when most are merely watch/research.

## Implementation sequence

### Phase 1 — Trust surface first
1. Restore visible first-screen command shell.
2. Build `data-refresh-state.json` from existing data-health/source ledger/report metadata.
3. Render homepage Data Refresh / Evidence Coverage strip.
4. Fail build if required freshness timestamps are missing.
5. Replace generic opportunity “promotion review” with stricter states.

### Phase 2 — Evidence model
1. Add `DecisionEvidence` schema and validator.
2. Convert current source-reliability ledger into field-level evidence rows.
3. Add `missing_critical_fields` blockers to action state.
4. Make authoritative action state consume evidence coverage, not just zone/route.

### Phase 3 — Primary source collectors
1. SEC submissions/companyfacts collector for holdings + priority candidates.
2. FRED macro release/update/vintage metadata collector.
3. News/catalyst materiality collector.
4. Earnings calendar source with explicit tentative/company-confirmed status.

### Phase 4 — Decision packets
1. BMNR packet.
2. TSNF packet.
3. CONL loss-minimization packet.
4. TSLT trim/rebound packet.
5. Dashboard Active Decision Table powered by packets.

### Phase 5 — Shared reasoning UI
1. Evidence-to-decision trace view: Claim → Evidence → Source → Freshness.
2. Contradiction panels.
3. Signal timeline / research memory.
4. Review notes and decision log.

## Immediate next build task

Start with Phase 1. It is the smallest high-trust move:
- show data freshness prominently,
- restore visible command shell,
- make source/evidence gaps block confident language,
- stop over-promoting candidates.

Only after that should BMNR/TSNF packet writing begin, because their conclusions should be generated from the new evidence packet system rather than patched in as more prose.
