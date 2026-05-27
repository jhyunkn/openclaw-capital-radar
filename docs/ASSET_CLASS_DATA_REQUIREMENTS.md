# Asset-Class Data Requirements

## Purpose

Capital Radar is not useful if asset-class reads are generated from labels without data.

This document upgrades Mission 3 from a coverage audit into a hard data-foundation mission. Every timeless asset class must have required datasets, declared sources, freshness rules, confidence labels, and generator ownership before it can contribute to the Macro section.

## Review refinements

Mission 3 has been refined after review with five changes:

1. `Innovation / Growth Themes` is renamed to `Long-Duration Growth / Innovation Optionality` because it is not a standalone asset class in the same sense as cash, credit, or commodities. It is a duration-sensitive future-cash-flow and narrative-optionality complex.
2. High-value missing datasets are added: term premium, real fed funds rate, financial conditions, liquidity impulse, equity risk premium, credit spread momentum, global liquidity proxy, VIX term structure, MOVE/rates volatility, gold/BTC correlations, oil/copper inventory context.
3. Datasets are split between Phase 1 Core Macro Spine and Phase 2 Expansion / manual-hard-to-automate coverage.
4. `market_price_provider` is explicitly marked as an unresolved dependency. No implementation may silently assume a provider.
5. The Macro gate is now tiered: PARTIAL / CORE / FULL.

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
| MANUAL_REQUIRED | Dataset likely needs manual or paid research source | No automated conclusion unless manual value is provided and fresh |
| UNRESOLVED_DEPENDENCY | Source family exists but provider is not yet selected | No automated conclusion |

## Macro gate

Macro must distinguish three levels of asset-class coverage.

### PARTIAL

Allowed when:

- all asset classes are declared
- all required datasets are declared
- source families are declared
- freshness rules are declared
- missing evidence is visible

Required label:

```text
Asset-Class Research Matrix: PARTIAL DATA COVERAGE
```

Use:

- allowed for partial reads
- must include missing-evidence caveat
- cannot claim full macro completeness

### CORE

Allowed when the Core Macro Spine has at least partial validated coverage:

```text
Money / Cash
Sovereign Bonds / Duration
Credit
Equity Ownership
FX / Dollar
Volatility / Insurance
```

Required label:

```text
Asset-Class Research Matrix: CORE MACRO SPINE COVERAGE
```

Use:

- allowed for a serious first macro landscape read
- still cannot claim full asset-class completeness

### FULL

Allowed only when all 10 asset classes have at least partial validated coverage and no stale core data is silently used.

Required label:

```text
Asset-Class Research Matrix: FULL DATA COVERAGE
```

Use:

- allowed for full asset-class matrix claims
- still must disclose missing or proxy evidence

## Required source hierarchy

1. Official public source where available.
2. Free institutional source where official public source is unavailable.
3. Market proxy when true dataset is unavailable.
4. Manual placeholder only if explicitly labeled `MISSING`, `MANUAL_REQUIRED`, or `UNRESOLVED_DEPENDENCY`.

## Foundation sources

These are the first source families to support before the dashboard tries to produce a complete Macro read.

| Source family | Use | Notes |
|---|---|---|
| FRED / St. Louis Fed | Treasury yields, policy rates, money supply, reserves, credit spreads, inflation, financial conditions, and selected volatility data | First macro backbone |
| Federal Reserve | Policy rates, balance sheet, reserves, lending standards, bank credit, financial conditions | Often reachable through FRED mirrors |
| BLS | CPI, PPI, labor, construction costs | Often reachable through FRED mirrors |
| BEA | GDP, profits, income, macro growth context | Later source |
| EIA | Oil, natural gas, energy inventories | Important for commodities |
| U.S. Treasury FiscalData | Treasury cash balance, bill supply, debt issuance, fiscal/liquidity context | Useful for liquidity and duration supply pressure |
| SEC EDGAR APIs | Company facts, filings, fundamentals, revenue, margins, capex | Useful for equity and growth fundamentals |
| CFTC COT | Futures positioning for commodities, rates, FX, metals, energy | Context/confirming source |
| FHFA / Case-Shiller | Property price and housing-cycle context | Useful for real assets |
| Market price provider | ETFs, indexes, commodities, FX, BTC, gold, sector baskets | Required but unresolved dependency |
| Crypto liquidity provider | BTC, stablecoin supply, crypto liquidity | Required but unresolved dependency |
| ETF / index holdings provider | concentration, sector weights, basket construction | Required but unresolved dependency/manual |
| Manual research layer | cap rates, rent growth, private-credit stress, central-bank gold purchases, cross-currency basis, shipping rates, fund flows, earnings revisions | Phase 2/manual until automated |
| Derived calculation | real yields, curves, momentum, correlations, risk premia, liquidity impulse | Internal calculation from declared inputs |

