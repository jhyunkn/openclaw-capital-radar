# Asset-Class Dataset Map

## Purpose

This document defines the minimum dataset contract for each timeless asset class in Capital Radar.

Capital Radar should not generate asset-class analysis from labels alone. Each asset-class read must begin with data, then produce analysis, then produce either:

1. an ontological market landscape read, meaning how asset classes relate to produce the current condition; and/or
2. a historical cycle narrative, meaning how the current asset-class configuration compares with prior cycles of asset movement.

## Master chain

```text
Asset Class
-> Required Dataset
-> Signal Method
-> Analysis
-> Cycle State
-> Cross-Asset Relationship
-> Ontological Market Landscape Read
-> Historical Cycle Narrative
-> Portfolio Implication
-> Missing Evidence / Confidence
```

## Dataset tiers

Each dataset should be tagged by reliability.

| Tier | Meaning |
|---|---|
| CORE | Required for a real asset-class read |
| CONFIRMING | Strengthens or challenges the core read |
| CONTEXT | Explains why the signal is behaving as it is |
| PROXY | Temporary substitute when the real dataset is unavailable |
| MISSING | Required but not yet available |

## Asset classes

## 1. Money / Cash

Timeless role:

- Liquidity reserve, optionality, survival capital, purchasing-power waiting room.

Primary question:

- Is capital being paid to wait, or is capital being forced out on the risk curve?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| 3-month T-bill yield | CORE | Base return for waiting |
| Fed funds rate / policy rate | CORE | Defines short-rate regime |
| Real cash yield vs inflation | CORE | Determines whether cash preserves purchasing power |
| Money-market fund assets | CORE | Shows capital parked in cash-like instruments |
| Bank reserves / reserve liquidity | CONFIRMING | Shows system liquidity condition |
| M2 / broad money growth | CONFIRMING | Shows monetary expansion or contraction |
| Treasury General Account / RRP if available | CONTEXT | Explains liquidity drain or injection |
| Stablecoin supply | PROXY / CONTEXT | Useful modern proxy for crypto-adjacent liquidity |

Signal method:

- Compare real cash yield, cash balances, reserve liquidity, and money growth against risk-asset performance.

Cycle states:

- dead cash
- optionality valuable
- forced cash demand
- redeployment window
- liquidity flood

Ontological read:

- Cash reveals whether capital is waiting, hiding, or preparing to redeploy.

Historical narrative:

- Compare current cash yield and liquidity impulse to prior periods when cash competed with risk assets, such as tightening cycles, post-crisis repair windows, or liquidity-flood periods.

## 2. Sovereign Bonds / Duration

Timeless role:

- State duration claim, policy-trust instrument, price-of-time signal.

Primary question:

- Is the price of time helping or punishing long-duration claims?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| 2-year Treasury yield | CORE | Policy path expectation |
| 10-year Treasury yield | CORE | Long-duration discount-rate benchmark |
| Real 10-year yield | CORE | Real cost of capital |
| Yield curve slope, such as 2s10s or 3m10y | CORE | Growth/recession and policy-cycle signal |
| Inflation breakevens | CORE | Separates inflation fear from real-rate pressure |
| TLT or long-duration Treasury ETF | PROXY | Tradable proxy for duration pressure |
| MOVE index | CONFIRMING | Treasury volatility and bond-market stress |
| Fed path / rate-cut expectations | CONTEXT | Explains duration repricing |

Signal method:

- Separate nominal-yield pressure, real-yield pressure, curve signal, and inflation expectation.

Cycle states:

- duration tailwind
- duration pressure
- policy-pivot anticipation
- inflation casualty
- safe-collateral bid
- fiscal stress casualty

Ontological read:

- Duration reveals how the market prices time, policy trust, inflation risk, and valuation multiples.

Historical narrative:

- Compare current duration behavior to rising-rate inflation cycles, disinflationary falling-rate cycles, recession hedge episodes, and policy-pivot anticipation phases.

## 3. Credit

Timeless role:

- Private repayment claim; trust in future cash-flow repayment.

Primary question:

- Does the market trust borrowers broadly enough for risk to broaden?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| High-yield credit spread | CORE | Stress level in weaker borrowers |
| Investment-grade credit spread | CORE | Stress level in higher-quality borrowers |
| Default rates | CORE | Actual credit impairment |
| Bank lending standards | CORE | Availability of credit |
| Bank credit growth | CORE | Whether credit is expanding or contracting |
| Leveraged loan / private credit stress where available | CONFIRMING | Captures non-public credit pressure |
| Refinancing wall / maturity schedule | CONTEXT | Future credit stress risk |
| HYG / LQD price trend | PROXY | Market-price proxy for credit appetite |

Signal method:

- Compare spreads, lending standards, defaults, and credit growth to determine whether capital trusts borrowers.

Cycle states:

- credit expansion
- late-cycle compression
- stress widening
- refinancing pressure
- repair / reopening

Ontological read:

- Credit reveals whether confidence is broad or only concentrated in the strongest equity leaders.

