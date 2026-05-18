# Capital Radar Holistic Operational Model

Created: 2026-05-18
Owner: finance-leader
Purpose: Move Capital Radar from dashboard/report pieces into a coherent operational system for risk-minimized profit seeking.

## Success Definition

Capital Radar succeeds if it helps Jun make better capital decisions by:

- minimizing avoidable downside;
- improving entries and exits;
- separating low price from good entry;
- identifying asymmetric opportunities early;
- reducing emotional/reactive decisions;
- tracking current holdings and future candidates continuously;
- making the decision visually understandable, not text-heavy.

Success is not “institutional-sounding analysis.” It is operational decision quality.

## System Philosophy

Capital Radar must operate as one loop:

Data → State → Strategy → Permission → Visualization → Alert → Archive → Learning

No layer is sufficient alone.

- Data without strategy creates noise.
- Strategy without live data becomes stale.
- Visualization without reaction numbers is decorative.
- Candidate ideas without evidence gates become hype.
- Alerts without permission logic become emotional triggers.
- Reports without archived deltas do not improve judgment.

## Core Operating Layers

### 1. Live Data Layer

Purpose: know what is happening now.

Current active sources:
- Yahoo public 1-minute chart data for live-ish quotes;
- Yahoo daily chart data for recent trend context;
- FRED rates/credit/macro data;
- SEC company submissions metadata.

Required behavior:
- every price must have timestamp;
- every quote must have freshness status;
- stale data blocks tactical action;
- live quote source must be visible on dashboard;
- no report-generation timestamp may be confused with quote freshness.

Next build:
- dashboard live-refresh wiring via `/api/live-quote`;
- market-hours freshness gate;
- visible stale/action-block warnings.

### 2. Holding Reaction Engine

Purpose: turn live price into permissioned strategy state.

Current artifact:
- `outputs/live-reaction-state.json`

Each holding must track:
- current price;
- timestamp/freshness;
- strategy levels;
- entry/reclaim zone;
- trim/protect zone;
- stop/review;
- hard-exit review;
- signal;
- action permission;
- confirmation requirements;
- risk budget;
- context ticker where needed, e.g. CONL ↔ COIN/BTC, TSLT ↔ TSLA.

Required behavior:
- price inside a zone is not permission by itself;
- signal block overrides price proximity;
- below invalidation is not automatically bargain territory;
- every “commit” state must name the condition that makes it valid.

### 3. Candidate Research Engine

Purpose: make future stock suggestions based on broad market research.

Two lanes:

#### Short-Term / Tactical
For dislocation, volatility gifts, event moves, relative strength, panic/reclaim setups.

Requires:
- live quote;
- support/reclaim;
- invalidation;
- time stop;
- liquidity/volume;
- underlying confirmation;
- risk budget.

#### Long-Term / Structural
For durable compounders, quality businesses, macro/sector tailwinds, valuation resets.

Requires:
- business thesis;
- valuation/expectation gap;
- secular/sector fit;
- peer comparison;
- bear case;
- add zone;
- portfolio role and overlap check.

Current gap:
- candidate map exists but is empty;
- candidates exist in Opportunity Scout but are not yet fully researched through lane gates.

Next build:
- seed candidate universe;
- split `tickerOfMoment` vs `longTermMacroFit`;
- visual candidate funnel;
- source/evidence gates.

### 4. Market Regime / Fractal Layer

Purpose: understand whether the market context supports adding, holding, reducing, or waiting.

Must track:
- SPY/QQQ/IWM trend;
- VIX;
- rates/curve;
- credit spreads;
- dollar/BTC liquidity proxy;
- sector/theme behavior;
- daily/weekly/quarterly/structural layer alignment.

Required output:
- regime now;
- dominant force;
- layer agreement/conflict;
- what is cheap/fair/expensive/impaired/unknowable;
- what behavior is allowed or forbidden.

### 5. Portfolio Story / Risk Organism

Purpose: show the portfolio as a whole, not a list of tickers.

Current artifact:
- `portfolioStory` in live state.

Must show:
- protected core;
- tactical risk;
- unknown thesis;
- other exposure;
- concentration;
- hidden correlation;
- risk queue;
- opportunity queue;
- allowed behavior;
- forbidden behavior.

Next build:
- state-change deltas since last run;
- profit/risk scoreboard once cost basis exists;
- thesis verification progress embedded in unknown bucket.

### 6. Visual Decision Surface

Purpose: let Jun understand visually before reading.

Required visuals:
- per-ticker decision chart with numeric reaction levels;
- portfolio story chart;
- live reaction table;
- candidate funnel;
- regime dashboard;
- source/evidence confidence badges;
- freshness/staleness warnings.

Rule:
Every visual must answer: what is happening, what does it mean, what is allowed, what is forbidden, what changes the decision?

### 7. Alert / Escalation Engine

Purpose: respond only when something actionable changes.

Alert types:
- stale data block;
- stop/review breach;
- hard-exit review breach;
- entry/reclaim zone reached;
- trim/protect zone reached;
- thesis damage;
- thesis confirmation;
- macro regime shift;
- candidate promoted/demoted.

No spam rule:
Alert only when the reaction state changes or the system needs human judgment.

### 8. Archive / Learning Layer

Purpose: improve judgment over time.

Every meaningful run should archive:
- state before;
- state after;
- trigger;
- decision implication;
- whether action was allowed;
- what evidence was missing;
- what rule needs improvement.

This is how Capital Radar becomes smarter instead of just noisier.

## Operational Maturity Stages

### Stage 1 — Coherent Public-Data Radar

Goal: make free/public data operational enough.

Must complete:
- live quote freshness gate;
- live reaction state visible on dashboard;
- per-ticker charts with reaction numbers;
- portfolio story chart;
- candidate lanes scaffold;
- archive all state changes.

### Stage 2 — Research Candidate Engine

Goal: future suggestions are research-backed.

Must complete:
- seed broad candidate universe;
- short-term vs long-term lane split;
- source/evidence claim ledger;
- public/news/community hypothesis ingestion where available;
- candidate promotion rules.

### Stage 3 — Alerting and Decision Queue

Goal: Capital Radar can interrupt only when useful.

Must complete:
- live reaction state diffing;
- alert thresholds;
- human judgment queue;
- dashboard update loop;
- no-action/noise suppression.

### Stage 4 — Paid-Data Decision Point

Only after public stack is exhausted, decide if paid sources are needed.

Likely paid-source triggers:
- forward estimates block valuation work;
- options IV/Greeks block levered/product risk analysis;
- news latency blocks event reaction;
- public quote reliability is insufficient for tactical action.

## Immediate Build Sequence

1. Freshness gate + stale-action blocking.
2. Dashboard live reaction panel from `live-reaction-state.json`.
3. Candidate engine lane split: `tickerOfMoment` and `longTermMacroFit`.
4. Candidate visual funnel.
5. State-change delta archive.
6. Alert rules for reaction-state changes.

## Current Honest Assessment

Capital Radar is no longer just a report prototype. It now has meaningful components:

- live quote adapter;
- reaction state engine;
- numeric strategy levels;
- per-ticker analysis chart model;
- portfolio story chart;
- source registry;
- thesis/IC scaffolding.

But it is not yet holistically operational until those pieces are wired into a single loop with freshness gates, visible live reaction state, candidate lanes, and state-change alerts.
