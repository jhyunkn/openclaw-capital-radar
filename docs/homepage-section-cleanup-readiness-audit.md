# Homepage Section Cleanup Readiness Audit

## Status

This audit covers the two post-registry-readiness scopes:

1. Holdings post-injection cleanup.
2. Opportunity Queue refinement and injection chain.

The purpose is to reduce hidden post-render mutation before introducing a non-authoritative homepage registry preview.

## Scope 1 — Holdings Translation

### Previous active chain

`config/homepage-sections.json` previously ran:

```txt
node scripts/generate-research-universe-state.cjs
node scripts/run-research-collectors-safe.cjs
node scripts/generate-institutional-source-states.cjs
node scripts/generate-holding-zone-state.cjs
node scripts/annotate-holding-zone-source.cjs
node scripts/apply-strategy-route-to-holdings.cjs
node scripts/validate-holding-zone-state.cjs
node scripts/inject-holdings-home-modular.cjs
node scripts/strip-holdings-role-method-home.cjs
```

### Cleanup script inspected

File:

```txt
scripts/strip-holdings-role-method-home.cjs
```

Behavior:

```js
html = html.replace(/<div class="mini-row"><span>Role<\/span><b>[\s\S]*?<\/div><\/article>/g, '</article>');
```

Classification:

- Cosmetic / legacy-output cleanup.
- Not a structural repair.
- Not a data correction.
- Not a validator.

### Renderer inspection

File:

```txt
components/radar/holdings/render.cjs
```

Current renderer output:

- renders zone cards
- renders zone source
- renders zone metrics
- renders permission note
- does not render the old `Role` / `Method` mini-row

Conclusion:

- The post-injection strip command is obsolete under current renderer ownership.
- The correct behavior is to validate absence of the legacy row, not strip it after render.

### Change made

Removed from Holdings command chain:

```txt
node scripts/strip-holdings-role-method-home.cjs
```

Added validator:

```txt
node scripts/validate-holdings-home-output.cjs
```

Validator report:

```txt
outputs/holdings-home-output-validation-report.json
```

Validation checks:

- exactly one `holdings-section`
- at least one `zone-card`
- zero legacy Role/Method rows

### Current Holdings readiness

Registry readiness:

```txt
HIGH
```

Remaining caveat:

- Holdings still has a substantial state-generation pipeline, but the section no longer depends on post-render cleanup.
- This is acceptable for a registry preview because state generation can remain manifest-driven while section assembly becomes registry-driven.

## Scope 2 — Opportunity Queue

### Active chain

`config/homepage-sections.json` runs:

```txt
node scripts/generate-opportunity-band-state.cjs
node scripts/refine-opportunity-asymmetry-filter.cjs
node scripts/apply-strategy-route-to-opportunities.cjs
node scripts/enrich-opportunity-near-miss-diagnostics.cjs
node scripts/inject-opportunities-home-modular.cjs
```

### Injector inspection

File:

```txt
scripts/inject-opportunities-home-modular.cjs
```

Behavior:

- reads `outputs/opportunity-asymmetry-state.json`
- requires `render_permission`
- calls `components/radar/opportunities/render.cjs`
- injects/replaces CSS
- replaces `opportunities-section` between section boundaries
- logs qualified / near / total count

Classification:

- Thin injector.
- No post-render cleanup.
- Suitable to become a compatibility wrapper.

### Renderer inspection

File:

```txt
components/radar/opportunities/render.cjs
```

Renderer owns:

- row flattening
- display-row selection
- summary strip
- empty state
- opportunity board layout
- responsive card layout

Classification:

- Renderer-owned presentation.
- Registry-compatible.

### Refinement scripts inspection

Files:

```txt
scripts/refine-opportunity-asymmetry-filter.cjs
scripts/apply-strategy-route-to-opportunities.cjs
scripts/enrich-opportunity-near-miss-diagnostics.cjs
```

Behavior:

- mutate opportunity JSON state
- add asymmetry scores
- apply strategy route permissions
- add near-miss diagnostics
- do not mutate `index.html`

Classification:

- State refinement passes, not post-render cleanup.
- Acceptable to keep before registry assembly.

### Current Opportunity readiness

Registry readiness:

```txt
MEDIUM-HIGH
```

Why not `HIGH` yet:

- The state pipeline has multiple sequential mutation passes.
- A future pass should consolidate these into a single state builder or at least add a state-validation report.

Why it is safe for registry preview:

- No post-render cleanup dependency exists.
- Injector is thin.
- Renderer owns display composition.

## Recommended next step

Build a non-authoritative registry preview.

Do not replace production `index.html` yet.

Target files:

```txt
scripts/homepage-section-registry.cjs
scripts/render-homepage-from-registry-preview.cjs
outputs/homepage-registry-preview.html
outputs/homepage-registry-preview-report.json
```

Preview goal:

- use existing generated state files
- call section renderers directly
- assemble sections in approved order
- compare section counts against current `index.html`
- prove one-pass assembly viability without touching production

## Risk controls for registry preview

The preview must:

- not replace `index.html`
- not remove existing injectors
- not remove existing cleanup scripts
- not become part of production ship path yet
- generate a report identifying missing states/renderers/section count mismatches

## Readiness summary

| Section | Renderer-owned? | Post-render cleanup? | Registry preview ready? |
|---|---:|---:|---:|
| Decision Brief | Yes | No | Yes |
| Operational Chart | Yes | No | Yes |
| Market Lens | Yes | No | Yes |
| Strategy Routing | Yes | No | Yes |
| Holdings | Yes | Removed | Yes |
| Opportunity Queue | Yes | No | Yes, with state-pipeline caveat |
| Market Tape | Yes | No | Yes, but compatibility status unresolved |
| Kostolany Egg | Yes | No | Yes, with upstream-state caveat |

## Final conclusion

The homepage is ready for a non-authoritative registry preview.

It is not yet ready for production registry migration.