Historical narrative:

- Compare current spreads and lending conditions to prior credit-expansion, late-cycle compression, stress-widening, and post-crisis repair phases.

## 4. Equity Ownership

Timeless role:

- Productive surplus claim; ownership of enterprise cash flows.

Primary question:

- Is capital broadly buying productive enterprise or only a narrow group of winners?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| Broad equity index trend, such as SPX | CORE | Primary risk-ownership benchmark |
| Equal-weight vs cap-weight performance | CORE | Measures concentration vs broad participation |
| Market breadth, advance/decline or % above moving averages | CORE | Confirms whether rally is broad |
| Earnings revisions | CORE | Validates productive surplus expectation |
| Margin trend | CORE | Confirms quality of earnings growth |
| Valuation multiples | CORE | Shows price paid for future surplus |
| Sector participation | CONFIRMING | Shows where ownership is broadening or narrowing |
| Buybacks / issuance | CONTEXT | Corporate demand or supply of equity |

Signal method:

- Separate index strength from breadth, earnings validation, and valuation pressure.

Cycle states:

- broad accumulation
- narrow leadership
- speculative expansion
- earnings validation
- distribution / exhaustion

Ontological read:

- Equity reveals whether capital believes productive surplus is expanding broadly or only in a concentrated narrative.

Historical narrative:

- Compare current equity behavior to broad bull markets, narrow-leadership markets, earnings-led expansions, and speculative peaks.

## 5. Innovation / Growth Themes

Timeless role:

- Future optionality claim; ownership of long-duration future growth and narrative expansion.

Primary question:

- Is the market rationally underwriting future growth, or overpaying for narrative duration?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| Growth index / QQQ / theme basket trend | CORE / PROXY | Tracks current innovation leadership |
| Revenue growth | CORE | Validates actual growth |
| Earnings revision breadth | CORE | Confirms fundamentals beyond price |
| Valuation premium vs market | CORE | Measures price of future optionality |
| Momentum and relative strength | CORE | Shows capital crowding into theme |
| Concentration among leaders | CORE | Reveals narrowness and fragility |
| Fund flows / ETF flows | CONFIRMING | Shows capital allocation into theme |
| Capex cycle | CONTEXT | Shows whether infrastructure buildout supports theme |

Signal method:

- Compare growth fundamentals, valuation premium, momentum, and concentration.

Cycle states:

- early adoption
- institutional accumulation
- narrative acceleration
- crowding / overpricing
- reset / digestion

Ontological read:

- Innovation themes reveal how far into the future capital is willing to pay.

Historical narrative:

- Compare current innovation leadership to prior railroad, electricity, autos, telecom, internet, cloud, and AI-style capital-concentration cycles.

## 6. Real Assets

Timeless role:

- Real collateral claim; control of scarce physical utility and income-producing collateral.

Primary question:

- Does capital prefer tangible collateral and income durability, or is real collateral being repriced by rates/leverage?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| Cap rates | CORE | Valuation of real collateral income |
| Rent growth | CORE | Income growth support |
| Occupancy / vacancy | CORE | Demand strength |
| REIT performance | PROXY | Market proxy for listed real assets |
| Mortgage rates / financing costs | CORE | Leverage pressure |
| Construction costs | CONFIRMING | Replacement cost and supply pressure |
| Infrastructure / utility cash-flow indicators | CONFIRMING | Durable income proxy |
| Property price indexes | CONTEXT | Asset price cycle |

Signal method:

- Separate income durability from leverage stress and inflation hedge behavior.

Cycle states:

- income durability
- leverage stress
- inflation hedge
- collateral repricing
- capital scarcity

Ontological read:

- Real assets reveal whether capital is seeking collateral, income, scarcity, or inflation protection.

Historical narrative:

- Compare current real-asset behavior to inflationary cycles, rate-shock cycles, credit-tightening cycles, and income-durability phases.

## 7. Commodities / Inputs

Timeless role:

- Input scarcity claim; control of energy, materials, food, and transport bottlenecks.

Primary question:

- Is the physical economy imposing scarcity constraints on financial claims?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| Oil price | CORE | Energy/inflation/geopolitical impulse |
| Natural gas / power where relevant | CORE | Energy system stress |
| Industrial metals, especially copper | CORE | Growth and infrastructure demand proxy |
| Gold if used as commodity input separate from monetary role | CONTEXT | Precious-metal overlap |
| Grains / food prices | CONFIRMING | Food inflation and supply risk |
| Shipping rates | CONFIRMING | Global trade and bottleneck pressure |
| Inventories | CORE | Scarcity vs surplus validation |
| Futures curve, backwardation/contango | CORE | Physical tightness vs oversupply |

Signal method:

- Distinguish demand expansion, scarcity squeeze, inflation impulse, weak-demand liquidation, and geopolitical premium.

Cycle states:

- demand expansion
- scarcity squeeze
- inflation impulse
- weak-demand liquidation
- geopolitical premium

Ontological read:

- Commodities reveal whether physical constraints are dominating financial valuation logic.

