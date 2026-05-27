# Asset-Class Research Matrix -> Macro Compression Spec

## Mission

Replace the old Cross-Asset Lens with a dataset-backed Asset-Class Research Matrix inside the Macro section.

This is a specification-only mission. It does not implement UI or modify the live homepage.

## Core correction

Capital Radar should not begin with labels such as `supportive`, `defensive`, `fragile`, or `extended`.

It should begin with evidence.

The correct structure is:

```text
Asset Class -> Dataset -> Signal Method -> Cycle State -> Analysis -> Ontological Market Landscape Read -> Portfolio Implication
```

The prior versions were still too interpretive. They read like cards. This version must read like a research engine.

## Why this matters

An asset class is not singular. It is cyclical.

The same asset class can perform different market roles depending on regime:

- cash can be dead weight in liquidity expansion, but power in contraction
- bonds can be safe collateral, duration upside, or inflation casualty
- equities can represent productive ownership, speculative beta, or over-owned narrative
- commodities can signal inflation, scarcity, war risk, or weak demand
- gold/Bitcoin can behave as escape assets, liquidity assets, or speculative beta
- volatility can be cheap insurance, panic premium, or complacency warning

Therefore the system should not ask:

```text
Is this asset class good or bad?
```

It should ask:

```text
What cycle state is this asset class in, what data proves that, and what does that reveal about the market landscape?
```

## Web outcome

The homepage remains four sections:

```text
Macro
Decision chart
Holdings
Opportunity
```

Inside Macro, the visible subpanel should eventually show a compressed version of a deeper dataset-backed matrix.

The user-facing surface may look compact, but the underlying model must be:

```text
Asset Class
Dataset Coverage
Cycle State
Signal Read
Landscape Meaning
Portfolio Implication
Missing Evidence
```

Example visible output:

```text
ASSET-CLASS RESEARCH MATRIX

Overall landscape: Liquidity is not broad enough to justify full risk expansion.

Asset class              Dataset coverage              Cycle state              Landscape read                       Portfolio implication
Money / Cash             T-bills, reserves, liquidity   Optionality cycle        Dry powder still has value             Do not exhaust risk budget
Sovereign Bonds          yields, real rates, curve      Duration pressure        Discount-rate relief not confirmed     Avoid valuation chase
Credit                   spreads, lending, defaults     Confirmation missing     Risk broadening unproven               Cap Add permission
Equity Ownership         breadth, earnings, leadership  Narrow productive risk   Index strength hides concentration     Own core / probe zones
Innovation Themes        valuation, momentum, flows     Crowded narrative cycle  Future priced aggressively             Avoid chase
Real Assets              cap rates, rents, REITs        Rate-sensitive split     Quality income beats leverage          Underwrite selectively
Commodities / Inputs     energy, metals, shipping       Bottleneck watch         Physical scarcity not decisive yet     Watch inflation impulse
Monetary Alternatives    gold, BTC, real yields, USD    Trust/liquidity split    Escape bid not fully confirmed         Cap size
FX / Dollar              DXY, funding, global liquidity Missing confirmation     Global liquidity read incomplete       Cap confidence
Volatility / Insurance   VIX, skew, spreads             Complacency/containment  Disorder is priced as contained        Hold risk but keep discipline

Landscape conclusion:
Equity ownership is still being rewarded, but the cycle has not broadened across credit, duration, liquidity, FX, and real assets. Treat the regime as selective rather than expansionary.
```

## Required matrix fields

Each asset class must have these fields before it can generate a serious Macro read.

| Field | Purpose |
|---|---|
| Asset class | Timeless capital primitive |
| Dataset | Concrete data inputs used to evaluate it |
| Signal method | How the data is interpreted |
| Cycle state | Where the asset class appears in its own cycle |
| Analysis | What the data says now |
| Ontological landscape read | What this reveals about capital behavior broadly |
| Portfolio implication | What Capital Radar should do with exposure |
| Missing evidence | What is not yet known |
| Confidence | AUTH / PROXY / PARTIAL / MISSING / STALE / CONFLICTED |

## Asset class data contracts

### 1. Money / Cash

Timeless role:

- Optionality, liquidity reserve, survival capital, purchasing-power waiting room.

Core datasets:

- T-bill yields
- money-market yields
- Fed funds / policy rate
- bank reserves
- money supply / liquidity impulse
- stablecoin supply where relevant

Signal method:

