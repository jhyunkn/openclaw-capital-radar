# Asset-Class Data Requirements

## Purpose

Capital Radar is not useful if asset-class reads are generated from labels without data.

This document upgrades Mission 3 from a coverage audit into a hard data-foundation mission. Every timeless asset class must have required datasets, declared sources, freshness rules, confidence labels, and generator ownership before it can contribute to the Macro section.

## Non-negotiable rule

No asset-class conclusion may appear in Macro unless the system can show:

```text
asset class
-> required dataset coverage
-> source of each dataset
-> freshness of each dataset
-> signal method
-> confidence level
-> missing evidence
-> portfolio implication
```

A label such as `supportive`, `defensive`, `extended`, or `fragile` is invalid unless it is derived from the required dataset chain.

## Required confidence labels

| Label | Meaning | Allowed in Macro? |
|---|---|---|
| AUTH | Primary/official source available and fresh | Yes |
| VERIFIED_PROXY | Market proxy available and cross-checked | Yes, but must be labeled proxy |
| PARTIAL | Some required datasets available, others missing | Yes, but cannot drive final regime alone |
| STALE | Dataset exists but freshness window failed | No, except as stale warning |
| MISSING | Required dataset absent | No |
| CONFLICTED | Sources disagree materially | No, except as conflict warning |

## Required source hierarchy

1. Official public source where available.
2. Free institutional source where official public source is unavailable.
3. Market proxy when true dataset is unavailable.
4. Manual placeholder only if explicitly labeled `MISSING` or `MANUAL_REQUIRED`.

## Foundation sources

These are the first source families to support before the dashboard tries to produce a complete Macro read.

| Source family | Use | Notes |
|---|---|---|
| FRED / St. Louis Fed | Treasury yields, policy rates, money supply, reserves, credit spreads, volatility indexes where available | Good first backbone for Money, Duration, Credit, Dollar, and Volatility |
| U.S. Treasury FiscalData | Treasury cash balance / government cash-flow context | Useful for liquidity context; source endpoint availability must be validated in code |
| SEC EDGAR APIs | Company facts, filings, fundamentals, earnings/margins where available | Useful for equity and ticker-specific fundamentals |
| CFTC COT | Futures positioning for commodities, rates, FX, metals, energy | Useful as confirming/context dataset, not core price source |
| Market price provider | ETFs, indexes, commodities, FX, BTC, gold, sector baskets | Required for tradable proxies; provider must be explicitly declared |
| Manual research layer | Cap rates, rent growth, sector valuation, private-credit stress, central-bank gold purchases | Use only when automated source is not yet implemented |

## Asset-class requirements

## 1. Money / Cash

Primary question:

```text
Is capital being paid to wait, or is capital being forced out on the risk curve?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| 3-month T-bill yield | CORE | FRED / Treasury | REQUIRED |
| Effective fed funds rate | CORE | FRED / Federal Reserve | REQUIRED |
| CPI inflation | CORE | FRED / BLS | REQUIRED |
| Real cash yield | DERIVED CORE | T-bill minus CPI | REQUIRED |
| Money-market fund assets | CORE | FRED / ICI if available | REQUIRED |
| Bank reserves | CONFIRMING | FRED / Federal Reserve | REQUIRED |
| M2 / broad money | CONFIRMING | FRED | REQUIRED |
| Treasury cash balance / TGA | CONTEXT | Treasury FiscalData | REQUIRED |
| Reverse repo | CONTEXT | FRED / Federal Reserve | REQUIRED |
| Stablecoin supply | CONTEXT / MODERN PROXY | crypto data provider | OPTIONAL BUT USEFUL |

Required generator:

```text
scripts/generate-money-cash-state.cjs
outputs/money-cash-state.json
```

## 2. Sovereign Bonds / Duration

Primary question:

```text
Is the price of time helping or punishing long-duration claims?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| 2-year Treasury yield | CORE | FRED / Treasury | REQUIRED |
| 10-year Treasury yield | CORE | FRED / Treasury | REQUIRED |
| 10-year TIPS real yield | CORE | FRED / Treasury | REQUIRED |
| 2s10s curve | DERIVED CORE | 10Y minus 2Y | REQUIRED |
| 3m10y curve | DERIVED CORE | 10Y minus 3M | REQUIRED |
| 5y5y inflation expectations or breakevens | CORE | FRED | REQUIRED |
| MOVE index | CONFIRMING | market data provider / FRED if available | REQUIRED |
| TLT price trend | PROXY | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-duration-state.cjs
outputs/duration-state.json
```

## 3. Credit

Primary question:

```text
Does the market trust borrowers broadly enough for risk to broaden?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| High-yield OAS | CORE | FRED | REQUIRED |
| Investment-grade OAS | CORE | FRED | REQUIRED |
| CCC spread or weakest-credit spread | CONFIRMING | FRED / ICE BofA series | REQUIRED |
| Default rate | CORE | FRED / Moody's / S&P source if available | REQUIRED |
| Bank lending standards | CORE | FRED / Senior Loan Officer Survey | REQUIRED |
| Bank credit growth | CORE | FRED | REQUIRED |
| HYG price trend | PROXY | market price provider | REQUIRED |
| LQD price trend | PROXY | market price provider | REQUIRED |
| Private credit / leveraged loan stress | CONTEXT | manual or external provider | MANUAL_REQUIRED |