Historical narrative:

- Compare current commodity behavior to demand booms, oil shocks, war premiums, inventory squeezes, and recessionary demand collapses.

## 8. Monetary Alternatives

Timeless role:

- Sovereign-trust escape claim; hedge against fiat debasement, repression, or institutional distrust.

Primary question:

- Is capital questioning sovereign money, or merely reaching for speculative beta?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| Gold price | CORE | Classical hard-money and reserve-diversification signal |
| Silver price | CONFIRMING | Hybrid monetary/industrial signal |
| Bitcoin price | CORE / PROXY | Modern hard-money/network/speculative signal |
| Real yields | CORE | Key driver of non-yielding monetary assets |
| Dollar strength | CORE | Confirms or contradicts monetary-alternative bid |
| Central-bank gold purchases | CONFIRMING | Sovereign reserve behavior |
| Stablecoin supply / crypto liquidity | CONTEXT | Separates liquidity beta from escape bid |
| Gold/BTC correlation with risk assets | CONFIRMING | Distinguishes hedge from beta behavior |

Signal method:

- Separate escape bid, debasement hedge, real-rate hedge, and speculative liquidity beta.

Cycle states:

- dormant hedge
- liquidity beta
- escape bid
- debasement hedge
- speculative excess

Ontological read:

- Monetary alternatives reveal whether capital is questioning fiat trust, seeking liquidity beta, or hedging repression/debasement.

Historical narrative:

- Compare current behavior to prior gold bull markets, dollar-trust crises, real-yield drawdowns, crypto liquidity cycles, and debasement narratives.

## 9. FX / Dollar

Timeless role:

- Relative monetary trust claim; global liquidity and funding-pressure signal.

Primary question:

- Is the dollar easing global liquidity or tightening global financial conditions?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| DXY | CORE | Broad dollar strength or weakness |
| Major FX pairs, EUR/USD, USD/JPY, etc. | CORE | Regional monetary divergence |
| EM FX basket | CORE | Stress signal for global liquidity |
| Cross-currency basis where available | CONFIRMING | Funding stress |
| Dollar funding stress indicators | CORE | Liquidity squeeze risk |
| Global liquidity proxies | CONFIRMING | Confirms dollar impact beyond FX price |
| Carry-trade indicators | CONTEXT | Risk appetite and funding conditions |

Signal method:

- Evaluate whether dollar strength reflects safety demand, rate advantage, funding stress, or U.S. exceptionalism.

Cycle states:

- dollar easing
- dollar squeeze
- reserve preference
- carry expansion
- EM stress

Ontological read:

- FX reveals where global capital seeks monetary safety, funding access, or relative policy advantage.

Historical narrative:

- Compare current dollar behavior to global funding squeezes, reserve-preference episodes, carry expansions, and EM-stress cycles.

## 10. Volatility / Insurance

Timeless role:

- Convex protection claim; price of disorder, uncertainty, and forced deleveraging.

Primary question:

- Is the market underpricing or overpricing disorder?

Required datasets:

| Dataset | Tier | Why it matters |
|---|---|---|
| VIX | CORE | Equity volatility price |
| MOVE | CORE | Treasury volatility price |
| Skew | CORE | Tail-risk demand |
| Put/call ratios | CONFIRMING | Positioning and hedge demand |
| Realized vs implied volatility | CORE | Insurance cheapness or richness |
| Credit hedges / CDS indexes | CONFIRMING | Credit disorder protection |
| Volatility term structure | CORE | Complacency or stress regime |

Signal method:

- Evaluate whether protection is cheap, expensive, complacent, panic-priced, or repricing ahead of asset prices.

Cycle states:

- complacency
- contained risk
- rising stress
- panic premium
- post-shock normalization

Ontological read:

- Volatility reveals whether the market is paying enough for uncertainty and disorder.

Historical narrative:

- Compare current volatility behavior to complacency phases, pre-shock underpricing, panic-premium episodes, and post-shock normalization.

## Implementation priority

For the first real implementation, do not try to build every dataset at once.

Recommended sequence:

1. Map current repo proxy coverage from `outputs/market-lens-state.json`.
2. Add missing dataset declarations for each asset class.
3. Mark all unavailable datasets as `MISSING`.
4. Generate partial Macro read from available proxy data only.
5. Add datasets progressively in future missions.

## First dataset expansion priorities

After current proxy coverage, add these in order:

1. Credit spreads and lending standards
2. Dollar / FX / global liquidity
3. Cash / T-bill / reserve liquidity
4. Breadth and equal-weight equity participation
5. Real yields / yield curve / breakevens
6. Oil / copper / commodities term structure
7. Gold vs BTC vs real yields
8. Volatility beyond VIX, especially MOVE and skew
9. Real assets: REITs, cap rates, rents, financing costs

## Final law

Capital Radar should not ask whether an asset class is simply good or bad.

It should ask:

> What data defines this asset-class cycle, what analysis follows from that data, how do the asset classes relate to produce the current market condition, and how does the current setup compare with prior cycles of asset movement?
