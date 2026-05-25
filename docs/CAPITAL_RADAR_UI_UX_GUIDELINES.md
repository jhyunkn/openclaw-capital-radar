# Capital Radar UI / UX Guidelines

Capital Radar is a research-to-decision operating system for investing. Its interface must make market reasoning more legible, not merely display more information.

The visual reference is the OpenAI public website: restrained, clear, spacious, precise, and confident without becoming visually loud. Capital Radar should adapt that level of clarity to investment intelligence.

---

## 1. Product Interface Principle

The interface must follow the product chain:

```text
Data -> Evidence -> Interpretation -> Permission -> Action -> Invalidation
```

Every visible module should help the user understand at least one part of that chain.

A module is valid only if it clarifies one of the following:

- what evidence exists
- what evidence is missing
- what the system interprets from the evidence
- what action is permitted
- what action is blocked
- what would invalidate the conclusion
- what OpenClaw needs to research or validate next

If a visual element does not improve reasoning, trust, or actionability, it should not be added.

---

## 2. OpenAI-Inspired Visual Standard

Capital Radar should not copy OpenAI's website literally. It should borrow the underlying discipline:

- strong hierarchy
- calm composition
- generous spacing
- controlled typography
- restrained color
- low visual noise
- precise language
- one dominant idea per section
- graphics that explain, not decorate
- confidence through clarity rather than density

The goal is not a Bloomberg terminal. The goal is an institutional operating note that feels readable, intelligent, and inspectable.

---

## 3. Homepage UX Vision

The homepage should read as a daily investment operating note.

Target sequence:

```text
1. Macro Reading
   Integrated regime, liquidity, confirmation, contradiction, and permission.

2. Market Execution Map
   Decision Map with add / hold / trim / defense zones and evidence support.

3. Portfolio / Price Zone Radar
   Current holdings translated into action zones, sizing permission, and risk review.

4. Opportunity Research
   New ideas organized by evidence status, thesis, blockers, and upgrade/reject gates.

5. Evidence / Trust Access
   Quiet audit layer for data freshness, source quality, and missing evidence.
```

The user should never have to synthesize scattered authority sources manually. The page should integrate them into a coherent reading path.

---

## 4. Section Responsibilities

### Macro Reading

Purpose:

```text
What environment are we in?
```

Should integrate:

- Egg diagram
- former Command Center logic
- confirmation signals
- market tape
- liquidity / rates / credit
- cross-asset signals

UX requirement:

Macro Reading should feel like the top-level thesis of the day. It should not be a pile of separate signal boards.

### Market Execution Map

Purpose:

```text
What does the market permit?
```

Keep the current Decision Map. Refine it with evidence support.

UX requirement:

The map should make add / hold / trim / defend logic visually obvious. The user should know which scenario is active and what invalidates it.

### Portfolio / Price Zone Radar

Purpose:

```text
What do my holdings require?
```

Keep the current Price Zone Radar. Enrich it with fundamentals, valuation, catalysts, and position-sizing logic.

UX requirement:

It should connect directly to portfolio action. Avoid generic ticker cards that do not affect sizing or permission.

### Opportunity Research

Purpose:

```text
What deserves new capital or deeper research?
```

This section needs the most development.

UX requirement:

Opportunity must not be a vague ranking board. Each candidate should expose thesis, supporting evidence, missing evidence, blockers, upgrade trigger, reject trigger, and next research task.

### Evidence / Trust Layer

Purpose:

```text
Why should I trust this?
```

UX requirement:

This should usually be quiet and secondary, but always accessible. Trust should be embedded inside claims, not isolated into a decorative badge wall.

---

## 5. Visual Language Rules

### Layout

- Prefer wide, calm sections over many competing panels.
- Use generous spacing and clear grouping.
- Keep each section focused on one decision function.
- Avoid fragmenting related signals across separate sections.
- Use progressive disclosure for dense evidence.

### Typography

- Headings should be precise and plain.
- Avoid dramatic or promotional language.
- Use small uppercase labels for metadata and evidence categories.
- Use larger serif or editorial-style text only for high-level interpretation when it improves readability.
- Tables and metrics should remain compact and legible.

### Color

- Color should indicate meaning, not decoration.
- Use restrained color for permission, warning, risk, and missing data.
- Avoid saturated financial-dashboard color schemes.
- Do not introduce a foreign dark-mode panel unless the whole system is intentionally redesigned.

### Motion / Interaction

- Interaction should reveal evidence, not create novelty.
- Prefer simple expansion, drill-down, and source links.
- Avoid animation that distracts from decision logic.

### Density

Capital Radar can contain deep information, but the first view should remain readable.

Use this hierarchy:

```text
Top layer: conclusion and permission
Second layer: evidence for / against
Third layer: source detail and raw artifact
```

---

## 6. Language / Copy Rules

Preferred language:

- allowed if
- blocked because
- wait until
- add only inside
- trim if
- invalidated by
- evidence supports
- evidence weakens
- source-limited
- upgrade trigger
- reject trigger

Avoid:

- unsupported confidence
- generic market commentary
- sensational finance language
- vague labels like "opportunity" without evidence
- buy/sell language without trigger, sizing, and invalidation

---

## 7. Component Acceptance Test

Before adding or changing a visual component, answer:

```text
1. Which product layer does this serve?
2. What decision question does it answer?
3. What evidence does it expose?
4. What action or permission does it affect?
5. What does it replace, integrate, or clarify?
6. Does it preserve the OpenAI-style clarity reference?
7. Does it reduce or increase cognitive load?
```

If the answer is unclear, the component should not ship.

---

## 8. Current Direction

The immediate UI/UX direction is:

1. Integrate Egg, Command Center, Confirmation Board, Cross-Asset Lens, and Market Tape into a coherent Macro Reading.
2. Preserve and refine the Decision Map.
3. Preserve and enrich Price Zone Radar.
4. Rebuild Opportunity as evidence-backed research cards and dossiers.
5. Keep Evidence / Trust available but quiet.
6. Use the current visual identity as the base and evolve it with restraint.

---

## 9. Non-Negotiable Rule

Do not separate infrastructure from visual display.

For Capital Radar, visual organization is part of the intelligence system. Evidence that cannot be read, inspected, or connected to action is not yet useful.

But every new visual display must earn its place by making the reasoning chain clearer.
