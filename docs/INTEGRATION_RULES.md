# Integration Rules

Capital Radar is an investment intelligence interface. Visuals must support decisions, not merely decorate data.

## 1. HTML prototypes stay in prototypes

Standalone HTML files belong in:

```txt
prototypes/html
```

Deprecated or superseded experiments belong in:

```txt
prototypes/archive
```

Standalone HTML files are visual prototypes only. They are not production routes and should not be pasted directly into app pages.

## 2. Production visuals live as reusable radar components

Capital Radar-specific production components belong in:

```txt
components/radar
```

Generic UI primitives belong in:

```txt
components/ui
```

Shared layout components belong in:

```txt
components/layout
```

## 3. Mock data first

Every new visual must render from mock data before live data is connected.

Mock data belongs in:

```txt
data/mock
```

The first reference mock is:

```txt
data/mock/pltr-signal.json
```

## 4. No direct HTML merging into production routes

A prototype can inform a production component, but the production implementation must be extracted into:

- a stable data shape
- a reusable component or renderer
- mock data
- optional scoring logic
- documentation

## 5. Live data comes later

Live data can be connected only after:

1. the component renders correctly from mock data,
2. the schema is documented,
3. the decision question is clear,
4. scoring or interpretation logic is separated from visual layout.

## 6. Every visual must answer a decision question

Examples:

| Visual | Decision question |
|---|---|
| TickerDecisionCard | What should I do with this ticker now? |
| PriceZoneMap | Which price levels change the action? |
| ProbabilityBiasPanel | Is upside probability attractive enough? |
| ValuationRiskGauge | Is valuation permitting or constraining entry? |
| CatalystTimeline | Is timing supportive or dangerous? |
| MarketRegimeMap | What risk posture does the market regime permit? |
| LiquidityConditionPanel | Does liquidity support risk-taking? |

If a visual does not answer a decision question, it should remain a prototype or be removed.

## 7. Build stability comes first

Do not rewrite the production build pipeline during visual experimentation unless the current build path is clearly blocking componentization.

Existing Node-rendered static output should remain stable until a deliberate framework migration is approved.

## 8. Documentation requirement

Any new radar component should be reflected in:

- `docs/COMPONENT_REGISTRY.md`
- `docs/DATA_SCHEMA.md` if it introduces or changes data shape
- `docs/ARCHITECTURE.md` if it changes repository structure
