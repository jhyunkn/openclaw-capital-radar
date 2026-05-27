# Cross-Asset Lens -> Macro Compression Spec

## Mission

Compress the latent Cross-Asset Lens module into the Macro section as a decision-support evidence layer.

This is a specification-only mission. It does not implement UI or modify the live homepage.

## What this yields on the actual web

This change should yield one small Macro subpanel, not a new homepage section.

The final page should still read as:

```text
Macro
Decision chart
Holdings
Opportunity
```

Inside Macro, the user would see a compact block similar to this:

```text
CROSS-ASSET CONFIRMATION

Overall read: LIMITING
Cross-asset evidence is limiting new exposure because growth leadership is extended while rate pressure and speculative liquidity remain defensive. Volatility containment supports holding risk, but does not justify chasing size.

Broad market     SUPPORTIVE      Hold core; add only at ruled zones.
Growth / AI      EXTENDED        Avoid chasing AI beta.
Rates            DEFENSIVE       Do not assume valuation expansion.
Crypto liquidity DEFENSIVE       Treat risk appetite as fragile.
Volatility       CONTAINED       Supports holding risk.

Implication: Probe only at ruled zones. Do not upgrade to Add unless rates and speculative liquidity confirm.
```

This is the practical web implication:

- Macro becomes more decision-aware.
- The old Cross-Asset Lens does not come back as a separate visible section.
- The user sees why Macro permission is limited, not just what the equity chart says.
- The dashboard gains an evidence bridge between market regime and portfolio action.

## Before / after implication

### Before

Macro can say the broad regime is constructive or defensive, but supporting cross-asset evidence is either hidden, disabled, or too separate from the main decision.

### After

Macro can say:

```text
The equity regime is supportive, but cross-asset confirmation is incomplete: growth is extended, TLT remains defensive, BTC/risk appetite is fragile, while VIX is contained. Therefore the action state stays Probe/Hold, not Add.
```

This makes the web more useful because it explains why Capital Radar is not simply chasing the chart.

## Current source evidence

The existing market-lens artifact already contains enough information to support a compressed Macro summary.

Current state example from `outputs/market-lens-state.json`:

- artifact: `market-lens-state`
- regime: `defensive pressure`
- supportive signals: 2
- defensive signals: 2
- stances include `SUPPORTIVE`, `EXTENDED`, `DEFENSIVE`, and `CONTAINED`
- SPX read: `Broad regime supports holding core risk.`
- QQQ read: `Growth leadership is stretched.`
- TLT read: `Bond weakness keeps rate pressure on valuations.`
- BTC read: `Speculative liquidity is deteriorating.`
- VIX action: `Volatility contained: supports holding risk.`

The visible Macro layer should compress those reads into a decision verdict, not display the whole old module.

## Why this module should return

Cross-Asset Lens is useful because macro permission is not determined by equity price alone. Rates, credit, dollar/liquidity conditions, crypto/risk appetite, breadth, and volatility can either confirm or contradict the headline equity regime.

The previous standalone module was removed because it was too large and did not force a decision. It should return only as compressed evidence inside Macro.

## Destination

Primary destination:

- Macro section

Do not return as:

- standalone homepage section
- separate dashboard panel
- full educational module
- market-news feed

## Product role

The compressed Cross-Asset Lens should answer:

> Are non-equity signals confirming, contradicting, or limiting the current market permission?

It should make the user more capable of deciding:

- Watch
- Probe
- Add
- Hold
- Trim
- Exit

## Proposed visible form

A compact Macro subpanel titled:

```text
Cross-Asset Confirmation
```

Alternative shorter title:

```text
Confirmation Lens
```

Recommended layout:

- one row of 4-6 small evidence cells
- one final verdict sentence
- one confidence/freshness tag

It should be visually subordinate to the main Macro decision brief.

## Evidence cells

Preferred cells based on existing artifact fields:

1. Broad market
2. Growth / AI leadership
3. Rates
4. Crypto / speculative liquidity
5. Volatility

Optional future cells if available:

1. Dollar / liquidity
2. Credit
3. Breadth

