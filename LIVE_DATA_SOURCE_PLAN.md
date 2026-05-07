# Capital Radar - Live Data Source Plan

## Current active V1 sources

The first live-data pass is active and no API keys are required.

### Prices / market tape

- Source: Yahoo Finance chart endpoint
- Access: public, unofficial endpoint
- Script: `live-data-adapter.cjs`
- Current coverage:
  - Holdings: MSFT, AMZN, CEG, META, TSLT, CONL, SPY, MA, BMNR, TSNF, NFLX
  - Market context: QQQ, IWM, ^VIX, DX-Y.NYB, BTC-USD, ETH-USD, TSLA, COIN
- Fields:
  - latest price
  - previous close based daily move
  - 5D / 1M / 3M performance
  - timestamp
  - currency / exchange when provided

### Rates / credit / liquidity

- Source: FRED CSV public endpoint
- Access: public, no API key
- Script: `live-data-adapter.cjs`
- Current coverage:
  - DGS2: US 2Y Treasury yield
  - DGS10: US 10Y Treasury yield
  - DGS30: US 30Y Treasury yield
  - T10YIE: 10Y breakeven inflation rate
  - BAMLH0A0HYM2: High yield option-adjusted spread
  - BAMLC0A0CM: Investment grade corporate OAS
  - DFF: Effective federal funds rate
- Fields:
  - latest value
  - latest date
  - source URL

## Generated live artifacts

Run from workspace root:

```powershell
node projects/financial-report/live-data-adapter.cjs
node projects/financial-report/validate-report.cjs projects/financial-report/data/report-state.live.json
node projects/financial-report/generate-daily-report.cjs projects/financial-report/data/report-state.live.json projects/financial-report/outputs/live-capital-radar.md
```

Outputs:

- `data/report-state.live.json` — live machine-readable report state.
- `outputs/live-capital-radar.md` — live Markdown report.

## Current status

Active now:

- Live holdings prices
- Live market values
- Live portfolio weights
- Live daily / 5D / 1M / 3M price movement
- Live market tape
- Live Treasury/rates/credit series
- Live source metadata and timestamps

Still missing:

- Cost basis / unrealized gain-loss
- Fundamentals: revenue growth, margins, earnings, balance sheet
- Valuation estimates: forward P/E, EV/EBITDA, FCF yield
- Earnings revisions / analyst estimates
- Material news and filings scan
- Official licensed market-data provider
- Chart rendering in HTML/PDF

## Reliability notes

- Yahoo chart endpoint is useful for prototype and personal research but is unofficial. For production-grade reliability, use a paid provider or broker/export feed.
- FRED public CSV is reliable for macro/rates/credit series, but release dates may lag trading-day reporting depending on series.
- The report should display `dataStatus`, `generatedAt`, source URLs, and data errors every run.

## Preferred next source stack

### Free/no-key first

1. Yahoo chart endpoint — prices and performance.
2. FRED CSV — rates, macro, credit proxies.
3. SEC companyfacts/submissions — filings and historical fundamentals.
4. Treasury Fiscal Data API — fiscal context.
5. Company investor relations RSS/pages — earnings releases.

### Better paid/credentialed path

1. Market data: Polygon, Tiingo, Financial Modeling Prep, Alpha Vantage premium, IEX Cloud alternative, or broker export.
2. Fundamentals/estimates: Financial Modeling Prep, Tiingo fundamentals, SimFin, FactSet/Capital IQ if available.
3. News: NewsAPI/Benzinga/Polygon news, SEC filings, company IR.

## Immediate next implementation step

Add a second adapter for fundamentals and valuation:

- Pull latest SEC companyfacts where available.
- Add optional provider hooks for forward estimates.
- Compute valuation confidence per ticker.
- Keep valuation claims separate from price facts when only partial data exists.