- compare cash yield against inflation, equity risk premium, credit spreads, and liquidity conditions.

Cycle states:

- idle cash
- optionality valuable
- forced cash demand
- redeployment window

Ontological read:

- Shows whether capital is being paid to wait or forced to seek risk.

### 2. Sovereign Bonds / Duration

Timeless role:

- State credit, duration claim, policy-trust instrument, price-of-time signal.

Core datasets:

- nominal yields
- real yields
- yield curve
- inflation expectations
- central-bank path
- Treasury volatility / MOVE index if available

Signal method:

- evaluate whether duration is compressing or expanding valuation multiples.

Cycle states:

- duration tailwind
- duration pressure
- policy-pivot anticipation
- inflation casualty
- safe-collateral bid

Ontological read:

- Shows whether the price of time is helping or punishing long-duration claims.

### 3. Credit

Timeless role:

- Private repayment claim; trust in future cash-flow repayment.

Core datasets:

- high-yield spreads
- investment-grade spreads
- default rates
- lending standards
- bank credit growth
- refinancing wall
- credit stress indexes

Signal method:

- evaluate whether risk can broaden beyond the strongest equity leaders.

Cycle states:

- credit expansion
- late-cycle compression
- stress widening
- refinancing pressure
- repair / reopening

Ontological read:

- Shows whether the market trusts borrowers broadly, not just winners.

### 4. Equity Ownership

Timeless role:

- Claim on productive surplus.

Core datasets:

- index trend
- breadth
- earnings revisions
- margins
- valuation multiples
- buybacks
- sector participation

Signal method:

- separate productive-risk confirmation from index concentration.

Cycle states:

- broad accumulation
- narrow leadership
- speculative expansion
- earnings validation
- distribution / exhaustion

Ontological read:

- Shows whether capital is broadly buying productive enterprise or only crowding into a few winners.

### 5. Innovation / Growth Themes

Timeless role:

- Future optionality claim; narrative-duration asset.

Core datasets:

- revenue growth
- margins
- capex cycle
- valuation spread vs market
- momentum
- flows
- concentration
- earnings revision breadth

Signal method:

- evaluate whether future growth is underpriced, fairly priced, or over-capitalized.

Cycle states:

- early adoption
- institutional accumulation
- narrative acceleration
- crowding / overpricing
- reset / digestion

Ontological read:

- Shows how far into the future capital is willing to pay.

### 6. Real Assets

Timeless role:

- Real collateral claim; control of scarce physical utility.

Core datasets:

- cap rates
- rent growth
- occupancy
- REIT performance
- infrastructure cash flows
- mortgage rates
- construction costs
- land / property price indexes

Signal method:

- evaluate whether real collateral is supported by income, inflation, or leverage.

Cycle states:

- income durability
- leverage stress
- inflation hedge
- collateral repricing
- capital scarcity

Ontological read:

- Shows whether capital prefers tangible collateral and cash flow over financial duration.

### 7. Commodities / Inputs

Timeless role:

- Input scarcity claim; control of energy, materials, food, transport bottlenecks.

Core datasets:

- energy prices
- industrial metals
- precious metals where separated from monetary alternatives
- food / grains
- shipping rates
- inventories
- term structure / backwardation-contango

Signal method:

- distinguish scarcity leadership from weak-demand collapse.

Cycle states:

- demand expansion
- scarcity squeeze
- inflation impulse
- weak-demand liquidation
- geopolitical premium

Ontological read:

- Shows whether the physical economy is imposing constraints on financial claims.

### 8. Monetary Alternatives

Timeless role:

- Sovereign-trust escape claim; hedge against fiat debasement, repression, or institutional distrust.

Core datasets:

- gold
- silver
- Bitcoin
- real yields
- dollar strength
- central-bank gold purchases if available
- crypto liquidity / stablecoin supply if available

Signal method:

- separate escape bid from speculative beta.

Cycle states:

- dormant hedge
- liquidity beta
- escape bid
- debasement hedge
- speculative excess

Ontological read:

- Shows whether capital is questioning sovereign money or merely reaching for beta.

### 9. FX / Dollar

Timeless role:

- Relative monetary trust claim; global liquidity and funding pressure.

Core datasets:

- DXY
- dollar funding stress
- cross-currency basis where available
- major FX pairs
- EM FX
- global liquidity proxies

Signal method:

- evaluate whether dollar strength is tightening global financial conditions.

