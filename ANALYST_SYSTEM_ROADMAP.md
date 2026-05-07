# Capital Radar - Analyst System Roadmap

## Product ambition

Capital Radar is not a stock dashboard. It is an analyst system that reads market structure, portfolio exposure, macro plumbing, institutional reports, filings, valuation metadata, and news flow, then turns that into a visual investment blueprint.

The goal is to help answer:

- How is the market landscape changing?
- Which forces are flowing through the portfolio?
- Which holdings are helped or harmed?
- Which future holdings deserve research?
- Where is risk hidden or crowded?
- What evidence would upgrade, downgrade, trim, exit, or investigate a position?

## Analyst posture

The system should behave like:

- Market-cycle analyst
- Portfolio risk committee
- Research librarian
- Valuation analyst
- Macro strategist
- Visual report designer

It should not behave like:

- Automatic broker
- News summarizer
- Confident prediction machine
- Buy/sell signal bot

## Data/intelligence layers

### Layer 1 - Live market tape

Current status: active.

- Holdings prices
- Market values
- Portfolio weights
- Day / 5D / 1M / 3M moves
- SPY, QQQ, IWM, VIX, DXY, BTC, ETH, TSLA, COIN context

### Layer 2 - Macro plumbing

Current status: active public FRED series.

- 2Y / 10Y / 30Y Treasury yields
- 10Y breakeven inflation
- HY OAS
- IG OAS
- Fed funds

Next additions:

- Dollar liquidity proxies
- Real yields
- Financial conditions indices
- Yield curve history
- Treasury fiscal flows

### Layer 3 - Company fundamentals and valuation

Current status: next adapter.

Needed:

- Revenue growth
- Gross/operating margin
- FCF yield
- Forward P/E
- EV/EBITDA
- Market cap
- Debt/cash
- Earnings revisions
- Guidance changes
- Peer/history comparison

Sources:

- SEC companyfacts/submissions
- Provider fundamentals API if available
- Company filings and earnings releases

### Layer 4 - Institutional report ingestion

Current status: roadmap/manual ingestion.

Institutional sources to track:

- Federal Reserve / FRED
- BIS
- IMF
- World Bank
- US Treasury Fiscal Data
- OECD
- ECB / BOJ / PBOC / major central banks
- JPMorgan Guide to the Markets
- BlackRock Investment Institute
- Vanguard / Schwab / Fidelity outlooks
- S&P / MSCI / Morningstar public research where available

The system should extract:

- Key thesis
- Macro regime call
- Asset allocation implications
- Risks and counterevidence
- Charts/tables referenced
- Publication date
- Geography/asset class
- Confidence and source type

### Layer 5 - Market landscape metadata

This is the layer that turns data into strategic visual intelligence.

Metadata objects:

- Force: rates, liquidity, AI capex, credit, consumer, energy, dollar, crypto, regulation
- Direction: rising/falling/stable/mixed
- Intensity: 0-5
- Time horizon: daily/weekly/monthly/cycle
- Affected holdings
- Beneficiaries
- Vulnerable exposures
- Evidence
- Confidence

### Layer 6 - Investing blueprint

Every report should produce:

- One-page decision dashboard
- Portfolio exposure map
- Holdings health cards
- Market force map
- Valuation/expectation map
- Risk officer objections
- Opportunity scout list
- Final action signal table
- Evidence appendix

## Visualization roadmap

V1 active:

- Holding cards with sparklines
- Exposure bars
- Market tape table
- Rates/credit table
- Strategy posture
- Source registry

Next visuals:

1. Market force map
2. Portfolio exposure network
3. Holding health score heatmap
4. Rates/credit regime strip
5. Valuation vs momentum quadrant
6. Opportunity scout ranking board
7. Institutional report timeline
8. Macro force-to-holding impact matrix

## Deployment status

- GitHub repo: `jhyunkn/openclaw-capital-radar`
- Vercel: blocked until Vercel authentication/token is provided locally

## Stabilization sequence

1. Keep GitHub as source of truth.
2. Connect Vercel project to repo.
3. Verify `/api/capital-radar` works in production.
4. Add scheduled refresh/report generation.
5. Add fundamentals/valuation adapter.
6. Add news/filings scan.
7. Add institutional report ingestion pipeline.
8. Add chartbook export.
