# Risk Lab

Capital Radar's risk and validation desk. Capital Radar decides *what* to do; the risk lab measures *how much it can hurt* and *whether the numbers hold up against history*.

## What it produces

| Engine | Answers |
|---|---|
| `market_history.py` | Where 10 market gauges rank against their full history, and what the S&P 500 did after similar readings |
| `market_brief.py` | S&P 500 floor/ceiling levels, sector leadership after past sell-offs, momentum screen of 65 names |
| `price_outlook.py` | 1/3/12-month likely price ranges per stock, "if the S&P follows history" path, analyst targets |
| `analyze_portfolio.py` | Holdings, exposures, crisis replays, exit rules, leveraged-ETF decay, alerts |
| `risk_engine.py` | 24-factor risk model, six VaR methods, 500-day VaR backtest (Kupiec, Christoffersen, Basel light), exit-rule backtest since 2019, option Greeks, organic limits, P&L attribution |
| `today.py` | Tax lots, year-end tax window, trading record, decision queue |
| `make_public.py` | Strips everything personal and writes the public datasets |

## Public vs private

This repository is public, so the lab is split:

- **Committed, market-wide only:** `outputs/risk-lab/*.json`, built by `run_public.py` in the operating loop (`risk-lab` stage in `config/build-pipeline.json`).
- **Never committed (git-ignored):** `risk-lab/private/` (tax lots, closed trades, other accounts, option Greeks, the VaR forecast ledger) and `risk-lab/out-private/` (every output with account data). `make_public.py` runs a leak check before writing.

Positions come from Capital Radar's own Robinhood sync (`outputs/robinhood-positions.json`) through `build_positions.py`. Holdings the sync doesn't cover go in `private/overrides.json`.

## Running

```bash
pip install numpy
python3 risk-lab/run_public.py   # market-wide stage, what CI runs
python3 risk-lab/run_all.py      # everything, on your machine (needs private/ files for tax and performance)
```

The stage exits 0 with `RISK_LAB_SKIP` if numpy is missing, so it never blocks the rest of the pipeline.

## Dashboards

`pages/war-room.html` (private, account-level) and `pages/market-pulse.html` (public, market-only) are the Claude dashboard pages. Their data is uploaded from `out-private/` and `outputs/risk-lab/` respectively.

## Method notes and limits

Free Yahoo Finance and FRED data, ETF-proxy factors rather than a commercial factor model, and a forward VaR ledger that only started in November 2026. Price ranges assume symmetric volatility, so crash risk is understated. Analysis, not investment advice.