Required generator:

```text
scripts/generate-credit-state.cjs
outputs/credit-state.json
```

## 4. Equity Ownership

Primary question:

```text
Is capital broadly buying productive enterprise or only a narrow group of winners?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| SPX price trend | CORE | market price provider | REQUIRED |
| Equal-weight SPX vs cap-weight SPX | CORE | market price provider | REQUIRED |
| % of stocks above 50/200 DMA | CORE | market breadth source / calculated universe | REQUIRED |
| Advance/decline line | CORE | market breadth source | REQUIRED |
| Earnings revisions | CORE | earnings data provider / manual until automated | MANUAL_REQUIRED |
| Margin trend | CORE | SEC / index fundamentals source | REQUIRED |
| Valuation multiple | CORE | index fundamentals source / manual until automated | REQUIRED |
| Sector participation | CONFIRMING | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-equity-ownership-state.cjs
outputs/equity-ownership-state.json
```

## 5. Innovation / Growth Themes

Primary question:

```text
Is the market rationally underwriting future growth, or overpaying for narrative duration?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| QQQ price trend | CORE / PROXY | market price provider | REQUIRED |
| Growth vs value relative strength | CORE | market price provider | REQUIRED |
| AI / semiconductor basket relative strength | CONTEXT | market price provider | REQUIRED |
| Revenue growth for leaders | CORE | SEC EDGAR / company facts | REQUIRED |
| Earnings revision breadth | CORE | earnings data provider / manual until automated | MANUAL_REQUIRED |
| Valuation premium vs market | CORE | fundamentals provider / manual until automated | REQUIRED |
| Concentration among leaders | CORE | holdings/index data provider / calculated | REQUIRED |
| Fund flows | CONFIRMING | ETF flow source / manual until automated | MANUAL_REQUIRED |
| Capex cycle | CONTEXT | SEC EDGAR / company facts | REQUIRED |

Required generator:

```text
scripts/generate-innovation-themes-state.cjs
outputs/innovation-themes-state.json
```

## 6. Real Assets

Primary question:

```text
Does capital prefer tangible collateral and income durability, or is real collateral being repriced by rates and leverage?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| REIT index / VNQ price trend | PROXY | market price provider | REQUIRED |
| Mortgage rates | CORE | FRED | REQUIRED |
| Cap rates | CORE | manual / real-estate source | MANUAL_REQUIRED |
| Rent growth | CORE | manual / real-estate source | MANUAL_REQUIRED |
| Vacancy / occupancy | CORE | manual / real-estate source | MANUAL_REQUIRED |
| Construction costs | CONFIRMING | FRED / BLS | REQUIRED |
| Property price index | CONTEXT | FRED / Case-Shiller / FHFA | REQUIRED |
| Infrastructure / utility proxy | CONFIRMING | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-real-assets-state.cjs
outputs/real-assets-state.json
```

## 7. Commodities / Inputs

Primary question:

```text
Is the physical economy imposing scarcity constraints on financial claims?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| Oil price | CORE | EIA / market price provider | REQUIRED |
| Natural gas price | CORE | EIA / market price provider | REQUIRED |
| Copper price | CORE | market price provider | REQUIRED |
| Broad commodity index | CORE | market price provider | REQUIRED |
| Grains / food basket | CONFIRMING | market price provider | REQUIRED |
| Shipping rates | CONFIRMING | manual / external source | MANUAL_REQUIRED |
| Inventories | CORE | EIA / commodity source | REQUIRED |
| Futures curve / backwardation-contango | CORE | market data provider | REQUIRED |
| CFTC positioning | CONTEXT | CFTC COT | REQUIRED |