## Phase policy

### Phase 1 — Core Macro Spine

These should be implemented first because they answer whether capital is being paid to wait, forced into risk, validated by credit, supported by productive ownership, tightened by dollar pressure, or protected against disorder.

```text
Money / Cash
Sovereign Bonds / Duration
Credit
Equity Ownership
FX / Dollar
Volatility / Insurance
```

### Phase 2 — Expansion Layers

These deepen the macro read after the core spine exists.

```text
Long-Duration Growth / Innovation Optionality
Commodities / Inputs
Real Assets
Monetary Alternatives
```

### Phase 2 / Manual-hard datasets

These are valuable but should not block the first implementation:

```text
cap rates
rent growth
vacancy / occupancy
private credit stress
central-bank gold purchases
cross-currency basis
shipping rates
fund flows
earnings revisions
venture funding cycle
CRE refinancing maturities
China credit impulse
geopolitical risk premium
```

## Asset-class requirements

## 1. Money / Cash

Phase: 1 Core Macro Spine

Primary question:

```text
Is capital being paid to wait, or is capital being forced out on the risk curve?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| 3-month T-bill yield | CORE | FRED / Treasury | REQUIRED |
| Effective fed funds rate | CORE | FRED / Federal Reserve | REQUIRED |
| Real fed funds rate | CORE | derived | REQUIRED |
| CPI inflation | CORE | FRED / BLS | REQUIRED |
| Real cash yield | DERIVED CORE | T-bill minus CPI | REQUIRED |
| Money-market fund assets | CORE | FRED / ICI if available | REQUIRED |
| Bank reserves | CONFIRMING | FRED / Federal Reserve | REQUIRED |
| M2 / broad money | CONFIRMING | FRED | REQUIRED |
| Financial conditions index | CONFIRMING | FRED / Federal Reserve | REQUIRED |
| Liquidity impulse | DERIVED CONFIRMING | derived | REQUIRED |
| Treasury cash balance / TGA | CONTEXT | Treasury FiscalData | REQUIRED |
| Reverse repo | CONTEXT | FRED / Federal Reserve | REQUIRED |
| Treasury bill supply | CONTEXT | Treasury FiscalData | REQUIRED |
| SOFR | CONTEXT | FRED / Federal Reserve | REQUIRED |
| Stablecoin supply | CONTEXT / MODERN PROXY | crypto liquidity provider | PHASE 2 |

Required generator:

```text
scripts/generate-money-cash-state.cjs
outputs/money-cash-state.json
```

## 2. Sovereign Bonds / Duration

Phase: 1 Core Macro Spine

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
| Treasury term premium | CORE | FRED | REQUIRED |
| 2s10s curve | DERIVED CORE | 10Y minus 2Y | REQUIRED |
| 3m10y curve | DERIVED CORE | 10Y minus 3M | REQUIRED |
| 5y5y inflation expectations or breakevens | CORE | FRED | REQUIRED |
| Treasury issuance / supply pressure | CONTEXT | Treasury FiscalData | REQUIRED |
| Fiscal deficit pressure | CONTEXT | Treasury FiscalData | REQUIRED |
| MOVE index | CONFIRMING | market price provider / FRED if available | REQUIRED |
| TLT price trend | PROXY | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-duration-state.cjs
outputs/duration-state.json
```

## 3. Credit

Phase: 1 Core Macro Spine

Primary question:

```text
Does the market trust borrowers broadly enough for risk to broaden?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| High-yield OAS | CORE | FRED | REQUIRED |
| High-yield spread momentum | DERIVED CORE | derived | REQUIRED |
| Investment-grade OAS | CORE | FRED | REQUIRED |
| Investment-grade spread momentum | DERIVED CORE | derived | REQUIRED |
| CCC spread or weakest-credit spread | CONFIRMING | FRED / ICE BofA series | REQUIRED |
| Default rate | CORE | FRED / Moody's / S&P source if available | MANUAL_REQUIRED until source validated |
| Loan delinquency rates | CONFIRMING | FRED | REQUIRED |
| Bank charge-offs | CONFIRMING | FRED | REQUIRED |
| Bank lending standards | CORE | FRED / Senior Loan Officer Survey | REQUIRED |
| Bank credit growth | CORE | FRED | REQUIRED |
| HYG price trend | PROXY | market price provider | REQUIRED |
| LQD price trend | PROXY | market price provider | REQUIRED |
| Private credit / leveraged loan stress | CONTEXT | manual or external provider | PHASE 2 / MANUAL_REQUIRED |

Required generator:

```text
scripts/generate-credit-state.cjs
outputs/credit-state.json
```

## 4. Equity Ownership

Phase: 1 Core Macro Spine

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
| Earnings yield vs bond yield | DERIVED CORE | derived | REQUIRED |
| Equity risk premium | CORE | derived | REQUIRED |
| Free-cash-flow yield | CORE | manual/fundamental source | REQUIRED but provider unresolved |
| Profit-margin cycle | CORE | SEC / index fundamentals source | REQUIRED |
| Earnings revisions | CORE | earnings data provider / manual until automated | PHASE 2 / MANUAL_REQUIRED |
| Valuation multiple | CORE | index fundamentals source / manual until automated | REQUIRED |
| Sector participation | CONFIRMING | market price provider | REQUIRED |
| IPO / secondary issuance | CONTEXT | manual / market data provider | PHASE 2 |

Required generator:

```text
scripts/generate-equity-ownership-state.cjs
outputs/equity-ownership-state.json
```

## 5. Long-Duration Growth / Innovation Optionality

Phase: 2 Expansion

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
| Price/sales premium | CORE | fundamentals source / manual until automated | REQUIRED |
| Forward revenue revision trend | CORE | earnings data provider / manual until automated | REQUIRED |
| Revenue growth for leaders | CORE | SEC EDGAR / company facts | REQUIRED |
| Earnings revision breadth | CORE | earnings data provider / manual until automated | PHASE 2 / MANUAL_REQUIRED |
| Valuation premium vs market | CORE | fundamentals provider / manual until automated | REQUIRED |
| Concentration among leaders | CORE | ETF/index holdings provider / calculated | REQUIRED |
| Unprofitable tech participation | CONFIRMING | market price provider | REQUIRED |
| Venture funding cycle | CONTEXT | manual/external source | PHASE 2 / MANUAL_REQUIRED |
| Capex cycle | CONTEXT | SEC EDGAR / company facts | REQUIRED |

Required generator:

```text
scripts/generate-long-duration-growth-innovation-state.cjs
outputs/long-duration-growth-innovation-state.json
```

## 6. Real Assets

Phase: 2 Expansion

Primary question:

```text
Does capital prefer tangible collateral and income durability, or is real collateral being repriced by rates and leverage?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| REIT index / VNQ price trend | PROXY | market price provider | REQUIRED |
| Public REIT sector split | CONFIRMING | ETF/index holdings provider | REQUIRED |
| Mortgage rates | CORE | FRED | REQUIRED |
| Debt-service coverage | CORE | manual/real-estate source | PHASE 2 / MANUAL_REQUIRED |
| CRE refinancing maturities | CONTEXT | manual/real-estate source | PHASE 2 / MANUAL_REQUIRED |
| Cap rates | CORE | manual / real-estate source | PHASE 2 / MANUAL_REQUIRED |
| Rent growth | CORE | manual / real-estate source | PHASE 2 / MANUAL_REQUIRED |
| Vacancy / occupancy | CORE | manual / real-estate source | PHASE 2 / MANUAL_REQUIRED |
| Construction costs | CONFIRMING | FRED / BLS | REQUIRED |
| Property price index | CONTEXT | FRED / Case-Shiller / FHFA | REQUIRED |
| Infrastructure / utility proxy | CONFIRMING | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-real-assets-state.cjs
outputs/real-assets-state.json
```

## 7. Commodities / Inputs

Phase: 2 Expansion

Primary question:

```text
Is the physical economy imposing scarcity constraints on financial claims?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| Oil price | CORE | EIA / market price provider | REQUIRED |
| Oil inventories | CORE | EIA | REQUIRED |
| Natural gas price | CORE | EIA / market price provider | REQUIRED |
| Copper price | CORE | market price provider | REQUIRED |
| Copper inventories | CONFIRMING | manual/external source | PHASE 2 / MANUAL_REQUIRED |
| Broad commodity index | CORE | market price provider | REQUIRED |
| PMI / industrial demand | CONFIRMING | manual/free macro source | REQUIRED but provider unresolved |
| China credit impulse | CONTEXT | manual/external source | PHASE 2 / MANUAL_REQUIRED |
| Geopolitical risk premium | CONTEXT | manual/external source | PHASE 2 / MANUAL_REQUIRED |
| Energy crack spreads | CONFIRMING | market price provider | REQUIRED |
| Grains / food basket | CONFIRMING | market price provider | REQUIRED |
| Shipping rates | CONFIRMING | manual / external source | PHASE 2 / MANUAL_REQUIRED |
| Futures curve / backwardation-contango | CORE | market data provider | REQUIRED |
| CFTC positioning | CONTEXT | CFTC COT | REQUIRED |

