# Capital Radar Agent Instructions

## Project identity

Capital Radar is a private investment decision-support dashboard operated through OpenClaw and implemented through Codex or direct GitHub edits when Codex is unavailable.

It is not a generic finance blog, not a market-news page, and not a startup landing page. It is a decision surface for converting market evidence into portfolio action states.

## Product architecture

The public homepage is a five-section decision surface:

1. Narrative vs. Reality (Market read)
2. Macro
3. Decision chart
4. Holdings
5. Opportunity

Supporting modules may exist as internal evidence inputs, but they should not return as standalone visible homepage sections unless explicitly approved.

Latent modules should be compressed into the four-section surface:

- Cross-Asset Lens -> Macro confirmation, contradiction, liquidity, and intermarket context.
- Asset Allocation Route -> Macro permission, Holdings sizing posture, Opportunity promotion gate.
- Market Tape -> Macro near-term confirmation or contradiction.
- Kostolany Egg -> Macro cycle regime interpretation, not a standalone diagram.
- Trust / Data Quality -> source authority, freshness, and confidence signals inside each relevant section.
- System Health -> internal edit-readiness artifact unless explicitly surfaced as a small status badge.

## Narrative vs. Reality synthesis (operating loop step)

After running the build pipeline, Claude Code must synthesize `outputs/narrative-reality-brief.json` from `outputs/narrative-reality-input.json`. This is a required step in every operating loop run.

**How to run it:**
1. Read `outputs/narrative-reality-input.json` — it contains the current market snapshot, dislocation data, active event signals, filtered news, and synthesis instructions.
2. Synthesize the brief following the `synthesisInstructions` field in that file.
3. Write the result to `outputs/narrative-reality-brief.json` using the schema below.
4. The inject script will pick it up automatically on the next build.

**Schema for `outputs/narrative-reality-brief.json`:**
```json
{
  "generatedAt": "<ISO timestamp>",
  "generatedBy": "openclaw-synthesis",
  "themes": [
    {
      "id": "<snake_case_id>",
      "label": "<Theme name, e.g. Nuclear / AI Power>",
      "classification": "NARRATIVE_AHEAD | DATA_AHEAD | ALIGNED",
      "narrative": "<1-2 sentences: what the market/news implies the world believes>",
      "dataAnchor": "<2-4 sentences: what the hard data actually shows — cite specific numbers>",
      "counterRead": "<2-4 sentences: where narrative and data diverge, and what it means for positioning>",
      "watchFor": "<1 sentence: specific measurable trigger that would change this read>",
      "relevantTickers": ["<TICKER>", ...]
    }
  ],
  "strategyPosture": "<1-2 sentences: current action posture for the portfolio>",
  "whereWaveBuilds": "<1-2 sentences: where the next move is most likely to materialize and what the trigger is>",
  "watchFor": ["<specific measurable signal>", ...]
}
```

**Classification rules:**
- `NARRATIVE_AHEAD` — price is ahead of fundamentals. The story has run past what the data supports. Caution.
- `DATA_AHEAD` — fundamentals are ahead of price. The business is building while the narrative hasn't caught up. Opportunity.
- `ALIGNED` — narrative and data broadly agree. No significant divergence. Useful for confirming existing posture.

**Filtering — what to include as themes:**
- Themes from `activeEvents` in narrative-reality-input.json (these are confirmed by news signal detection)
- Themes where a tracked ticker (holdings or opportunity universe) shows significant dislocation (>20% from 52wH) AND has news context
- Macro themes (credit, rates, dollar) when they diverge from equity price action
- Maximum 5-6 themes. Quality over coverage.

**What not to do:**
- Do not summarize headlines. The brief is a thesis audit, not a news digest.
- Do not invent data points. Every claim must be anchored to a number in narrative-reality-input.json.
- Do not use filler language ("it remains to be seen", "investors should monitor"). Be direct.

## Investment analysis standard

Do not provide generic market commentary. All ticker, sector, or portfolio analysis should be structured as decision support:

1. Market regime
2. Liquidity condition
3. Sector/theme rotation
4. Ticker-specific thesis
5. Valuation/expectation gap
6. Entry timing
7. Invalidation signal
8. Position-sizing logic
9. Risk scenario
10. Final action state

Allowed final action states:

- Watch
- Probe
- Add
- Hold
- Trim
- Exit

A research candidate is not a buy recommendation. A visible opportunity must show what would promote it, what would invalidate it, and what evidence is missing.

## Repository model

This is a Node-generated static dashboard. Do not assume this is a normal React app.

Canonical concepts:

- `config/homepage-sections.json` controls homepage section policy.
- `config/build-pipeline.json` controls the staged production pipeline.
- `scripts/render-capital-radar-home.cjs` is the canonical homepage render orchestrator.
- Section renderers live under `components/radar/`.
- Generated state and reports live under `outputs/`.
- Packaged static output lives under `public/`.

## Build commands

Use the narrowest verification command that matches the mission.

For UI-only homepage refinements:

```bash
npm run build:fast
```

For data/research artifact refresh:

```bash
npm run refresh:data
```

For validation-only work:

```bash
npm run validate:lane
```

For production-grade confidence:

```bash
npm run build:prod
```

For homepage registry preview checks:

```bash
npm run preview:homepage-registry:strict
```

Do not claim deployment or production success unless Vercel/GitHub deployment status has been checked separately.

## Change discipline

Default to the smallest safe change.

Before editing code, classify the mission:

- INTEL: market/ticker research only.
- DASHBOARD: visible web/UI refinement.
- PIPELINE: data, state, scripts, validation, or build system.
- VERIFY: read/run/report only.
- DOCTRINE: repo rules and operating documents.
- ARCHIVE: changelog, roadmap, or decision memory.

Do not mix INTEL, DASHBOARD, PIPELINE, and DEPLOYMENT work in the same change unless explicitly approved.

## Four-section rule

Do not add visible standalone homepage sections.

If a disabled module is needed, integrate its decision value into one of the four sections:

- Macro: regime, liquidity, cycle, confirmation, contradiction, permission.
- Decision chart: price zones, technical confirmation, support/resistance, invalidation.
- Holdings: current positions, thesis status, zone logic, sizing, invalidation.
- Opportunity: asymmetric candidates, promotion gates, evidence gaps, near-misses.

A module can return only if it answers:

> Does this make the user more capable of deciding Watch / Probe / Add / Hold / Trim / Exit?

If not, keep it internal.

## Forbidden behaviors

- Do not add generic financial disclaimers as filler.
- Do not turn candidates into recommendations without action-state logic.
- Do not create new visible homepage sections by default.
- Do not bypass `config/homepage-sections.json` for homepage architecture.
- Do not edit generated artifacts unless the mission explicitly requires generated output changes.
- Do not perform broad visual redesigns while solving data or pipeline issues.
- Do not remove validators to make a build pass.
- Do not claim deployment success without external verification.

## Completion report

Every mission should report:

1. Mission type
2. Files changed
3. What changed
4. Verification run
5. Result
6. Remaining risk
7. Whether follow-up archive/doctrine updates are needed
