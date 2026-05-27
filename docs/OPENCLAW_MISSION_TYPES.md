# OpenClaw Mission Types for Capital Radar

## Purpose

OpenClaw should not send vague work into the repository. Every Capital Radar task must be classified before execution.

This prevents the system from mixing research judgment, UI editing, data pipeline work, deployment, and archive memory in one unstable loop.

## Required mission packet

Every mission should include:

1. Mission type
2. Objective
3. Allowed scope
4. Forbidden scope
5. Acceptance criteria
6. Verification method
7. Archive instruction

## Mission types

### INTEL

Purpose:

Market, ticker, sector, theme, portfolio, or macro analysis.

Allowed scope:

- read current outputs
- inspect current data artifacts
- produce research packet
- recommend Watch / Probe / Add / Hold / Trim / Exit state

Forbidden scope:

- no homepage edits
- no deployment
- no build-system changes
- no new visible modules

Required output:

- market regime
- liquidity condition
- sector/theme rotation
- ticker-specific thesis
- valuation/expectation gap
- entry timing
- invalidation signal
- position-sizing logic
- risk scenario
- final action state

Verification:

- source quality and evidence gaps must be stated
- no generic market commentary

### DASHBOARD

Purpose:

Visible web refinement.

Allowed scope:

- homepage shell
- four-section layout
- section renderers under `components/radar/`
- CSS and static copy
- compressed module integration into Macro / Decision chart / Holdings / Opportunity

Forbidden scope:

- no new visible standalone homepage sections
- no major data pipeline changes
- no build-system rewrites
- no deployment claims without verification

Default verification:

```bash
npm run build:fast
```

Escalated verification:

```bash
npm run build:prod
```

### PIPELINE

Purpose:

Data, state, research artifacts, build stages, validation scripts, or automation.

Allowed scope:

- `scripts/`
- `config/build-pipeline.json`
- data generators
- validators
- generated outputs only when regeneration is part of the mission

Forbidden scope:

- no visual redesign
- no homepage architecture change unless explicitly scoped
- no deletion of validators to force a pass

Default verification:

```bash
npm run validate:lane
```

For data refresh:

```bash
npm run refresh:data
```

For full confidence:

```bash
npm run build:prod
```

### VERIFY

Purpose:

Read, run, compare, and report without changing the repo.

Allowed scope:

- inspect files
- run scripts
- compare generated reports
- identify stale artifacts
- identify broken assumptions

Forbidden scope:

- no file edits
- no commits
- no deployment

Default verification options:

```bash
npm run build:fast
npm run validate:lane
npm run preview:homepage-registry:strict
```

Output must state:

- PASS / FAIL / PARTIAL
- commands run
- evidence
- unresolved risks

### DOCTRINE

Purpose:

Update operating rules, mission definitions, kernel principles, or documentation.

Allowed scope:

- `AGENTS.md`
- `README.md`
- `docs/CAPITAL_RADAR_KERNEL.md`
- `docs/OPENCLAW_MISSION_TYPES.md`
- `docs/CODEX_WORKFLOW.md`
- `docs/MODULE_REINTEGRATION_MAP.md`
- `docs/NO_CODEX_WORKFLOW.md`
- `docs/ROADMAP.md`

Forbidden scope:

- no app code
- no generated outputs
- no deployment

Verification:

- documentation is internally consistent
- instructions do not contradict manifest policy

### ARCHIVE

Purpose:

Record what changed, why it changed, and what should be remembered.

Allowed scope:

- changelog
- roadmap
- mission logs
- issue comments
- decision records

Forbidden scope:

- no functional code changes
- no data refresh
- no deployment

Required output:

- decision made
- reason
- affected files or sections
- future consequence
- next mission suggestion

## Mission packet template

```text
Mission Type:

Objective:

Allowed scope:

Forbidden scope:

Acceptance criteria:

Verification:

Archive instruction:
```

## Example: reintegrate Cross-Asset Lens

Mission Type:
DASHBOARD

Objective:
Compress Cross-Asset Lens into the Macro section as a confirmation / contradiction row.

Allowed scope:
- Macro renderer
- related Macro CSS
- state read from existing Cross-Asset Lens artifact

Forbidden scope:
- no standalone Cross-Asset Lens section
- no build-pipeline rewrite
- no changes to Holdings or Opportunity

Acceptance criteria:
- Macro shows cross-asset confirmation or contradiction in one compact row
- no new visible homepage section appears
- `validate-four-section-homepage` passes

Verification:
- `npm run build:fast`

Archive instruction:
- record that Cross-Asset Lens is now a Macro evidence input, not a standalone section

## Hard rule

OpenClaw should not dispatch work to Codex or direct GitHub edit until the mission packet is complete.
