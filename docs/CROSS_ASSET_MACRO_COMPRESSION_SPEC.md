# Capital Primitive Lens -> Macro Compression Spec

## Mission

Replace the old narrow Cross-Asset Lens concept with a timeless Capital Primitive Lens inside the Macro section.

This is a specification-only mission. It does not implement UI or modify the live homepage.

## Correction from review

The earlier Cross-Asset Lens proposal was still too contemporary and too instrument-specific. It treated SPX, QQQ, TLT, BTC, and VIX as if they were the structural categories.

That is not durable enough.

Capital Radar should separate:

1. **Capital primitives** — timeless forms of capital behavior.
2. **Regime forces** — conditions that favor or punish those primitives.
3. **Contemporary expressions** — current instruments, sectors, and themes.

Sectors rotate. Instruments evolve. Capital behaviors persist.

## Further correction: labels must be strategic, not perceptual

The earlier language still relied too much on perceptual labels such as `SUPPORTIVE`, `DEFENSIVE`, `FRAGILE`, or `EXTENDED`.

Those labels are useful as quick tags, but they are not sufficient for Capital Radar's ontology.

A stronger system should not merely say:

```text
Rates: defensive.
Equity: supportive.
Crypto: fragile.
```

It should say:

```text
What capital claim is this?
What regime force governs it?
What transmission is active now?
What portfolio command follows?
What would invalidate that command?
How reliable is the evidence?
```

## Strategic annotation grammar

Each primitive row should use this grammar:

```text
Capital Claim -> Regime Driver -> Active Transmission -> Strategic Command -> Invalidation -> Evidence Tier
```

This converts the row from a mood read into a decision machine.

### Required row fields

| Field | Meaning | Example |
|---|---|---|
| Capital Claim | What form of ownership / claim / protection this primitive represents | State duration claim |
| Regime Driver | The macro force that makes the claim valuable or dangerous | Real yields / policy path |
| Active Transmission | What is happening now | Rate pressure compresses valuation multiples |
| Strategic Command | What the portfolio should do | Own selectively; do not chase duration-heavy growth |
| Invalidation | What would change the command | Yields break lower and breadth confirms |
| Evidence Tier | How reliable the signal is | AUTH / PROXY / MISSING / STALE |

## Better label set

Avoid using only broad mood labels.

Use layered labels instead.

### 1. Capital claim labels

These describe what the asset *is* at a structural level.

| Primitive | Capital claim label |
|---|---|
| Money / Cash | Liquidity reserve claim |
| Sovereign Bonds / Duration | State duration claim |
| Credit | Private repayment claim |
| Equity Ownership | Productive surplus claim |
| Innovation / Growth Themes | Future optionality claim |
| Real Assets | Real collateral claim |
| Commodities / Inputs | Input scarcity claim |
| Monetary Alternatives | Sovereign-trust escape claim |
| FX / Dollar | Relative monetary trust claim |
| Volatility / Insurance | Convex protection claim |

### 2. Regime driver labels

These describe what condition governs the primitive.

| Regime driver | Meaning |
|---|---|
| Liquidity impulse | Expanding or contracting money availability |
| Price of time | Nominal / real rates and discount-rate pressure |
| Credit trust | Spreads, defaults, lending standards, refinancing ability |
| Productive growth | Earnings, margins, capex, productivity, demand |
| Inflation impulse | Purchasing-power erosion and nominal repricing |
| Scarcity pressure | Physical bottlenecks, energy, materials, shipping, geopolitics |
| Currency pressure | Dollar/liquidity stress and relative monetary trust |
| Narrative duration | How far into the future the market is willing to pay |
| Volatility price | Cost of protection, disorder, and forced deleveraging |
| Positioning pressure | Crowding, under-ownership, squeeze risk, exhaustion |

### 3. Strategic command labels

These are more useful than `supportive` or `defensive` because they say what to do.

| Command | Meaning |
|---|---|
| Hold optionality | Keep cash / dry powder valuable |
| Underwrite selectively | Risk can be owned only where compensation is adequate |
| Own core | Maintain exposure; do not necessarily add |
| Probe at ruled zones | Small starter exposure only at defined levels |
| Add with confirmation | Increase only if multiple regime drivers align |
| Avoid chase | Upside exists but asymmetry is weak at current price |
| Cap size | Keep exposure limited because confirmation is incomplete |
| Hedge / insure | Protection is justified or cheap relative to risk |
| Harvest / trim | Reduce exposure after crowding, valuation, or exhaustion |
| Exit on invalidation | Leave if thesis or regime condition breaks |

