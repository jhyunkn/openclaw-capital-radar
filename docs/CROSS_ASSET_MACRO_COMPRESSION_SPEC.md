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

Overall read: SELECTIVE / LIMITING
Capital is still willing to own productive risk, but the confirmation is incomplete. Duration pressure, speculative-liquidity weakness, and narrow growth leadership keep the regime from upgrading to broad Add.

Money / Cash                 OPTIONALITY VALUABLE      Keep dry powder; do not spend all risk budget.
Sovereign Bonds / Duration   DEFENSIVE                 Rates are not confirming valuation expansion.
Credit                       WATCH                     Needed to confirm whether risk can broaden.
Equity Ownership             SUPPORTIVE BUT NARROW     Hold core; add only at ruled zones.
Innovation / Growth Themes   EXTENDED                  Avoid chasing AI beta without reset.
Real Assets                  SELECTIVE                 Favor durable cash flow, not rate-sensitive leverage.
Commodities / Inputs         WATCH                     Monitor bottlenecks, inflation impulse, energy stress.
Monetary Alternatives        FRAGILE                   Speculative liquidity is not confirming full risk-on.
FX / Dollar                  CONFIRMATION NEEDED       Dollar/liquidity signal should be added as regime input.
Volatility / Insurance       CONTAINED                 Supports holding risk, not expanding size blindly.

Implication:
Probe only where price, thesis, and primitive-level confirmation align. Do not upgrade to Add until liquidity, credit, breadth, or duration pressure improves.
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

| Capital Primitive | Timeless meaning | Modern proxies / expressions |
|---|---|---|
| Money / Cash | Optionality, survival, purchasing power | cash, T-bills, money markets, stablecoins |
| Sovereign Bonds / Duration | State credit, policy trust, price of time | Treasuries, TLT, yield curve, real yields |
| Credit | Trust in borrower repayment | corporate bonds, HY spreads, bank lending, private credit |
| Equity Ownership | Claim on productive surplus | SPX, stocks, private companies |
| Innovation / Growth Themes | Future cash-flow expansion and narrative duration | AI, semis, software, biotech, cloud |
| Real Assets | Control of scarce physical utility | real estate, infrastructure, farmland, data centers |
| Commodities / Inputs | Control of necessary materials and energy | oil, gas, copper, uranium, grains, shipping |
| Monetary Alternatives | Escape from fiat or sovereign trust risk | gold, silver, Bitcoin, hard assets |
| FX / Dollar | Relative trust between monetary systems | DXY, USD liquidity, EUR, JPY, EM FX |
| Volatility / Insurance | Price of protection and disorder | VIX, options, skew, CDS, hedges |

## Web-level hierarchy

The visible Macro layer should not show every detail at once.

Recommended visible structure:

1. Overall primitive verdict
2. 8-10 compressed primitive rows
3. One implication sentence
4. One confidence / missing-evidence tag

It should feel like a compact institutional regime table, not an educational chart.

## Primitive row contract

Each row should show:

- primitive name
- current read
- interpretation
- action bias

Example:

```text
Sovereign Bonds / Duration
DEFENSIVE
Rates are not confirming valuation expansion.
Avoid overpaying for long-duration growth.
```

Status vocabulary:

- SUPPORTIVE
- DEFENSIVE
- SELECTIVE
- EXTENDED
- FRAGILE
- WATCH
- MISSING

## Action translation

| Primitive read | Macro implication |
|---|---|
| SUPPORTIVE | Can support Probe/Add if price and thesis align |
| DEFENSIVE | Limits valuation expansion and position size |
| SELECTIVE | Only high-quality or ruled-zone exposure allowed |
| EXTENDED | Avoid chasing; wait for reset or superior evidence |
| FRAGILE | Risk appetite not durable; cap size |
| WATCH | Important but not yet decisive |
| MISSING | Confidence capped until evidence improves |

## Mapping from current artifact to primitives

The existing `outputs/market-lens-state.json` can still be used, but it must be treated as proxy data, not the ontology.

Current proxy mapping:

| Current artifact lens | Existing read | Primitive mapping | Macro role |
|---|---|---|---|
| SPX / Broad market | SUPPORTIVE | Equity Ownership | Productive-risk confirmation, but check breadth |
| QQQ / AI-growth | EXTENDED | Innovation / Growth Themes | Crowding / narrative-duration risk |
| TLT / rate-cycle pressure | DEFENSIVE | Sovereign Bonds / Duration | Valuation multiple pressure |
| BTC / speculative liquidity | DEFENSIVE | Monetary Alternatives / Speculative Liquidity | Risk appetite and escape-asset signal |
| VIX / volatility | CONTAINED | Volatility / Insurance | Holding risk permitted, but not enough for Add |

Required missing primitives to add later:

- Money / Cash
- Credit
- Real Assets
- Commodities / Inputs
- FX / Dollar

These missing primitives should be marked as `MISSING` or `WATCH` until data contracts are created.

Do not pretend current data covers the full capital structure.

## Verdict contract

The subpanel must end with one sentence in this form:

```text
Capital primitive evidence is [confirming / limiting / contradicting / incomplete] because [specific primitive-level reason].
```

Examples:

```text
Capital primitive evidence is limiting new exposure because equities remain supportive, but duration pressure, stretched innovation leadership, and fragile speculative liquidity block broad Add permission.
```

```text
Capital primitive evidence is confirming selective risk because equity ownership, credit, liquidity, and volatility are aligned while valuation remains acceptable.
```

```text
Capital primitive evidence is incomplete because credit, dollar liquidity, commodities, and real assets are not yet represented by validated artifacts.
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

This gives the user both current insight and a clear view of what the system does not yet know.

## Acceptance criteria

After implementation:

1. Homepage still has exactly four visible sections.
2. Macro contains a compact Capital Primitive Lens.
3. The lens distinguishes primitives from modern proxies.
4. Missing primitives are not hallucinated.
5. The lens produces a decision implication.
6. `market-lens-section` remains disabled in `config/homepage-sections.json` unless explicitly changed later.
7. No standalone Cross-Asset Lens section appears.
8. `npm run build:fast` passes.
9. `scripts/validate-four-section-homepage.cjs` passes as part of the build path.

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

Prefer:

- `Equity ownership is supportive, but breadth and duration confirmation remain incomplete.`
- `Innovation leadership is extended; avoid paying any price for narrative duration.`
- `Duration pressure limits valuation expansion.`
- `Speculative liquidity is fragile; cap position size.`
- `Missing credit and FX confirmation caps confidence.`

## Final decision law

The Capital Primitive Lens earns visibility only when it helps determine permission, sizing, timing, contradiction, missing evidence, or confidence.

Its purpose is not to show more markets. Its purpose is to reveal what form of capital behavior the market is rewarding or punishing.
