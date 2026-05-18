# Capital Radar Native Research Engine

Status: Proposed build track  
Created: 2026-05-18 15:38 America/New_York  
Mode: Local/degraded design — no web_search used

## Premise

Capital Radar should remain relevant even without paid whole-web search APIs. It should not try to clone Brave, Google, or Perplexity at whole-internet scale. Instead, it should build a focused market-intelligence repository that can produce:

- odd/asymmetric opportunities;
- real-time event awareness from selected sources;
- portfolio-specific implications;
- evidence-backed candidate packets;
- a memory of which sources and signals worked.

The goal is not maximum web coverage. The goal is **actionable market cognition**.

## Strategic Position

Paid search APIs are useful for broad freshness, but Capital Radar should not depend on them as the foundation. Search APIs become optional accelerators. The native engine becomes the durable asset.

Capital Radar should build something narrower but more intelligent:

> A domain-specific research and event engine tuned to Jun's portfolio, risk posture, opportunity taste, and decision rules.

## What Brave / Perplexity Provide

They provide:

1. broad discovery across the open web;
2. fresh event lookup;
3. snippets and links;
4. summarization or answer synthesis;
5. crawling/ranking infrastructure;
6. source breadth outside known domains.

## What Capital Radar Can Build Instead

Capital Radar can build:

1. a curated source graph;
2. local evidence archive;
3. ticker/theme/event tagging;
4. anomaly detection from market data;
5. filings and fundamentals ingestion;
6. candidate generation from dislocations;
7. watchlist expansion from source relationships;
8. portfolio-specific implication engine;
9. decision-outcome learning loop.

This will not be as vast as Brave or as immediate as Perplexity, but it can become more useful for our specific purpose.

## Core Design Principle

Do not search the whole internet. Search the right evidence.

Capital Radar should prioritize:

- primary sources over commentary;
- structured data over narrative noise;
- repeatable signals over vibes;
- weird but explainable opportunities over generic watchlists;
- portfolio implications over isolated facts.

## Native Engine Layers

### 1. Source Registry

A controlled list of sources by type:

- SEC filings and companyfacts;
- company investor-relations pages;
- earnings calendars and transcripts where accessible;
- FRED, Treasury, BLS, BEA;
- Yahoo/public chart data;
- ETF holdings pages;
- exchange/Nasdaq/NYSE pages;
- selected RSS feeds;
- specialist industry sources;
- public GitHub/project pages for technology companies;
- internal Capital Radar reports and archives.

Each source gets:

- source id;
- domain;
- source type;
- reliability tier;
- fetch method;
- refresh cadence;
- failure mode;
- whether raw text is stored or only summary/metadata.

### 2. Event Collector

A scheduled collector checks source changes:

- new SEC filings;
- changed IR/news pages;
- earnings date changes;
- large price/volume moves;
- rate/credit/VIX regime changes;
- sector ETF divergence;
- unusual relative strength/weakness;
- watchlist expansion triggers.

Events are normalized into a shared schema:

```json
{
  "eventId": "string",
  "detectedAt": "ISO timestamp",
  "sourceId": "string",
  "ticker": "string|null",
  "theme": "string|null",
  "eventType": "filing|price_move|volume_anomaly|macro_shift|source_update|earnings|sector_rotation|watchlist_discovery",
  "severity": "low|medium|high",
  "freshness": "live|recent|stale|unknown",
  "summary": "string",
  "evidenceRefs": ["string"],
  "portfolioImplication": "string|null",
  "actionPermission": "none|watch|review|research|prepare|human_review_required"
}
```

### 3. Local Research Index

Store searchable extracted content, not full web junk by default.

For each document:

- URL / local source path;
- timestamp;
- extracted clean text;
- summary;
- ticker/theme tags;
- claims;
- source reliability score;
- freshness score;
- embeddings/vector index later if useful.

Retention policy:

- keep primary-source raw text;
- summarize and discard low-value raw HTML;
- compress/archive old snapshots;
- deduplicate aggressively.

### 4. Anomaly-to-Question Engine

Instead of waiting for news search, Capital Radar can generate research questions from anomalies:

- Why is ticker down/up > X%?
- Is weakness isolated or sector-wide?
- Is the move confirmed by volume?
- Is it correlated with rates, VIX, credit, BTC, or sector ETF?
- Did a filing/source update appear recently?
- Is this a thesis break, valuation reset, or opportunity zone?

