# Cross-Asset Lens -> Macro Compression Spec

## Mission

Compress the latent Cross-Asset Lens module into the Macro section as a decision-support evidence layer.

This is a specification-only mission. It does not implement UI or modify the live homepage.

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

Preferred cells:

1. Rates
2. Dollar / liquidity
3. Credit
4. Volatility
5. Breadth / leadership
6. Crypto / risk appetite

If only four cells are practical, use:

1. Rates
2. Liquidity
3. Credit
4. Volatility

## Cell contract

Each cell should show:

- label
- current state
- directional implication
- confirmation status

Example structure:

```text
Rates
Pressure easing
Supports selective risk
CONFIRMING
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
Cross-asset evidence is confirming selective risk because rates pressure is easing and volatility remains contained.
```

```text
Cross-asset evidence is limiting new exposure because credit and volatility are not confirming the equity advance.
```

```text
Cross-asset evidence is contradicting the rally because dollar strength and rising yields are tightening liquidity conditions.
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

- create a small helper inside the Macro renderer or a nearby utility that converts market-lens state into 4-6 cells plus verdict.

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
- “Credit is not yet validating new exposure.”
- “Volatility containment permits Probe, not Add.”
- “Liquidity contradiction blocks size expansion.”

## Final decision law

Cross-Asset Lens earns visibility only when it changes permission, sizing, timing, contradiction, or confidence.