Required generator:

```text
scripts/generate-commodities-inputs-state.cjs
outputs/commodities-inputs-state.json
```

## 8. Monetary Alternatives

Phase: 2 Expansion

Primary question:

```text
Is capital questioning sovereign money, or merely reaching for speculative beta?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| Gold price | CORE | market price provider | REQUIRED |
| Gold vs real yields | DERIVED CORE | derived | REQUIRED |
| Gold vs dollar | DERIVED CORE | derived | REQUIRED |
| Silver price | CONFIRMING | market price provider | REQUIRED |
| Bitcoin price | CORE / MODERN PROXY | market price / crypto provider | REQUIRED |
| BTC vs Nasdaq correlation | DERIVED CONFIRMING | calculated | REQUIRED |
| BTC vs global liquidity | DERIVED CONFIRMING | calculated | REQUIRED |
| Real yields | CORE | FRED / Treasury | REQUIRED |
| Dollar strength | CORE | market price provider | REQUIRED |
| Central-bank gold purchases | CONFIRMING | manual / WGC source | PHASE 2 / MANUAL_REQUIRED |
| Stablecoin supply | CONTEXT | crypto data provider | REQUIRED |
| Gold/BTC correlation to risk assets | DERIVED CONFIRMING | calculated | REQUIRED |

Required generator:

```text
scripts/generate-monetary-alternatives-state.cjs
outputs/monetary-alternatives-state.json
```

## 9. FX / Dollar

Phase: 1 Core Macro Spine

Primary question:

```text
Is the dollar easing global liquidity or tightening global financial conditions?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| DXY | CORE | market price provider | REQUIRED |
| Real effective exchange rate | CONFIRMING | FRED / BIS source | REQUIRED |
| EUR/USD | CORE | market price provider | REQUIRED |
| USD/JPY | CORE | market price provider | REQUIRED |
| Yen carry stress | CONTEXT | derived | REQUIRED |
| EM FX basket | CORE | market price provider | REQUIRED |
| Dollar funding stress | CORE | FRED / Fed / market source | REQUIRED |
| Cross-currency basis | CONFIRMING | manual / external source | PHASE 2 / MANUAL_REQUIRED |
| Global liquidity proxy | CONFIRMING | FRED / derived | REQUIRED |
| Carry-trade proxy | CONTEXT | market price provider | REQUIRED |

Required generator:

```text
scripts/generate-fx-dollar-state.cjs
outputs/fx-dollar-state.json
```

## 10. Volatility / Insurance

Phase: 1 Core Macro Spine

Primary question:

```text
Is the market underpricing or overpricing disorder?
```

Required datasets:

| Dataset | Required tier | First acceptable source family | Initial status |
|---|---|---|---|
| VIX | CORE | FRED / market source | REQUIRED |
| VVIX | CONFIRMING | market source | REQUIRED |
| MOVE | CORE | market source | REQUIRED |
| Skew | CORE | market source | REQUIRED |
| Put/call ratio | CONFIRMING | market source | REQUIRED |
| Realized volatility | CORE | calculated from price data | REQUIRED |
| Implied vs realized volatility spread | DERIVED CORE | calculated | REQUIRED |
| Correlation spike | CONFIRMING | calculated | REQUIRED |
| Equity drawdown breadth | CONFIRMING | calculated | REQUIRED |
| Credit volatility proxy | CONFIRMING | FRED / credit-spread proxy | REQUIRED |
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
3. Select and document the market price provider dependency.
4. Create data-fetch utilities.
5. Create one generator per Phase 1 asset class.
6. Create an asset-class coverage validator.
7. Only then allow Macro to consume the asset-class matrix.
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

## Mission 4 starting point

Mission 4 should begin with the lowest-friction, highest-importance Phase 1 generator:

```text
Money / Cash
```

Reason:

- many datasets can likely come from FRED or Federal Reserve mirrors
- it anchors liquidity, short-rate pressure, cash optionality, and risk-curve forcing
- it reduces dependency on unresolved market-price provider selection

Required output:

```text
outputs/money-cash-state.json
```

## Final law

A Macro read without required data is not intelligence. It is a narrative. Capital Radar should only generate analysis after it can point to the dataset chain underneath each asset-class conclusion.