Required generator:

```text
scripts/generate-commodities-inputs-state.cjs
outputs/commodities-inputs-state.json
```

## 8. Monetary Alternatives

Primary question:

```text
Is capital questioning sovereign money, or merely reaching for speculative beta?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| Gold price | CORE | market price provider | REQUIRED |
| Silver price | CONFIRMING | market price provider | REQUIRED |
| Bitcoin price | CORE / MODERN PROXY | market price / crypto provider | REQUIRED |
| Real yields | CORE | FRED / Treasury | REQUIRED |
| Dollar strength | CORE | market price provider | REQUIRED |
| Central-bank gold purchases | CONFIRMING | manual / WGC source | MANUAL_REQUIRED |
| Stablecoin supply | CONTEXT | crypto data provider | REQUIRED |
| Gold/BTC correlation to risk assets | DERIVED CONFIRMING | calculated | REQUIRED |

Required generator:

```text
scripts/generate-monetary-alternatives-state.cjs
outputs/monetary-alternatives-state.json
```

## 9. FX / Dollar

Primary question:

```text
Is the dollar easing global liquidity or tightening global financial conditions?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| DXY | CORE | market price provider | REQUIRED |
| EUR/USD | CORE | market price provider | REQUIRED |
| USD/JPY | CORE | market price provider | REQUIRED |
| EM FX basket | CORE | market price provider | REQUIRED |
| Dollar funding stress | CORE | FRED / Fed / market source | REQUIRED |
| Cross-currency basis | CONFIRMING | manual / external source | MANUAL_REQUIRED |
| Global liquidity proxy | CONFIRMING | FRED / derived | REQUIRED |
| Carry-trade proxy | CONTEXT | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-fx-dollar-state.cjs
outputs/fx-dollar-state.json
```

## 10. Volatility / Insurance

Primary question:

```text
Is the market underpricing or overpricing disorder?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| VIX | CORE | FRED / market source | REQUIRED |
| MOVE | CORE | market source | REQUIRED |
| Skew | CORE | market source | REQUIRED |
| Put/call ratio | CONFIRMING | market source | REQUIRED |
| Realized volatility | CORE | calculated from price data | REQUIRED |
| Implied vs realized volatility spread | DERIVED CORE | calculated | REQUIRED |
| Credit hedges / CDS proxy | CONFIRMING | market source / credit spreads proxy | REQUIRED |
| Volatility term structure | CORE | market source | REQUIRED |

Required generator:

```text
scripts/generate-volatility-insurance-state.cjs
outputs/volatility-insurance-state.json
```

## Implementation sequence

The correct order is:

```text
1. Create source registry.
2. Create asset-class dataset requirement registry.
3. Create data-fetch utilities.
4. Create one generator per asset class.
5. Create an asset-class coverage validator.
6. Only then allow Macro to consume the asset-class matrix.
```

## Required new files

```text
config/asset-class-data-requirements.json
config/data-source-registry.json
scripts/lib/fetch-fred.cjs
scripts/lib/fetch-market-price.cjs
scripts/lib/validate-dataset-freshness.cjs
scripts/generate-asset-class-coverage-state.cjs
outputs/asset-class-coverage-state.json
```

## Macro gate

Macro must refuse to render a complete Asset-Class Research Matrix unless this condition is true:

```text
all asset classes have at least PARTIAL coverage
all CORE datasets are either AUTH, VERIFIED_PROXY, or explicitly marked MISSING
no stale dataset is silently used
portfolio implication includes missing-evidence caveat
```

Until then, the Macro label must be:

```text
Asset-Class Research Matrix: PARTIAL DATA COVERAGE
```
