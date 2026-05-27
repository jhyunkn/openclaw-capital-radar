# Capital Radar Module Reintegration Map

## Purpose

This document defines how previously disabled modules can return without bloating the homepage or drifting away from Capital Radar's mission.

Disabled does not mean unnecessary. It means the module failed the compression test at the time it was removed.

A module can return only if it is edited down into the four-section decision surface.

## Four-section destination model

| Destination | Function |
|---|---|
| Macro | Regime, liquidity, cycle, confirmation, contradiction, permission |
| Decision chart | Price behavior, zones, support/resistance, technical invalidation |
| Holdings | Owned-position thesis status, sizing, source authority, invalidation |
| Opportunity | Candidate asymmetry, promotion gates, missing evidence, near-misses |

## Reintegration rule

A module must answer at least one of these questions:

1. Does it change the action state?
2. Does it change position size?
3. Does it change invalidation?
4. Does it change entry timing?
5. Does it reveal evidence quality or missing evidence?
6. Does it identify confirmation or contradiction?

If the answer is no, the module remains internal.

## Module map

### Cross-Asset Lens

Previous problem:

- Too much standalone information.
- Did not force a decision.
- Could become a parallel dashboard competing with Macro.

New role:

- Macro confirmation and contradiction layer.

Compression target:

- One compact row or card cluster inside Macro.

Fields:

- equities confirmation
- rates pressure
- dollar / liquidity pressure
- credit spread tone
- crypto / risk appetite confirmation
- contradiction note
- confidence / freshness

Decision impact:

- permit risk-on
- reduce exposure
- wait for confirmation
- flag contradiction

Return condition:

- data can be summarized as permission, contradiction, or liquidity pressure.

### Asset Allocation Route

Previous problem:

- Too broad as a visible section.
- Could become generic portfolio advice.
- Did not always translate into specific action.

New role:

- Permission logic distributed across Macro, Holdings, and Opportunity.

Compression target:

- Macro: current route state.
- Holdings: sizing implication.
- Opportunity: promotion gate.

Fields:

- route state: risk-on / risk-off / barbell / cash / duration / selective risk
- exposure permission
- sizing posture
- what changes the route
- invalidation trigger

Decision impact:

- allows Add
- limits Probe
- forces Trim
- keeps Watch

Return condition:

- route logic changes allocation permission or position size.

### Market Tape

Previous problem:

- Risk of becoming a news feed or short-term noise surface.
- Too easy to over-display.

New role:

- Macro near-term confirmation or contradiction.

Compression target:

- One confirmation strip inside Macro.

Fields:

- breadth
- momentum
- volatility
- leadership
- reversal pressure
- tape verdict

Decision impact:

- confirms entry
- delays entry
- flags exhaustion
- forces risk control

Return condition:

- tape signals alter entry timing or risk posture.

### Kostolany Egg

Previous problem:

- Educational diagram could distract from decision surface.
- Cycle model was useful but too visually standalone.

New role:

- Macro cycle interpretation.

Compression target:

- small cycle badge or sentence inside Macro.

Fields:

- cycle phase
- rates direction
- liquidity direction
- crowd psychology
- expected asset behavior
- risk of phase transition

Decision impact:

- clarifies whether to accumulate, wait, trim, or defend.

Return condition:

- cycle model changes regime interpretation or action permission.

### Trust / Data Quality

Previous problem:

- Standalone trust panel became meta-information rather than decision support.

New role:

- Distributed confidence layer.

Compression target:

- source tier / freshness / confidence tags inside each relevant section.

Fields:

- AUTH / PARTIAL / PROXY / MISSING
- last updated
- freshness
- confidence
- evidence gap

Decision impact:

- blocks Add when evidence is weak
- limits sizing
- permits only Watch or Probe

Return condition:

- always eligible if it modifies confidence, size, or action permission.

### System Health

Previous problem:

- Useful for operator confidence, but not necessarily user-facing.

New role:

- internal edit-readiness and deployment confidence artifact.

Compression target:

- internal report or small status badge only.

Fields:

- build status
- data freshness
- artifact readiness
- deployment readiness
- validation status

Decision impact:

- tells whether the dashboard itself can be trusted operationally.

Return condition:

- if the system's own health affects whether visible information should be trusted.

## Reintegration sequence

### Phase 1 — doctrine and map

- Add operating doctrine.
- Define mission types.
- Define reintegration map.
- Do not edit live UI yet.

### Phase 2 — Macro compression

Start with Macro because most disabled modules belong there.

Order:

1. Cross-Asset Lens -> Macro confirmation / contradiction.
2. Market Tape -> Macro near-term timing.
3. Kostolany Egg -> Macro cycle badge.
4. Asset Allocation Route -> Macro permission statement.
5. Trust / Data Quality -> Macro confidence tags.

### Phase 3 — Holdings compression

- Asset Allocation Route -> sizing implication.
- Trust / Data Quality -> source authority per holding.

### Phase 4 — Opportunity compression

- Asset Allocation Route -> promotion gate.
- Trust / Data Quality -> evidence gate.
- Cross-Asset Lens -> theme confirmation only if relevant.

### Phase 5 — internal health

- Keep System Health internal unless a small edit-readiness badge is justified.

## Acceptance test

After each reintegration, the homepage must still validate as four sections:

```bash
npm run build:fast
```

No new standalone visible section should appear.

## Anti-patterns

Do not bring back modules as:

- full-width standalone panels
- educational diagrams
- generic news feeds
- data dumps
- redundant dashboards
- unscored lists
- visual ornaments

## Final test

A reintegrated module must be readable as:

> Because this evidence says X, Capital Radar permits Y and forbids Z until condition A changes.
