# Capital Radar V2 Benchmark / Implementation Spec

Status: implementation brief  
Project: `projects/financial-report`  
Purpose: evolve Capital Radar from a functional live report into Jun's private market headquarters: clear, precedent-driven, beautiful, and disciplined enough to support daily portfolio review without pretending to be an automatic broker.

## 1. Product standard

Capital Radar V2 must feel like a professional research desk and risk committee, not a generic finance dashboard.

The interface should answer in under 5 seconds:

1. What changed?
2. What matters now?
3. Which holdings are most affected?
4. What needs human review?
5. What evidence supports the read?

Primary user: Jun, reviewing markets around the 8:30 AM ET market-open window.  
Mode: decision support, not brokerage automation.  
Tone: calm, institutional, precise, visually memorable.

## 2. Research and precedent basis

This design must be based on the OpenClaw design research/doctrine, not ad hoc styling.

Required sources:

- `openclaw-state/universal-design-doctrine.md`
- `mission-control/research-archive/youtube-uiux-2026-05-07/DIGEST.md`
- `mission-control/research-archive/youtube-uiux-2026-05-13/DIGEST.md`
- `prompt-library/validation/design-quality-gate.md`

Operational translation:

- UXV-001: first impression must create authority, calm, and trust.
- UXV-002: create a memorable focal point and repeat visual motifs.
- UXV-004: design engineering must preserve the intended feeling in code.
- UXV-007: scannability and hierarchy are non-negotiable.
- UXV-009: typography is the primary UI system.
- UXV-010: no AI/generic dashboard slop; references and taste loops are required.
- UXV-011: responsive behavior must be designed as parent/child structure.
- UXV-012: any generated visual assets must become reusable/editable system artifacts.

## 3. Precedent-driven visual language

V2 should synthesize the logic of strong financial/intelligence precedents without copying any one product.

### Reference categories

1. Bloomberg / Koyfin / TradingView
   - Dense market data, fast scan, watchlists, cross-asset context.
   - Borrow: information priority, live tape discipline, compact metrics.
   - Avoid: terminal clutter and equal-weight noise.

2. FRED / Treasury / BIS / IMF / World Bank
   - Source trust, institutional metadata, release dates, evidence discipline.
   - Borrow: provenance, confidence, series labels, dates, methodology clarity.
   - Avoid: bureaucratic plainness.

3. JPMorgan Guide to the Markets / BlackRock / Vanguard outlooks
   - Chartbook framing, committee language, market-regime storytelling.
   - Borrow: structured macro narratives, clean chart hierarchy, risk framing.
   - Avoid: static PDF feel.

4. Visual Capitalist / Our World in Data
   - Explanatory visual synthesis.
   - Borrow: readable force maps, narrative graphics, visual metaphors that teach.
   - Avoid: infographic decoration that does not drive decisions.

### Visual language target

Use an `institutional intelligence room` direction:

- Dark graphite / ink background for market-room focus.
- Warm gold only for priority, active state, and institutional accent.
- Cool blue for data/evidence/source confidence.
- Green/red only for directional market/risk states.
- Fine-line grids, rings, rails, and network links as the repeated graphic vocabulary.
- Serif display type for editorial authority; restrained sans UI type for data and controls.
- Light texture/depth only when it improves layering and orientation.

## 4. Unified graphic system

V2 must use one coherent graphic system across all pages and modules. Do not mix unrelated icons, random gradients, unrelated charts, and one-off card treatments.

### Signature motif

The signature motif is the **Radar / Force Network**:

- A central portfolio core.
- Rings for market regime, risk, holdings, and opportunities.
- Lines/edges showing forces moving through holdings.
- Small nodes for evidence, alerts, and watch triggers.
- Intensity shown by line weight, opacity, and color rather than decorative glow.

This motif should appear as:

1. First-screen hero focal point.
2. Portfolio exposure map.
3. Force-to-holding impact matrix.
4. Holding detail pages.
5. Opportunity scout cards.
6. Loading/refresh state.

### Component rules

- Cards use the same structure: label → headline/metric → interpretation → evidence/source → action state.
- Every major card exposes source/confidence/date when available.
- Chart treatments use the same axes, line weight, label style, and color tokens.
- Action signals use one consistent chip system: HOLD, HOLD / WATCH, ADD WATCH, ADD CANDIDATE, TRIM WATCH, TRIM CANDIDATE, EXIT REVIEW, INVESTIGATE.
- Do not introduce new colors unless they map to semantic meaning.
- Do not introduce a new component shape unless it has a reusable role.

## 5. Information architecture for V2

### A. Command Center

First screen. Must be the clearest and most beautiful screen.

Required content:

- Market posture.
- Risk level.
- Most important macro signal.
- Most important holding update.
- Highest-risk position.
- Rebalance pressure.
- Action queue.
- Human-review flags.
- Last refresh and source confidence.

Design requirement:

