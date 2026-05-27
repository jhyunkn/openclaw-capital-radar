# Asset-Class Research Matrix -> Macro Compression Spec

## Mission

Replace the old Cross-Asset Lens with a dataset-backed Asset-Class Research Matrix inside the Macro section.

This is a specification-only mission. It does not implement UI or modify the live homepage.

## Core correction

Capital Radar should not begin with labels such as `supportive`, `defensive`, `fragile`, or `extended`.

It should begin with evidence.

The correct structure is:

```text
Asset Class -> Dataset -> Analysis -> Synthesis
```

Where synthesis has two possible outputs:

```text
1. Ontological market landscape
2. Historical cycle narrative
```

## Required analytical chain

Every asset class must follow this chain:

```text
1. Asset class
2. Associated datasets
3. Signal method
4. Asset-class analysis
5. Cycle state
6. Cross-asset relationship
7. Ontological market landscape read
8. Historical narrative / prior-cycle comparison
9. Portfolio implication
10. Missing evidence / confidence
```

This is the core law of Mission 2.

## Why this matters

An asset class cannot generate useful Macro analysis unless the system knows what data is being used to evaluate it.

A serious read cannot jump directly from:

```text
Bonds down
```

to:

```text
Market is defensive.
```

It must pass through:

```text
Which bond data?
Which part of the bond market?
Nominal yields, real yields, curve, inflation expectations, credit spreads, MOVE?
What cycle state does that imply?
How does that relate to equities, cash, credit, commodities, FX, and volatility?
How does this compare to earlier bond cycles?
```

## The two synthesis outputs

### 1. Ontological market landscape

This asks:

```text
How are the asset classes related to one another in producing the current market condition?
```

Example:

```text
Equity ownership remains supported, but sovereign duration is still pressuring valuation multiples. Credit confirmation is missing, volatility remains contained, and speculative liquidity is not validating broad risk expansion. This means the current landscape is selective risk, not full liquidity expansion.
```

This is not a single-asset read. It is a relationship map.

### 2. Historical cycle narrative

This asks:

```text
How is the current asset-class configuration situated compared to prior cycles of asset movement?
```

Example:

```text
The current setup resembles a late-liquidity or narrow-leadership phase more than an early broad-risk expansion. Equities can continue rising, but the absence of credit, duration, and liquidity confirmation means the move has not yet matured into a full-cycle Add regime.
```

This is not a prediction. It is a historical-context read.

## Web outcome

The homepage remains four sections:

```text
Macro
Decision chart
Holdings
Opportunity
```

Inside Macro, the visible subpanel should eventually show a compressed version of the deeper matrix.

The user-facing surface may look compact, but the underlying model must be:

```text
Asset Class
Dataset Coverage
Analysis
Cycle State
Relationship to Other Asset Classes
Historical Cycle Comparison
Landscape Meaning
Portfolio Implication
Missing Evidence
```

Example visible output:

```text
ASSET-CLASS RESEARCH MATRIX

Macro landscape: Selective risk / incomplete confirmation
Historical posture: Narrow leadership, not broad-cycle expansion

Asset class              Dataset basis                  Analysis                         Cycle state                  Landscape role
Money / Cash             T-bills, reserves, liquidity   Optionality still has value       Optionality cycle            Cash still competes with risk
Sovereign Bonds          yields, real yields, curve      Rate relief not confirmed         Duration pressure            Limits valuation expansion
Credit                   spreads, lending, defaults     Confirmation missing              Unknown / watch              Blocks broad-risk upgrade
Equity Ownership         breadth, earnings, leadership  Index strength remains narrow     Narrow productive risk       Supports core, not blind beta
Innovation Themes        valuation, momentum, flows     Future growth priced aggressively Crowded narrative cycle      Avoid chase
Real Assets              cap rates, rents, REITs        Quality income matters most       Rate-sensitive split         Selective collateral only
Commodities / Inputs     energy, metals, shipping       Scarcity signal not decisive      Bottleneck watch             Watch inflation impulse
Monetary Alternatives    gold, BTC, real yields, USD    Escape bid not fully confirmed    Trust/liquidity split        Cap size
FX / Dollar              DXY, funding, liquidity        Dataset missing                   Missing confirmation         Global liquidity incomplete
Volatility / Insurance   VIX, skew, spreads             Disorder priced as contained      Contained risk               Hold risk with discipline

Ontological read:
Risk is being rewarded through equity and innovation, but the confirmation has not broadened through credit, duration, liquidity, FX, and real assets.

Historical narrative:
This behaves more like a selective/narrow-leadership phase than a durable broad-risk expansion.

Portfolio implication:
Own core. Probe only at ruled zones. Do not upgrade to Add until credit, liquidity, breadth, or duration confirms.
```

## Required matrix fields

Each asset class must have these fields before it can generate a serious Macro read.

| Field | Purpose |
|---|---|
| Asset class | Timeless capital primitive |
| Dataset | Concrete data inputs used to evaluate it |
| Signal method | How the data is interpreted |
| Analysis | What the dataset says now |
| Cycle state | Where the asset class appears in its own cycle |
| Cross-asset relationship | How this asset class confirms, contradicts, or leads other asset classes |
| Ontological landscape read | What this reveals about capital behavior broadly |
| Historical narrative | How the current configuration compares to prior cycles |
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

- Compare cash yield against inflation, equity risk premium, credit spreads, and liquidity conditions.

Cycle states:

- idle cash
- optionality valuable
- forced cash demand
- redeployment window

Ontological read:

- Shows whether capital is being paid to wait or forced to seek risk.

