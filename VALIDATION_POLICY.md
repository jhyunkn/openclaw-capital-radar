# Capital Radar Validation Policy

Validators protect truth and render safety. They must not freeze product evolution.

## Core rule

Block unsupported intelligence. Do not block harmless schema evolution.

## Blocking failures

- A rendered market claim has no evidence reference.
- `render_permission` is true while required evidence is missing.
- An `evidence_id` does not resolve.
- `claim_type` is missing or invalid.
- A holding renders without permission, next evidence, or invalidation.
- An opportunity renders without macro direction.
- Homepage normal render proceeds while data truth fails.

## Warning-only issues

- Unknown extra fields in an artifact.
- A new UI section exists before legacy validators know it.
- A field is in migration and has a backward-compatible alias.
- Stale data is present but the page is explicitly degraded.
- A new enum is being tested and listed in the validation policy.

## Modes

Use three validation modes:

- `strict`: deployment hardening. Block all truth, schema, and freshness failures.
- `balanced`: default. Block truth failures, warn on migration issues.
- `migration`: temporary refactor mode. Block unsupported claims and unresolved evidence only; allow degraded render.

Set mode with:

```bash
CAPITAL_RADAR_VALIDATION_MODE=strict
CAPITAL_RADAR_VALIDATION_MODE=balanced
CAPITAL_RADAR_VALIDATION_MODE=migration
```

## Design principle

A validator should say either:

1. This is unsafe to render.
2. This is safe but incomplete.
3. This is allowed during migration.

It should not force old UI structure just because the product evolved.