Cycle states:

- dollar easing
- dollar squeeze
- reserve preference
- carry expansion
- EM stress

Ontological read:

- Shows where global capital seeks monetary safety and funding access.

### 10. Volatility / Insurance

Timeless role:

- Convex protection claim; price of disorder and forced deleveraging.

Core datasets:

- VIX
- MOVE
- skew
- put/call ratios
- credit hedges / CDS where available
- realized vs implied volatility

Signal method:

- evaluate whether insurance is cheap, expensive, complacent, or panic-priced.

Cycle states:

- complacency
- contained risk
- rising stress
- panic premium
- post-shock normalization

Ontological read:

- Shows whether the market is underpricing or overpricing disorder.

## Analysis method

Each asset class should be evaluated in this order:

```text
1. Dataset coverage: what do we actually know?
2. Signal direction: what is the data doing?
3. Cycle state: where is this asset class in its own cycle?
4. Cross-cycle relation: does it confirm or contradict other asset classes?
5. Landscape read: what capital behavior does this reveal?
6. Portfolio implication: what action is permitted or forbidden?
7. Invalidation: what data would change the conclusion?
```

## Cyclical rather than singular

Each asset class should support multiple possible cycle identities.

For example:

### Bonds are not simply defensive

They can be:

- duration tailwind
- inflation casualty
- safe collateral
- policy-pivot anticipation
- credit-stress refuge

### Crypto is not simply risk-on or risk-off

It can be:

- speculative liquidity beta
- monetary alternative
- network adoption asset
- escape asset
- excess-leverage warning

### Real assets are not simply inflation hedges

They can be:

- income durability assets
- leverage casualties
- collateral stores
- scarcity claims
- rate-sensitive traps

### Cash is not simply idle

It can be:

- dead weight
- high-yield optionality
- crisis liquidity
- redeployment power
- defensive necessity

## Existing artifact use

The current `outputs/market-lens-state.json` can be used only as partial proxy coverage.

Current proxy mapping:

| Current artifact lens | Asset-class matrix use | Limitation |
|---|---|---|
| SPX / Broad market | Equity Ownership proxy | Does not fully capture breadth, earnings, valuation, or sector participation |
| QQQ / AI-growth | Innovation / Growth Themes proxy | Does not fully capture valuation spread, flow crowding, or earnings breadth |
| TLT / rate-cycle pressure | Sovereign Bonds / Duration proxy | Does not fully capture real yields, curve, inflation expectations, or MOVE |
| BTC / speculative liquidity | Monetary Alternatives / liquidity proxy | Ambiguous between escape asset and speculative beta |
| VIX / volatility | Volatility / Insurance proxy | Does not cover skew, MOVE, credit hedges, or realized/implied spread |

Therefore first implementation should explicitly say:

```text
Dataset coverage: PARTIAL
```

## Minimum viable Macro output

The first web implementation should not pretend the system is complete.

It should display:

- the asset classes currently covered by proxy data
- the missing asset classes requiring datasets
- the cycle state inferred from available data
- the landscape implication
- confidence level

Minimum rows:

1. Sovereign Bonds / Duration — proxy data available
2. Equity Ownership — proxy data available
3. Innovation / Growth Themes — proxy data available
4. Monetary Alternatives — proxy data partial / ambiguous
5. Volatility / Insurance — proxy data available
6. Money / Cash — dataset missing
7. Credit — dataset missing
8. Real Assets — dataset missing
9. Commodities / Inputs — dataset missing
10. FX / Dollar — dataset missing

## Acceptance criteria

After implementation:

1. Homepage still has exactly four visible sections.
2. Macro contains an Asset-Class Research Matrix, not a card-like Cross-Asset Lens.
3. Each visible asset class shows dataset coverage, cycle state, analysis, landscape implication, and portfolio implication.
4. Missing asset-class datasets are explicitly marked, not hallucinated.
5. The system distinguishes asset class from proxy instrument.
6. The system distinguishes cycle state from static label.
7. `market-lens-section` remains disabled as a standalone section unless explicitly changed later.
8. `npm run build:fast` passes.
9. `scripts/validate-four-section-homepage.cjs` passes as part of the build path.

## Final decision law

Capital Radar should not ask whether an asset class is simply good or bad.

It should ask:

> What data defines this asset class cycle, what phase is it in, what does that reveal about the market landscape, and what portfolio action does that permit?