Do not invent unavailable cells. If a cell has no reliable state, mark it `MISSING` or omit it.

## Cell contract

Each cell should show:

- label
- stance
- compressed read/action
- confirmation status

Example structure:

```text
Rates
DEFENSIVE
Do not assume valuation expansion.
LIMITING
```

Status vocabulary:

- CONFIRMING
- CONTRADICTING
- LIMITING
- NEUTRAL
- MISSING

## Verdict contract

The subpanel must end with one sentence in this form:

```text
Cross-asset evidence is [confirming / contradicting / limiting / neutral] the Macro permission because [specific reason].
```

Examples:

```text
Cross-asset evidence is confirming selective risk because broad market strength and volatility containment agree.
```

```text
Cross-asset evidence is limiting new exposure because growth leadership is stretched while rates and speculative liquidity remain defensive.
```

```text
Cross-asset evidence is contradicting the rally because rate pressure and speculative liquidity are deteriorating despite equity strength.
```

## Action translation

The Cross-Asset Lens must translate into one of these effects:

| Cross-asset verdict | Macro implication |
|---|---|
| CONFIRMING | Add/probe permission improves if price and thesis also align |
| LIMITING | Probe only; avoid large adds |
| CONTRADICTING | Watch or trim; wait for confirmation |
| NEUTRAL | Do not change action state |
| MISSING | Cap confidence and sizing |

## Data source expectation

Likely source artifact:

- `outputs/market-lens-state.json`

Likely existing generator:

- `scripts/generate-market-lens-state.cjs`

Likely existing renderer:

- `components/radar/market-lens/render.cjs`

Likely implementation destination:

- `components/radar/decision-brief/render.cjs`

The implementation should read or receive the existing market-lens state and render only the compressed summary inside Macro.

## Implementation constraints

When implemented:

- Do not enable `market-lens-section` as a visible standalone section.
- Do not add a fifth homepage section.
- Do not rewrite the build pipeline.
- Do not create new market-data logic unless existing state is insufficient.
- Do not display every cross-asset detail.
- Do not turn this into a generic macro dashboard.

## Acceptance criteria

After implementation:

1. Homepage still has exactly four visible sections.
2. Macro contains a compact Cross-Asset Confirmation layer.
3. Cross-asset evidence translates into permission, limitation, contradiction, or confidence.
4. `market-lens-section` remains disabled in `config/homepage-sections.json` unless explicitly changed later.
5. No standalone Cross-Asset Lens section appears.
6. `npm run build:fast` passes.
7. `scripts/validate-four-section-homepage.cjs` passes as part of the build path.

## Suggested implementation sequence

### Step 1 — inspect state

Inspect:

- `outputs/market-lens-state.json`
- `scripts/generate-market-lens-state.cjs`
- `components/radar/market-lens/render.cjs`
- `components/radar/decision-brief/render.cjs`

Goal:

Identify the smallest reliable data contract for a compressed Macro summary.

### Step 2 — add adapter/helper

Preferred approach:

- create a small helper inside the Macro renderer or a nearby utility that converts market-lens state into cells plus verdict.

Avoid:

- copying the full market-lens renderer into Macro.

### Step 3 — render compact subpanel

Render the subpanel inside Macro after the primary decision brief and before detailed macro metrics, unless visual inspection suggests a better internal location.

### Step 4 — verify four-section rule

Run:

```bash
npm run build:fast
```

Then confirm:

- no `market-lens-section` visible in final `index.html`
- Macro contains Cross-Asset Confirmation
- build report passes

## Copy direction

Tone should be institutional and compressed.

Avoid:

- “The market is mixed”
- “Investors should be cautious”
- “Stocks may go up or down”

Prefer:

- “Rates are limiting confirmation.”
- “Growth leadership is extended; avoid chasing AI beta.”
- “Volatility containment permits Hold/Probe, not automatic Add.”
- “Speculative liquidity weakness blocks size expansion.”

## Final decision law

Cross-Asset Lens earns visibility only when it changes permission, sizing, timing, contradiction, or confidence.
