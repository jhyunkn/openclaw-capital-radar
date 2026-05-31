# Macro Design Language v1

## Purpose

Macro is one integrated intelligence surface, not a set of disconnected widgets.

Every visible Macro component must support this chain:

```text
Diagnosis
-> Configuration
-> Relationships
-> Historical Memory
-> Portfolio Implication
-> Evidence Audit
```

The purpose of the visual system is to make this chain legible, traceable, and decision-oriented.

## Product rule

```text
No standalone Macro widgets.
```

A new Macro module is acceptable only if it strengthens one of the following:

```text
What is happening?
Why do we believe it?
What relationships explain it?
When has it happened before?
What should capital prepare for?
What evidence can be audited?
```

## Visual grammar

### Geometry

Use orthogonal geometry.

```text
No rounded cards.
No pill-heavy interfaces.
No decorative bubbles.
No unrelated component-specific containers.
```

Sharp rectangular containers should create a research-board / institutional-report feeling.

### Surfaces

Use a restrained paper / bone / ink palette.

Core surfaces:

```text
Bone background
Paper panels
Thin rule lines
Low-contrast evidence fields
Earth accent only for pressure / priority / signal emphasis
```

### Typography

Use hierarchy, not decoration.

```text
Large serif / editorial headline for diagnosis.
Small mono uppercase labels for fields and evidence.
Regular sans / readable body for explanation.
Numbers must be visually stronger than prose.
```

### Data fields

Prefer structured fields over paragraphs.

Wrong:

```text
The market appears to be restrictive but resilient because real yields are high while credit remains contained.
```

Better:

```text
Diagnosis: Restrictive money / resilient risk
Money: 82 restrictive
Credit: 41 contained
Tension: Real yield high while Nasdaq remains strong
Confidence: 73
```

### Density

Macro should be dense enough to feel institutional, but sparse enough to identify priority.

The main surface should answer within 15 seconds:

```text
Current diagnosis
Dominant tension
Closest analog
Capital implication
```

The evidence trail can carry higher density below.

## Required Macro sections

### 1. Market Diagnosis

Purpose:

```text
What is happening right now?
```

Required fields:

```text
Current diagnosis
Evidence confidence
Dominant narratives
Key tensions
Closest historical analogs
Capital implication preview
```

### 2. Configuration

Purpose:

```text
What is the state of the system?
```

Required axes:

```text
Money
Liquidity
Funding
Credit
Risk Appetite
Physical Constraint
```

Each axis should show:

```text
State label
Score / percentile
Direction
Evidence quality
```

### 3. Relationship Intelligence

Purpose:

```text
Which relationships explain the diagnosis?
```

Rules:

```text
Relationship overlays are selected to explain current diagnosis.
Default overlay should stay within 3–5 series.
6 series is a maximum exploration mode, not the default.
Use same timeline and normalized/percentile mode by default.
Show historical markers on the chart.
```

### 4. Historical Memory

Purpose:

```text
When has this configuration appeared before?
```

Required fields:

```text
Analog period
Similarity / confidence
Evidence quality: good / usable / partial
Main pattern
Outcome path
Missing evidence
```

### 5. Portfolio Implication

Purpose:

```text
How should capital prepare?
```

Required fields:

```text
Favor
Avoid
Watch
Invalidation
Position-size implication
```

This is not automatic buy/sell advice. It is allocation posture and risk preparation.

### 6. Evidence Audit

Purpose:

```text
Can the diagnosis be trusted?
```

Required fields:

```text
Raw data
Annotated evidence
Source quality
Data freshness
Missing data
Confidence caveats
```

## Integration rule

The visible Macro page should read as one analytical document:

```text
Top: compressed diagnosis
Middle: configuration + relationships + history
Bottom: portfolio implication + evidence audit
```

Do not let asset-class workbenches dominate the top of Macro. They are evidence library entries and should support the diagnosis.

## Design benchmarks

Use precedents for learning, not copying.

Useful precedent traits:

```text
OpenAI: calm hierarchy, confidence, restraint
Framer: spatial clarity and modern editorial rhythm
Bloomberg: density, institutional seriousness, fast scanning
MacroMicro: historical overlay and cross-asset comparison
Our World in Data: context plus chart readability
```

Discard:

```text
Dashboard clutter
Decorative chart walls
Overly rounded SaaS cards
Endless isolated indicators
User-forced interpretation without system prioritization
```

## Validation questions

Every Macro update should pass these tests:

```text
Can the market state be understood in 15 seconds?
Can the evidence trail be audited in 60 seconds?
Can historical comparison be found without hunting?
Can the capital implication be seen without reading every chart?
Do all components share one visual grammar?
```
