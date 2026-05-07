# Capital Radar - Market Headquarters Research Synthesis

## Core direction

Capital Radar should evolve from a live financial report into a private Market Headquarters: a research desk, portfolio risk committee, macro map, evidence library, and decision workflow system.

The goal is decision discipline, not prediction. The system should improve capital allocation by making market changes visible, connecting them to holdings/future holdings, and forcing every action signal through evidence, confidence, and risk review.

## Principles

- Decision support, not prediction.
- Portfolio-first: market intelligence matters only if it affects holdings, watchlist, or risk posture.
- Separate facts, derived metrics, inference, assumptions, speculation, and action signals.
- Every material claim needs source/date/confidence.
- Quiet by default: surface material changes, not every headline.
- Human-in-the-loop: no automatic brokerage action.

## Recommended navigation

1. Command Center
   - Today's priorities
   - Market posture
   - Holding alerts
   - Risk flags
   - Action queue

2. Portfolio
   - Holding health cards
   - Exposure map
   - Concentration/risk buckets
   - Rebalance pressure

3. Market Map
   - Macro forces
   - Rates/credit/liquidity
   - AI/capex/energy/crypto/consumer/regulation forces
   - Force-to-holding impact matrix

4. Watchlist / Opportunity Scout
   - Candidate ranking
   - Thesis snapshots
   - Top 3 deep-dive queue
   - Rejected/archive list

5. Intelligence Feed
   - Filings
   - News
   - Earnings
   - Institutional reports
   - Central bank/fiscal releases
   - Materiality scoring

6. Research Library
   - Source registry
   - Reports
   - Filings
   - Evidence snippets
   - Extracted charts/tables
   - Thesis history

7. Risk Committee
   - Bear cases
   - Crowding
   - Correlation
   - Leverage/path dependency
   - Scenario stress tests

8. Automation / Settings
   - Source health
   - Refresh schedule
   - Data confidence
   - API/provider status
   - Alert thresholds

## Highest-value next modules

- Daily Priority Panel: what changed since yesterday, top macro signal, top holding update, top risk, action queue.
- Portfolio Exposure Network: holdings connected to forces such as AI capex, rates, crypto beta, consumer, power demand, ads, cloud, credit.
- Holding Health Heatmap: holdings x valuation, momentum, revisions, balance sheet, thesis, risk, confidence.
- Force-to-Holding Impact Matrix: rising rates, AI capex, credit spreads, crypto liquidity, consumer pressure mapped against holdings.
- Regime Strip: growth, inflation, rates, liquidity, credit, volatility, risk appetite.
- Valuation vs Momentum Quadrant: expensive/strong, expensive/weak, cheap/improving, cheap/value trap.
- Rebalance Pressure Board: position weight, risk bucket, signal, reason, human-review status.
- Institutional Report Timeline: Fed, BIS, IMF, JPM, BlackRock, Vanguard, OECD, ECB, BOJ, PBOC, Treasury.
- Evidence Drawer per card: source links, timestamps, excerpts, confidence.

## Automation architecture

1. Collectors
   - Market prices
   - Macro series
   - SEC filings
   - Company fundamentals
   - Earnings calendar/transcripts
   - Institutional reports
   - News/RSS

2. Normalizer
   - source
   - publishedAt
   - assetClass
   - tickersAffected
   - force
   - materiality
   - confidence
   - claimType
   - evidenceUrl

3. Entity linker
   - Map items to holdings, watchlist, sectors, forces, and risk buckets.

4. Scoring layer
   - Materiality 0-5
   - Thesis impact
   - Valuation impact
   - Risk impact
   - Confidence

5. Decision layer
   - HOLD
   - HOLD / WATCH
   - ADD WATCH
   - ADD CANDIDATE
   - TRIM WATCH
   - TRIM CANDIDATE
   - EXIT REVIEW
   - INVESTIGATE

6. Audit layer
   - Store source snapshots
   - Preserve previous scores
   - Show score changes over time
   - Never overwrite evidence silently

## Source universe

Macro/policy:

- FRED
- Federal Reserve
- US Treasury Fiscal Data
- BEA
- BLS
- Census
- CBO
- ECB
- BOJ
- BOE
- PBOC
- BIS
- IMF
- World Bank
- OECD

Markets/risk:

- Treasury yield curve
- HY OAS / IG OAS
- VIX
- DXY
- Breakeven inflation
- Real yields
- Financial conditions indices
- Credit spreads
- Liquidity proxies

Company/securities:

- SEC EDGAR submissions
- SEC companyfacts
- Company investor relations pages
- Earnings releases
- Earnings transcripts
- ETF/ETN issuer pages, especially levered/path-dependent products like TSLT/CONL

Institutional outlooks:

- JPMorgan Guide to the Markets
- BlackRock Investment Institute
- Vanguard outlooks
- Fidelity / Schwab commentary
- Morningstar public research
- MSCI / S&P public index research

## Roadmap

### V1 - Decision-ready web

- Side/top navigation
- Ticker drilldown pages
- Data freshness/status panel
- Material change log: since last report
- Health score heatmap
- Force-to-holding matrix
- Source/evidence drawer
- SEC/companyfacts adapter
- ETF/ETN issuer metadata
- Markdown report export

### V2 - Market HQ automation

- News/RSS/filing ingestion
- Institutional report ingestion
- Materiality scoring
- Watchlist candidate database
- Daily diff engine
- Score history
- Alert thresholds
- Scenario stress tests
- Research library with source excerpts
- Top 3 opportunity deep dives

### V3 - Intelligence operating system

- Multi-provider data stack
- Persistent decision journal
- Backtested assumptions/signals
- Chartbook/PDF/PPT export
- Automated daily briefing archive
- Human-review workflows
- Custom alert routing

## What to avoid

- Noisy trading cockpit
- Raw headline firehose
- Decorative charts without decision use
- Overconfident predictions
- Buy/sell language
- Hidden evidence
- Silent score changes
- Auto-trading behavior
