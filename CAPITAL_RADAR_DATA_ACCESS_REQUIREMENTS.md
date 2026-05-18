# Capital Radar Data / Analytics Access Requirements

Created: 2026-05-18
Owner: finance-leader
Purpose: Define what Finance-Leader needs to make Capital Radar sound, competent, dynamic, and continuously populated with correct market judgment.

## Operating Boundary

Capital Radar is research and decision support only. It does not execute trades, log into brokerage, promise returns, or act as an autonomous investment authority. The goal is to improve Jun's decision integrity with better data, structure, evidence, and reaction rules.

## Priority 1 — Must Have For Competent Daily Operation

### 1. Reliable market data provider
Needed for: live prices, historical OHLCV, volume, moving averages, ATR, RSI/MACD, relative strength, sector/index comparison.

Preferred options:
- Polygon.io
- Twelve Data
- Tiingo
- Alpha Vantage as fallback
- Finnhub as supplemental

Minimum fields:
- intraday/daily OHLCV;
- adjusted historical prices;
- current quote timestamps;
- index/ETF data for SPY, QQQ, IWM, VIX proxies;
- crypto proxy data for BTC/ETH if possible.

### 2. Fundamentals / valuation provider
Needed for: fair value, expectation gap, quality scoring, valuation compression/expansion risk.

Preferred options:
- Financial Modeling Prep
- Finnhub fundamentals
- Alpha Vantage fundamentals
- SEC/EDGAR filings adapter for official baseline

Minimum fields:
- revenue, EPS, margins, FCF, debt/cash;
- forward estimates if available;
- valuation multiples: P/E, forward P/E, EV/EBITDA, P/S, FCF yield;
- earnings calendar;
- guidance/revisions where available.

### 3. News / filings / events adapter
Needed for: materiality scoring, thesis change detection, catalysts, risk alerts.

Sources:
- SEC EDGAR filings;
- company IR/news pages;
- reputable financial news API/search;
- earnings calendar;
- macro calendar.

Minimum behavior:
- classify as noise / thesis confirmation / thesis damage / liquidity shift / regime shift / volatility gift;
- attach source URL;
- separate fact, inference, speculation, uncertainty.

### 4. Portfolio truth source
Needed for: correct weights, concentration, exposure, cost basis, realized/unrealized P/L, risk budget.

Safe options:
- manual CSV export from brokerage;
- screenshot-derived holdings imported by script;
- read-only portfolio export if Jun explicitly authorizes later.

Minimum fields:
- ticker;
- shares;
- cost basis if available;
- current market value;
- account allocation;
- cash balance if Jun wants portfolio-level allocation advice.

No trade permission required or desired.

## Priority 2 — Strong Upgrade Layer

### 5. Options / volatility data
Needed for: implied move, IV, options expectation, decay products, levered product risk.

Useful for:
- TSLT;
- CONL;
- speculative names;
- event-risk windows.

Minimum fields:
- IV / implied move;
- option chain snapshots;
- basic Greeks if available;
- expiration dates and liquidity.

### 6. Relative strength / sector map
Needed for: market values across themes, not isolated tickers.

Minimum fields:
- sector ETFs;
- industry comparables;
- SPY/QQQ/IWM relative performance;
- breadth proxy if available.

### 7. Community / narrative source ingestion
Needed for: hypothesis generation and method-learning, not authority.

Sources Jun already named:
- Jungernaut;
- mijooeun;
- JUTOPIA;
- Graham Stephan;
- kimsstock;
- Futures Now;
- Reddit/forums/blogs/podcasts as hypothesis sources.

Rules:
- extract claims and methods;
- identify incentives/bias;
- cross-check before posture change;
- archive useful methods in analytic-learning notes.

## Priority 3 — Institutional Depth

### 8. Macro / liquidity / credit dashboard
Needed for regime classification.

Current base: FRED rates/credit CSV.

Upgrade fields:
- Treasury curve;
- breakevens/inflation expectations;
- credit spreads;
- dollar index;
- liquidity proxies;
- financial conditions;
- Fed calendar / policy events.

### 9. Alert engine infrastructure
Needed for 24/7 dynamic operation without noise.

Trigger types:
- price crosses predefined zone;
- volatility spike;
- thesis event;
- abnormal volume;
- regime shift;
- portfolio concentration/risk change;
- opportunity pullback into prepared add zone.

Alerts should not spam. Escalate only if actionable.

### 10. State database
Needed to preserve previous/current/next states and probability shifts.

Minimum objects:
- holdings;
- candidates;
- macro regime;
- market value map;
- claim ledger;
- source reliability;
- state transitions;
- archived decisions.

## What Jun Can Provide Immediately

1. Preferred data-provider API keys, if he has or wants to subscribe to one.
2. Brokerage holdings CSV/screenshot exports — read-only, no trade permissions.
3. Confirmation of current holdings/cost basis/cash balance if he wants allocation-aware recommendations.
4. Priority universe: should Capital Radar first perfect current holdings, candidate discovery, macro regime, or all three in parallel?
5. Any ChatGPT-built memo/framework outputs that should be converted into durable Capital Radar rules.

## My Recommendation

Start with this stack:

1. Polygon.io or Twelve Data for market data.
2. Financial Modeling Prep for fundamentals/valuation.
3. SEC EDGAR official filings adapter.
4. Manual brokerage CSV/screenshot import for portfolio truth.
5. Add news/community ingestion after the internal evidence engine is stable.

This gives Capital Radar enough factual grounding to move from dashboard prototype to real analyst system without relying on vibes.