This creates useful real-time intelligence even before external news is available.

### 5. Odd Opportunity Generator

Generate ideas from structured dislocations:

- high relative strength during bad tape;
- quality names down with no local thesis damage;
- sector ETF weakness but one component holds strong;
- rate-sensitive growth compressing into prepared zones;
- supply-constrained themes with broad selloff;
- small/mid-cap names linked to major structural themes;
- substitutes for current risky exposure;
- companies connected by supplier/customer/theme graph;
- filings showing insider ownership, buybacks, backlog, contracts, or business transition.

Candidate lanes:

- Tactical dislocation;
- Structural compounder;
- Speculative optionality;
- Risk-substitution candidate;
- Hedge/protection candidate;
- Theme-basket candidate;
- Contrarian repair candidate.

### 6. Evidence Packet Builder

Every candidate must receive:

- why interesting;
- why now;
- what changed;
- what confirms;
- what invalidates;
- price zone / trigger;
- risk budget;
- expected holding period;
- source evidence;
- source reliability;
- portfolio role;
- correlation/concentration impact.

### 7. Source Reliability + Outcome Ledger

Capital Radar should learn which sources/signals are useful.

Track:

- source used;
- claim made;
- decision implication;
- later outcome;
- false positives;
- missed events;
- stale/broken source behavior;
- whether source improved profit/risk decisions.

Over time, this makes the internal engine better than generic search for Jun's specific work.

## Real-Time Without Whole-Web Search

Capital Radar can still be real-time-ish by combining:

- live price/volume adapters;
- FRED/rate/credit refresh;
- scheduled SEC/company source checks;
- RSS/feed polling;
- source diffing;
- anomaly detection;
- watchlist-specific event monitors;
- manual link/ticker intake.

This will not explain every breaking headline instantly, but it will detect that something happened and produce the right next research question.

## Creative Tactics

### Source Graph Expansion

When a candidate enters the system, collect related entities:

- competitors;
- suppliers;
- customers;
- ETFs holding it;
- themes;
- executives/founders;
- major filings;
- adjacent tickers.

This helps generate odd opportunities without open-ended web search.

### Reverse Theme Search

Start from a structural constraint, not a ticker:

- electricity scarcity;
- cooling bottlenecks;
- grid interconnect delays;
- defense autonomy;
- human data scarcity;
- GLP-1 supply chain;
- transplant logistics;
- uranium contracting;
- insurance/litigation risk;
- water infrastructure.

Then map public companies and evidence sources.

### Bad-Day Scanner

During broad weakness:

- rank worst decliners;
- rank relative strength;
- classify selloff type;
- find candidates near prepared levels;
- identify names where thesis improves but price worsens;
- block emotional adds where invalidation is breached.

### Manual Intelligence Intake

Allow Jun/ChatGPT/Discord to drop:

- links;
- tickers;
- screenshots;
- thesis notes;
- rumors/questions.

Capital Radar converts them into structured evidence packets rather than loose notes.

## Storage Implication

No major storage upgrade needed initially.

Estimated footprint:

- Phase 1 structured events/index: under 1 GB;
- Phase 2 filings + curated sources + summaries: 5–20 GB;
- Phase 3 multi-year evidence archive with embeddings: 50–100 GB;
- whole-web crawling: not recommended.

## Build Phases

### Phase 1 — Native Event Spine

- Source registry JSON;
- Event schema;
- event collector output;
- market anomaly detector;
- dashboard event panel.

### Phase 2 — Research Repository

- document/evidence store;
- source reliability ledger;
- candidate evidence packet builder;
- local search over stored evidence.

### Phase 3 — Creative Opportunity Engine

- reverse-theme search;
- supplier/customer/ETF adjacency graph;
- dislocation scanner;
- odd-opportunity generator;
- portfolio-fit classifier.

### Phase 4 — Optional External Search Layer

- Brave/Perplexity/Tavily/SearXNG only as external context;
- never required for core action permission;
- search outputs go through same evidence gates.

## Decision

Build the native research engine. Treat paid web search as optional acceleration, not dependency.

Capital Radar's edge should come from:

- disciplined source memory;
- portfolio-specific implication mapping;
- creative dislocation detection;
- explicit action permissions;
- learning from outcomes.