- One dominant focal visual: radar/force network or priority board.
- One clear orientation sentence: what today means.
- No more than 5 primary items above the fold.
- Secondary detail must sit in drawers, rails, tabs, or lower sections.

### B. Portfolio Surface

Required content:

- Holding cards.
- Portfolio weights.
- Health score.
- Signal.
- Role/exposure bucket.
- Thesis/risk/watch trigger.
- 1D / 5D / 1M / 3M movement.

V2 additions:

- Holding health heatmap.
- Portfolio exposure network.
- Concentration/risk buckets.
- Weight vs confidence view.

### C. Market Map

Required content:

- Rates pressure.
- Risk appetite.
- AI infrastructure.
- Crypto liquidity beta.
- Credit conditions.
- Inflation expectations.
- Consumer pressure / dollar liquidity / geopolitical/regulatory risk as adapters mature.

V2 additions:

- Force-to-holding impact matrix.
- Direction + intensity + confidence for each force.
- Evidence drawer per force.

### D. Opportunity Scout

Required content:

- Candidate ticker/name.
- Theme.
- Signal.
- Thesis.
- Why now.
- Confirm-before-add checklist.
- Key risks.
- Data support.

V2 additions:

- Top 3 deep-dive queue.
- Rejected/archive list.
- Force-linked candidate sourcing: every opportunity must connect to at least one active force or strategic portfolio gap.

### E. Intelligence Feed / Evidence Library

Required content:

- Source registry.
- Filings/news/institutional reports.
- Materiality 0–5.
- Source/date/confidence.
- Claim type: fact, derived metric, inference, uncertainty, speculation.

V2 additions:

- Evidence drawer attached to every important card.
- Daily change log: what changed since the previous report.
- Source-health status.

### F. Risk Committee

Required content:

- Bear cases.
- Crowding/path dependency.
- Leverage/decay risk.
- Correlation risk.
- Human review requirements.

V2 additions:

- Scenario stress cards.
- Top hidden correlation view.
- Risk narrative: what would make today's posture wrong?

## 6. Layout family tree / responsive structure

Responsive design must be planned before code changes.

### Desktop / large display

- `shell`
  - `topbar`: brand, section nav, refresh/source status.
  - `command-center`: 2-column grid.
    - `priority-brief`: dominant text + action queue.
    - `radar-visual`: force/holding network focal point.
  - `metrics-strip`: 4–6 compact metrics.
  - `portfolio-market-grid`: 2-column or 3-column panels.
  - `holding-surface`: responsive card grid + optional heatmap.
  - `intelligence-risk-grid`: feed + risk committee.

### Tablet / mid-width

- Command center stacks text over radar visual.
- Metrics strip wraps to 2 columns.
- Holdings become 2-column cards.
- Tables become horizontally scrollable with frozen first column where practical.

### Phone

- Purpose changes from cockpit to review queue.
- Show: posture, top risk, top holding update, action queue, human-review flags.
- Collapse force map, holdings, and sources into accordions.
- Avoid tiny dense charts; use sparklines only where legible.
- Keep tap targets 44px+.

## 7. Typography system

Typography must do most of the hierarchy work.

Recommended tokens:

- Display: Georgia or a refined editorial serif fallback; used only for hero/title/high-emphasis metrics.
- UI: Inter/system sans for all controls, tables, labels, and dense data.
- Base: 16px body / 1.55–1.65 line-height.
- Small label: 11–12px uppercase, high tracking, muted or gold.
- Body/meta: 13–15px, muted tiers.
- Metric values: 24–44px depending on priority.

Rules:

- Do not add many new font sizes. Use weight, lightness, spacing, and grouping first.
- Use muted text intentionally; do not make every paragraph the same color.
- Preserve readable line lengths on wide screens.
- Use tabular numerals for prices/percentages if available.

## 8. Color and semantic tokens

Use semantic tokens instead of ad hoc colors.

Suggested token groups:

- Background: `bg-base`, `bg-elevated`, `bg-panel`, `bg-panel-strong`.
- Text: `text-primary`, `text-secondary`, `text-muted`, `text-inverse`.
- Rule: `rule-subtle`, `rule-strong`, `rule-accent`.
- Accent: `accent-gold`, `accent-blue`.
- Status: `status-positive`, `status-negative`, `status-watch`, `status-neutral`.
- Confidence: `confidence-high`, `confidence-medium`, `confidence-low`.

Color quality bar:

- Gold is not decoration; it marks priority, active state, or institutional emphasis.
- Red/green are never used for brand mood; only directional/risk state.
- Blue marks data/source/evidence, not arbitrary UI flair.
- Contrast must remain readable in all panels.

## 9. Interaction and micro-interactions

Interactions should clarify state and evidence.

Required V2 interactions:

- Hover/focus state for every clickable card/link.
- Evidence drawers for holdings, forces, and opportunities.
- Expand/collapse long rationale sections.
- Source/confidence tooltip or detail line.
- Loading state that uses the radar motif and states what is being refreshed.
- Empty/error states that explain which adapter/source failed.