### 4. Evidence tier labels

These govern confidence.

| Evidence tier | Meaning |
|---|---|
| AUTH | Direct, current, high-quality signal |
| PROXY | Useful proxy, but not the primitive itself |
| PARTIAL | Some evidence exists, but coverage is incomplete |
| MISSING | No validated artifact yet |
| STALE | Evidence exists but is not fresh enough |
| CONFLICTED | Evidence points in competing directions |

## What this yields on the actual web

This change should yield one Macro subpanel that reads like a timeless capital map, not a 2026 ticker dashboard.

The homepage still remains:

```text
Macro
Decision chart
Holdings
Opportunity
```

Inside Macro, the user would see a compact block similar to this:

```text
CAPITAL PRIMITIVE LENS

Overall command: OWN CORE / PROBE SELECTIVELY

Capital is still willing to own productive surplus, but confirmation is incomplete. State duration, speculative liquidity, and narrative-duration pressure prevent broad Add permission.

Primitive                 Claim type                    Driver              Transmission                         Command
Money / Cash              Liquidity reserve claim        Liquidity impulse   Optionality remains valuable          Hold optionality
Sovereign Duration        State duration claim           Price of time       Rate pressure limits multiples        Avoid duration chase
Credit                    Private repayment claim        Credit trust        Confirmation not yet validated        Underwrite selectively
Equity Ownership          Productive surplus claim       Productive growth   Index strength remains narrow         Own core
Innovation Themes         Future optionality claim       Narrative duration  Leadership is extended                Avoid chase
Real Assets               Real collateral claim          Inflation / rates   Quality matters more than leverage    Underwrite selectively
Commodities / Inputs      Input scarcity claim           Scarcity pressure   Bottleneck signal not yet decisive    Watch
Monetary Alternatives     Sovereign-trust escape claim   Liquidity / trust   Speculative liquidity is fragile      Cap size
FX / Dollar               Relative monetary trust claim  Currency pressure   Missing confirmation                  Cap confidence
Volatility / Insurance    Convex protection claim        Volatility price    Protection price is contained         Hold risk, keep hedge discipline

Invalidation to upgrade: credit improves, dollar liquidity eases, breadth broadens, and duration pressure falls.
Invalidation to downgrade: credit stress widens, volatility reprices, or leadership narrows further.
```

## Why this is different from the old Cross-Asset Lens

The old version said:

```text
SPX supportive
QQQ extended
TLT defensive
BTC defensive
VIX contained
```

The new version asks:

```text
What form of capital claim is being rewarded or punished?
What regime force is transmitting that reward or punishment?
What portfolio command follows?
```

So SPX is not the category. It is a current proxy for Equity Ownership.

QQQ / AI is not the category. It is a current expression of Innovation / Growth Themes.

TLT is not the category. It is a proxy for Sovereign Bonds / Duration.

BTC is not the category. Depending on regime, it may express Monetary Alternatives, speculative liquidity, or network-beta risk.

VIX is not the category. It is a proxy for Volatility / Insurance.

## Product role

The Capital Primitive Lens should answer:

> Where is capital hiding, defending, reaching, escaping, compounding, buying insurance, or crowding into narrative?

It should make the user more capable of deciding:

- Watch
- Probe
- Add
- Hold
- Trim
- Exit

## Destination

Primary destination:

- Macro section

Do not return as:

- standalone homepage section
- generic asset allocation table
- educational encyclopedia
- market-news feed
- bloated multi-panel dashboard

## Required primitive categories

The Macro section should eventually understand these durable primitives:

| Capital Primitive | Capital claim | Timeless meaning | Modern proxies / expressions |
|---|---|---|---|
| Money / Cash | Liquidity reserve claim | Optionality, survival, purchasing power | cash, T-bills, money markets, stablecoins |
| Sovereign Bonds / Duration | State duration claim | State credit, policy trust, price of time | Treasuries, TLT, yield curve, real yields |
| Credit | Private repayment claim | Trust in borrower repayment | corporate bonds, HY spreads, bank lending, private credit |
| Equity Ownership | Productive surplus claim | Claim on productive surplus | SPX, stocks, private companies |
| Innovation / Growth Themes | Future optionality claim | Future cash-flow expansion and narrative duration | AI, semis, software, biotech, cloud |
| Real Assets | Real collateral claim | Control of scarce physical utility | real estate, infrastructure, farmland, data centers |
| Commodities / Inputs | Input scarcity claim | Control of necessary materials and energy | oil, gas, copper, uranium, grains, shipping |
| Monetary Alternatives | Sovereign-trust escape claim | Escape from fiat or sovereign trust risk | gold, silver, Bitcoin, hard assets |
| FX / Dollar | Relative monetary trust claim | Relative trust between monetary systems | DXY, USD liquidity, EUR, JPY, EM FX |
| Volatility / Insurance | Convex protection claim | Price of protection and disorder | VIX, options, skew, CDS, hedges |

## Web-level hierarchy

The visible Macro layer should not show every detail at once.

Recommended visible structure:

1. Overall strategic command
2. 8-10 compressed primitive rows
3. Upgrade / downgrade invalidation
4. One confidence / missing-evidence tag

It should feel like a compact institutional regime table, not an educational chart.

## Primitive row contract

Each row should show:

- primitive name
- capital claim
- regime driver
- active transmission
- strategic command
- evidence tier

Example:

```text
Sovereign Bonds / Duration
State duration claim
Price of time
Rate pressure limits valuation expansion.
Avoid duration chase.
PROXY
```

Status vocabulary can still exist, but it becomes secondary.

Secondary condition tags:

- SUPPORTIVE
- DEFENSIVE
- SELECTIVE
- EXTENDED
- FRAGILE
- WATCH
- MISSING
- CONFLICTED

These should not be the primary labels. They are visual badges, not the ontology.

## Action translation

| Strategic command | Macro implication |
|---|---|
| Hold optionality | Keep cash/dry powder valuable; do not force deployment |
| Underwrite selectively | Risk can be owned only where price compensates for uncertainty |
| Own core | Maintain exposure, but do not automatically add |
| Probe at ruled zones | Starter exposure only at defined levels and invalidation points |
| Add with confirmation | Increase when multiple regime drivers align |
| Avoid chase | Do not buy narrative or duration at any price |
| Cap size | Keep exposure limited because confirmation is incomplete |
| Hedge / insure | Protection is justified or insurance is cheap versus risk |
| Harvest / trim | Reduce after crowding, valuation, or exhaustion |
| Exit on invalidation | Leave if thesis or regime condition breaks |

## Mapping from current artifact to primitives

The existing `outputs/market-lens-state.json` can still be used, but it must be treated as proxy data, not the ontology.

Current proxy mapping:

| Current artifact lens | Existing read | Primitive mapping | Claim type | Regime driver | Strategic command |
|---|---|---|---|---|---|
| SPX / Broad market | SUPPORTIVE | Equity Ownership | Productive surplus claim | Productive growth / liquidity impulse | Own core; add only at ruled zones |
| QQQ / AI-growth | EXTENDED | Innovation / Growth Themes | Future optionality claim | Narrative duration / positioning pressure | Avoid chase |
| TLT / rate-cycle pressure | DEFENSIVE | Sovereign Bonds / Duration | State duration claim | Price of time | Avoid duration-dependent valuation expansion |
| BTC / speculative liquidity | DEFENSIVE | Monetary Alternatives / Speculative Liquidity | Sovereign-trust escape claim / speculative-liquidity proxy | Liquidity impulse / currency trust | Cap size |
| VIX / volatility | CONTAINED | Volatility / Insurance | Convex protection claim | Volatility price | Hold risk, but keep hedge discipline |

Required missing primitives to add later:

- Money / Cash
- Credit
- Real Assets
- Commodities / Inputs
- FX / Dollar

These missing primitives should be marked as `MISSING`, `PARTIAL`, or `WATCH` until data contracts are created.

Do not pretend current data covers the full capital structure.

## Verdict contract

The subpanel must end with a strategic sentence, not a mood sentence.

Preferred form:

```text
The portfolio command is [command] because [capital claims] are [transmission], while [missing/contradicting primitives] prevent [stronger command]. Upgrade if [conditions]. Downgrade if [conditions].
```

Examples:

```text
The portfolio command is Own Core / Probe Selectively because equity ownership remains supported, while state duration pressure, stretched innovation leadership, and fragile speculative liquidity prevent broad Add. Upgrade if credit improves, breadth broadens, and duration pressure falls. Downgrade if volatility reprices or credit stress widens.
```

```text
The portfolio command is Hold Optionality because liquidity reserve value is high and credit confirmation is missing. Upgrade only after credit trust and productive-risk breadth improve.
```

```text
The portfolio command is Cap Size because monetary alternatives and speculative liquidity are not confirming risk expansion, even though volatility remains contained.
```

## Implementation constraints

When implemented:

- Do not enable `market-lens-section` as a standalone visible section.
- Do not add a fifth homepage section.
- Do not present SPX/QQQ/TLT/BTC/VIX as the full asset-class map.
- Do not invent data for missing primitives.
- Do not rewrite the full build pipeline.
- Do not create new data collectors in the first implementation unless explicitly scoped.
- Do not display every cross-asset detail.

## Minimum viable implementation

The first implementation should produce a compact Macro primitive table using available data plus explicit missing-evidence rows.

Minimum visible rows:

1. Sovereign Bonds / Duration — from TLT/rate-cycle pressure
2. Equity Ownership — from SPX broad market
3. Innovation / Growth Themes — from QQQ / AI-growth
4. Monetary Alternatives / Speculative Liquidity — from BTC
5. Volatility / Insurance — from VIX
6. Credit — MISSING or WATCH
7. FX / Dollar — MISSING or WATCH
8. Commodities / Inputs — MISSING or WATCH
9. Money / Cash — MISSING or WATCH unless cash/liquidity artifact exists
10. Real Assets — MISSING or WATCH unless real-asset artifact exists

This gives the user both current insight and a clear view of what the system does not yet know.

## Acceptance criteria

After implementation:

1. Homepage still has exactly four visible sections.
2. Macro contains a compact Capital Primitive Lens.
3. The lens distinguishes primitives from modern proxies.
4. The primary annotation system uses claim, driver, transmission, command, invalidation, and evidence tier.
5. Missing primitives are not hallucinated.
6. The lens produces a decision command and upgrade/downgrade invalidation.
7. `market-lens-section` remains disabled in `config/homepage-sections.json` unless explicitly changed later.
8. No standalone Cross-Asset Lens section appears.
9. `npm run build:fast` passes.
10. `scripts/validate-four-section-homepage.cjs` passes as part of the build path.

## Suggested implementation sequence

### Step 1 — inspect current market-lens state

Inspect:

- `outputs/market-lens-state.json`
- `scripts/generate-market-lens-state.cjs`
- `components/radar/market-lens/render.cjs`
- `components/radar/decision-brief/render.cjs`

Goal:

Identify which existing signals can be safely mapped into primitive rows.

### Step 2 — add a primitive adapter

Preferred approach:

- create a small helper that converts proxy lenses into primitive rows.

Avoid:

- copying the full old market-lens renderer into Macro.
- using ticker symbols as row names.

### Step 3 — render compact Macro subpanel

Render the Capital Primitive Lens inside Macro after the primary decision brief and before detailed macro metrics, unless visual inspection suggests a better internal location.

### Step 4 — verify four-section rule

Run:

```bash
npm run build:fast
```

Then confirm:

- no `market-lens-section` visible in final `index.html`
- Macro contains Capital Primitive Lens
- build report passes

## Copy direction

Tone should be institutional, timeless, and compressed.

Avoid:

- `SPX is up so market is bullish.`
- `Crypto is weak so risk is bad.`
- `AI is hot.`
- `The market is mixed.`
- `Rates are defensive.` without saying what command follows.

Prefer:

- `Equity ownership is supported, but breadth and duration confirmation remain incomplete.`
- `Innovation leadership is extended; avoid paying any price for narrative duration.`
- `State duration pressure limits valuation expansion.`
- `Speculative liquidity is fragile; cap position size.`
- `Missing credit and FX confirmation caps confidence.`
- `Upgrade only if credit trust improves and dollar liquidity eases.`

## Final decision law

The Capital Primitive Lens earns visibility only when it helps determine permission, sizing, timing, contradiction, missing evidence, or confidence.

Its purpose is not to show more markets. Its purpose is to reveal what form of capital behavior the market is rewarding or punishing, and what portfolio command follows.