Historical narrative:

- Compare current cash yield and liquidity impulse to prior periods when cash either competed with risk assets or became redeployment power after stress.

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

- Evaluate whether duration is compressing or expanding valuation multiples.

Cycle states:

- duration tailwind
- duration pressure
- policy-pivot anticipation
- inflation casualty
- safe-collateral bid

Ontological read:

- Shows whether the price of time is helping or punishing long-duration claims.

Historical narrative:

- Compare current duration behavior to prior rising-rate, falling-rate, inflation-shock, recession-hedge, and policy-pivot cycles.

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

- Evaluate whether risk can broaden beyond the strongest equity leaders.

Cycle states:

- credit expansion
- late-cycle compression
- stress widening
- refinancing pressure
- repair / reopening

Ontological read:

- Shows whether the market trusts borrowers broadly, not just winners.

Historical narrative:

- Compare current spreads and lending conditions to prior credit-expansion, late-cycle, and stress-repair phases.

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

- Separate productive-risk confirmation from index concentration.

Cycle states:

- broad accumulation
- narrow leadership
- speculative expansion
- earnings validation
- distribution / exhaustion

Ontological read:

- Shows whether capital is broadly buying productive enterprise or only crowding into a few winners.

Historical narrative:

- Compare current equity behavior to prior broad bull markets, narrow-leadership markets, earnings-led expansions, and speculative peaks.

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

- Evaluate whether future growth is underpriced, fairly priced, or over-capitalized.

Cycle states:

- early adoption
- institutional accumulation
- narrative acceleration
- crowding / overpricing
- reset / digestion

Ontological read:

- Shows how far into the future capital is willing to pay.

Historical narrative:

- Compare current innovation leadership to prior railroad, electricity, autos, telecom, internet, cloud, and AI-style capital concentration cycles.

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

- Evaluate whether real collateral is supported by income, inflation, or leverage.

Cycle states:

- income durability
- leverage stress
- inflation hedge
- collateral repricing
- capital scarcity

Ontological read:

- Shows whether capital prefers tangible collateral and cash flow over financial duration.

Historical narrative:

- Compare current real-asset behavior to prior inflationary, rate-shock, credit-tightening, and income-durability cycles.

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

- Distinguish scarcity leadership from weak-demand collapse.

Cycle states:

- demand expansion
- scarcity squeeze
- inflation impulse
- weak-demand liquidation
- geopolitical premium

Ontological read:

- Shows whether the physical economy is imposing constraints on financial claims.

Historical narrative:

- Compare current commodity behavior to prior demand booms, oil shocks, war premiums, inventory squeezes, and recessionary demand collapses.

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

- Separate escape bid from speculative beta.

Cycle states:

- dormant hedge
- liquidity beta
- escape bid
- debasement hedge
- speculative excess

Ontological read:

- Shows whether capital is questioning sovereign money or merely reaching for beta.

Historical narrative:

- Compare current monetary-alternative behavior to prior gold bull markets, dollar-trust crises, real-yield drawdowns, crypto-liquidity cycles, and debasement narratives.

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

- Evaluate whether dollar strength is tightening global financial conditions.

Cycle states:

- dollar easing
- dollar squeeze
- reserve preference
- carry expansion
- EM stress

Ontological read:

- Shows where global capital seeks monetary safety and funding access.

Historical narrative:

- Compare current dollar behavior to prior global funding squeezes, reserve-preference episodes, carry expansions, and EM-stress cycles.

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

- Evaluate whether insurance is cheap, expensive, complacent, or panic-priced.

Cycle states:

- complacency
- contained risk
- rising stress
- panic premium
- post-shock normalization

Ontological read:

- Shows whether the market is underpricing or overpricing disorder.

Historical narrative:

- Compare current volatility behavior to prior complacency phases, pre-shock underpricing, panic-premium episodes, and post-shock normalization.

## Analysis method

Each asset class should be evaluated in this order:

```text
1. Dataset coverage: what do we actually know?
2. Signal direction: what is the data doing?
3. Cycle state: where is this asset class in its own cycle?
4. Cross-asset relation: does it confirm, contradict, or lead other asset classes?
5. Ontological landscape read: what capital behavior does this reveal?
6. Historical narrative: what prior cycle does this resemble or diverge from?
7. Portfolio implication: what action is permitted or forbidden?
8. Invalidation: what data would change the conclusion?
```

## Cyclical rather than singular

Each asset class should support multiple possible cycle identities.

For example:

### Bonds are not simply defensive

They can be:

- duration tailwind
- inflation casualty
- safe collateral
- fiscal stress casualty
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
- the cross-asset relationship
- the ontological market landscape read
- the historical narrative / prior-cycle comparison
- the portfolio implication
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
3. Each visible asset class shows dataset coverage, analysis, cycle state, cross-asset relationship, ontological landscape read, historical narrative, and portfolio implication.
4. Missing asset-class datasets are explicitly marked, not hallucinated.
5. The system distinguishes asset class from proxy instrument.
6. The system distinguishes cycle state from static label.
7. The system distinguishes ontological market landscape from historical cycle narrative.
8. `market-lens-section` remains disabled as a standalone section unless explicitly changed later.
9. `npm run build:fast` passes.
10. `scripts/validate-four-section-homepage.cjs` passes as part of the build path.

## Final decision law

Capital Radar should not ask whether an asset class is simply good or bad.

It should ask:

> What data defines this asset-class cycle, what analysis follows from that data, how do the asset classes relate to produce the current market condition, and how does the current setup compare with prior cycles of asset movement?