Motion rules:

- Use fast, subtle transitions: 120–220ms.
- Animate reveal/selection/refresh, not random floating objects.
- Respect `prefers-reduced-motion`.
- No motion should delay reading or market-open use.

## 10. Clarity + beauty quality bar

V2 is not done unless it is both clear/function-first and beautiful.

### Clarity bar

Pass if:

- A user can understand the day's posture in 5 seconds.
- Each section has one primary job.
- Every major claim has source/date/confidence or is clearly labeled as inference.
- Action signals are visible, consistent, and non-brokerage.
- Dense information is grouped by decision use, not by data availability.
- The small-screen experience is usable as a review queue.

Fail if:

- The first screen contains too many equal-weight panels.
- Charts exist without decision meaning.
- Headlines are vague or generic.
- Evidence is hidden or missing for important claims.
- Mobile is just a shrunken desktop cockpit.

### Beauty bar

Pass if:

- The first screen feels calm, authoritative, and memorable.
- The radar/force-network graphic language is repeated across modules.
- Typography, spacing, contrast, and card rhythm feel intentional.
- The interface looks like one designed system, not assembled widgets.
- Color has semantic discipline.
- There is enough whitespace for priority to breathe.

Fail if:

- It resembles a generic template dashboard.
- Components use unrelated styles.
- Decoration competes with the decision surface.
- Every card has the same visual weight.
- The design has no recognizable focal idea.

## 11. Implementation sequence

### Phase 1 — Design system foundation

1. Convert CSS to readable sections: tokens, base, layout, components, utilities, responsive.
2. Add semantic CSS variables for color, type, spacing, radius, shadow, transitions.
3. Normalize card structures and action chips.
4. Add focus/hover states and `prefers-reduced-motion` support.

Acceptance gate:

- Current UI still renders.
- No component uses unexplained one-off colors/styles.
- Build passes.

### Phase 2 — Command Center V2

1. Rebuild top hero as a command center, not a marketing hero.
2. Add radar/force-network focal visual using SVG/CSS from live state.
3. Limit above-fold priority to 5 items.
4. Add action queue + human-review rail.
5. Surface source confidence and last refresh.

Acceptance gate:

- 5-second scan answers: posture, risk, macro signal, holding update, review item.
- First impression passes `calm + institutional + beautiful` test.

### Phase 3 — Portfolio / market graphics

1. Add force-to-holding impact matrix.
2. Add holding health heatmap.
3. Convert exposure map into the same radar/network visual language.
4. Add evidence drawers.

Acceptance gate:

- All graphics use the same line/node/card system.
- Every graphic has a clear decision use.

### Phase 4 — Intelligence and risk depth

1. Add intelligence feed with materiality and claim type.
2. Add evidence library drawer/panel.
3. Add risk committee scenario cards.
4. Add source-health status.

Acceptance gate:

- Major claims can be traced to source/confidence/date.
- Risk section includes adversarial thinking, not only warnings.

### Phase 5 — Responsive and fidelity QA

1. Test 390px, 768px, 1280px, and 1600px+.
2. Screenshot and compare hierarchy at each size.
3. Validate keyboard focus and reduced motion.
4. Run `npm run build`.
5. Apply `prompt-library/validation/design-quality-gate.md`.

Acceptance gate:

- Label as `passed_design_gate` only if clarity, beauty, responsiveness, and implementation fidelity all pass.

## 12. V2 data model additions

Add or normalize these fields over time:

```json
{
  "dailyChangeLog": [
    {
      "title": "string",
      "materiality": 0,
      "claimType": "fact | derived_metric | inference | uncertainty | speculation",
      "source": "string",
      "sourceUrl": "string",
      "publishedAt": "ISO date",
      "confidence": "High | Medium | Low",
      "affectedTickers": ["MSFT"],
      "affectedForces": ["Rates pressure"]
    }
  ],
  "forceImpactMatrix": [
    {
      "force": "Rates pressure",
      "ticker": "MSFT",
      "impact": -2,
      "confidence": "Medium",
      "evidenceIds": ["fred-dgs10-latest"]
    }
  ],
  "evidenceLibrary": [
    {
      "id": "string",
      "sourceName": "FRED",
      "sourceUrl": "string",
      "publishedAt": "ISO date",
      "capturedAt": "ISO date",
      "excerpt": "string",
      "claimType": "fact",
      "confidence": "High"
    }
  ]
}
```

## 13. Definition of done

A V2 implementation is complete only when:

- It is grounded in the research and precedent categories above.
- The visual graphics are unified around the radar/force-network system.
- The interface is clear first, beautiful through discipline, and not generic.
- Every major module supports an actual market/portfolio decision.
- The responsive behavior is intentionally designed.
- The build passes.
- A screenshot/design review passes the OpenClaw design quality gate.

If any of those fail, label the work `needs_design_validation`, not final.
