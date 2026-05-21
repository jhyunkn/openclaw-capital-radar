# Capital Radar Homepage Build Flow

## Purpose

Capital Radar homepage rendering is now manifest-driven. The goal is to keep the system adaptable: sections can be reordered, added, disabled, or validated without rewriting one monolithic orchestrator.

## Canonical files

- `config/homepage-sections.json` — section manifest and homepage assembly contract.
- `scripts/render-capital-radar-home.cjs` — canonical homepage orchestrator.
- `scripts/validate-operating-brain.cjs` — validates the operational homepage surface.
- `outputs/capital-radar-home-build-report.json` — build report written by the canonical renderer.

## Build model

The homepage build has three layers:

1. **Baseline shell**
   - The manifest currently runs `scripts/render-operating-brain-home.cjs` to create a disposable HTML shell.
   - This script is not the final homepage authority.

2. **Manifest sections**
   - Each enabled section in `config/homepage-sections.json` runs its own generator/injector commands.
   - Current sections:
     - `decision-brief-section`
     - `operational-chart-section`
     - `holdings-section`
     - `opportunities-section`
     - `market-section`

3. **Cleanup and validation**
   - Legacy sections are stripped after section injection.
   - The renderer validates that required sections appear exactly once.
   - Banned legacy phrases and `[object Object]` leaks fail the build.

## How to add a homepage section

1. Create a generator script if the section needs an artifact.
2. Create an injector script that renders the section into `index.html`.
3. Add a new section entry to `config/homepage-sections.json`:

```json
{
  "id": "new-section-id",
  "name": "New Section",
  "enabled": true,
  "required": true,
  "description": "What decision question this section answers.",
  "commands": [
    "node scripts/generate-new-section-state.cjs",
    "node scripts/inject-new-section-home.cjs"
  ]
}
```

4. Add any old section IDs or phrases to the cleanup lists if the new section replaces older content.
5. Run `npm run build` and check `outputs/capital-radar-home-build-report.json`.

## How to disable or reorder sections

Edit `config/homepage-sections.json` only:

- Set `enabled: false` to skip a section without deleting scripts.
- Reorder the `sections` array to change homepage order.
- Set `required: false` only for experimental sections that should not block deployment.

## Rule

Do not use section-specific scripts as hidden orchestrators.

For example, `scripts/inject-holdings-summary-home.cjs` must remain holdings-only. The canonical homepage sequence belongs in:

```txt
config/homepage-sections.json
scripts/render-capital-radar-home.cjs
```

## Current product hierarchy

The intended homepage hierarchy is:

1. Market Decision Brief — verdict and macro tape.
2. Operational Decision Chart — real chart plus OpenClaw rules.
3. Holdings — portfolio positions mapped to regime and price zones.
4. Opportunity — candidates and near-miss diagnostics.
5. Market Tape — confirmation/contradiction layer.
