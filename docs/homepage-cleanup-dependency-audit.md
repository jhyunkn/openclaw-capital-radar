# Homepage Cleanup Dependency Audit

## Status

This audit begins the post-Phase-2 cleanup-dependency reduction phase.

Phase 2 stabilized the Operational Chart by moving annotation composition and autoscale policy into the renderer. The next architectural weakness is that homepage assembly still depends on cleanup scripts after section injection.

The goal is not to remove cleanup scripts blindly. The goal is to distinguish:

- cleanup scripts that still prevent real output corruption
- cleanup scripts that are now redundant because canonical validation already catches the issue
- cleanup scripts that should become legacy guardrails rather than core assembly logic

## Active cleanup commands

Current active cleanup commands in `config/homepage-sections.json`:

```json
[
  "node scripts/strip-legacy-brief-strategy-home.cjs",
  "node scripts/strip-visual-regime-home.cjs",
  "node scripts/normalize-homepage-sections.cjs"
]
```

## Script classification

### 1. `scripts/strip-legacy-brief-strategy-home.cjs`

Current behavior:

- removes legacy sections:
  - `brief`
  - `strategy-section`
  - `chart-wall-section`
  - `spx-cycle-map-section`
  - `cycle-scenario-section`
  - `visual-regime-section`
  - `artifact-status-section`
- removes old nav links for those sections
- collapses repeated `decision-brief-section` nav links
- collapses repeated `operational-chart-section` nav links

Classification:

- Partially redundant, still useful as a guardrail.

Reasoning:

- Canonical validation already fails when legacy section IDs remain.
- However, the script still protects against malformed nested legacy output from older patch-chain builds.
- It should remain active until registry-driven assembly eliminates chained mutation risk.

Recommended near-term action:

- Keep active for now.
- Move its legacy-section list into a shared manifest/validator source later.
- Eventually convert it into a validator or one-time migration tool.

### 2. `scripts/strip-visual-regime-home.cjs`

Current behavior:

- removes old `regime-section` visual-regime content
- removes old `.visual-regime` style blocks
- removes nav links targeting `#regime-section`

Classification:

- Likely redundant.

Reasoning:

- `regime-section` is not part of the current active homepage contract.
- The cleanup manifest already bans the phrase `visual regime board`.
- Current section assembly should not generate this section.
- This script appears to be a narrow transitional patch from an older homepage state.

Recommended near-term action:

- Add `regime-section` to canonical legacy-section validation.
- Add `.visual-regime` / `#regime-section` detection to canonical homepage validation.
- Then remove `node scripts/strip-visual-regime-home.cjs` from active cleanup.
- Keep the file as legacy reference for one or two stable deployments before deletion or moving to `scripts/legacy/`.

### 3. `scripts/normalize-homepage-sections.cjs`

Current behavior:

- removes `macro-cycle-section`
- de-duplicates active sections:
  - `kostolany-egg-section`
  - `decision-brief-section`
  - `operational-chart-section`
  - `market-lens-section`
  - `strategy-routing-section`
  - `holdings-section`
  - `opportunities-section`
  - `market-section`
  - `trust-section`
- de-duplicates nav links for those sections

Classification:

- Still useful.

Reasoning:

- Current homepage assembly is still based on chained injector mutation.
- Until registry-driven assembly exists, duplicate section and nav risk still exists.
- Canonical validation catches malformed output after the fact, but this script can still repair harmless duplication before validation.

Recommended near-term action:

- Keep active.
- Later replace with registry-driven assembly, where duplicate section generation becomes structurally impossible.

## Recommended next implementation

The safest next code change is:

1. Add `regime-section` to `cleanup.legacySectionIds` in `config/homepage-sections.json`.
2. Add `#regime-section` and `.visual-regime` checks to canonical homepage validation.
3. Remove `node scripts/strip-visual-regime-home.cjs` from active cleanup commands.
4. Keep `scripts/strip-visual-regime-home.cjs` in the repo as a legacy reference.
5. Verify production deployment.

## Why this is the correct next move

This removes one cleanup dependency without touching active renderers or changing visible product behavior.

It is a controlled reduction:

- no homepage section renderer changes
- no chart runtime changes
- no market-intelligence logic changes
- one cleanup command removed
- validation strengthened to catch the same issue instead of silently stripping it

## Longer-term target

After this first reduction:

1. Continue moving cleanup assumptions into canonical validation.
2. Keep `normalize-homepage-sections.cjs` until registry-driven assembly exists.
3. Keep `strip-legacy-brief-strategy-home.cjs` until old malformed section risks are gone.
4. Build section-registry assembly so the homepage is composed in one deterministic pass.

Final target:

- generators produce validated JSON states
- renderers produce section HTML/CSS/runtime
- registry assembles homepage once
- cleanup scripts become rollback tools, not required build steps
