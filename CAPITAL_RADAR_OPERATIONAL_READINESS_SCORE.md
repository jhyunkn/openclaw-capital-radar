# Capital Radar Operational Readiness Score

Created: 2026-05-18
Owner: finance-leader
Purpose: Internal metric for tracking how close Capital Radar is to being operational, not merely analytical.

## Name

**CROS — Capital Radar Operational Score**

Scale: 0–100

Interpretation:

- **0–39: Prototype** — interesting parts exist, but not usable for live decision support.
- **40–59: Structured but fragile** — useful for review, not reliable for action moments.
- **60–74: Operational beta** — can guide decisions with human verification and clear caveats.
- **75–79: Operational candidate** — close, but not accepted as operational until the score is 80+.
- **80–89: Operational** — live tracking, permission logic, alerts, candidate engine, and visual decision support are mostly integrated.
- **90–100: High-trust operating system** — robust data freshness, evidence gates, alert discipline, historical learning, and decision audit loop.

## Weighted Criteria

### 1. Live Data Integrity — 20 pts
Measures whether data is current enough to support market-sensitive decisions.

Subcriteria:
- live quote source active;
- quote timestamps present;
- freshness status present;
- stale data blocks action;
- source health tracked;
- no report timestamp confused with quote timestamp.

### 2. Reaction Engine — 20 pts
Measures whether price becomes a permissioned action state.

Subcriteria:
- every holding has numeric levels;
- every holding has reaction state;
- every holding has action permission;
- invalidation/hard-exit logic exists;
- context confirmations exist for derivative/levered products;
- signal block can override price proximity.

### 3. Visual Decision Surface — 15 pts
Measures whether Jun can see the decision quickly.

Subcriteria:
- per-ticker chart shows reaction numbers;
- portfolio story chart exists;
- live reaction state appears visually;
- stale/freshness warnings visible;
- short text explains allowed/forbidden behavior.

### 4. Candidate Research Engine — 15 pts
Measures whether future stock suggestions are broad-research based.

Subcriteria:
- candidate universe exists;
- candidates split into short-term vs long-term lanes;
- source/evidence gates exist;
- candidate promotion rules exist;
- dashboard candidate funnel exists;
- candidate map is populated.

### 5. Portfolio Risk / Allocation Intelligence — 10 pts
Measures whether the system sees the portfolio as a risk organism.

Subcriteria:
- exposure buckets exist;
- concentration/hidden correlation visible;
- risk queue exists;
- allowed/forbidden behavior exists;
- risk budget caps visible.

### 6. Alert / Human Judgment Queue — 10 pts
Measures whether the system can interrupt only when useful.

Subcriteria:
- reaction-state changes are diffed;
- alert rules exist;
- stale data alerts exist;
- human-review items are queued;
- no-action/noise suppression exists.

### 7. Archive / Learning Loop — 10 pts
Measures whether Capital Radar improves over time.

Subcriteria:
- state snapshots archived;
- state deltas archived;
- decisions/outcomes tracked;
- rule improvements recorded;
- source reliability learned over time.

## Operational Rule

CROS is not a vanity score. Low sub-scores are work orders.

Every score output must include:
- current score;
- stage label;
- strongest categories;
- weakest categories;
- next five improvements;
- blockers that require paid data or user-provided data.

## Current Build Target

Near-term target: **80 / 100**

This is the threshold where Capital Radar becomes operational enough to support Jun's live investing workflow with human judgment, without pretending to be an autonomous broker.
