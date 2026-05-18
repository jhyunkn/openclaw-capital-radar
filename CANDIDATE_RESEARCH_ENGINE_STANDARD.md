# Capital Radar Candidate Research Engine Standard

Created: 2026-05-18
Owner: finance-leader
Purpose: Ensure suggested future stocks are grounded in broad market research and separated into short-term and long-term opportunity lanes.

## Success Metric

The goal is not to generate many ticker ideas. The goal is to improve profit-seeking decision quality by finding asymmetric setups while minimizing avoidable risk.

Suggested stocks must therefore pass through research gates before they become actionable.

## Two-Lane Candidate System

### Lane 1 — Short-Term / Tactical Setups

Purpose: Capture mispriced movement or dislocation without confusing it for long-term conviction.

Typical time horizon:
- intraday to several days for levered/tactical products;
- days to weeks for pullback/reversal setups.

Candidate sources:
- live price/volume dislocation;
- unusually strong/weak relative strength;
- sector rotation;
- volatility spike/panic discount;
- event/catalyst reaction;
- community/source hypothesis that survives validation.

Required before promotion to ADD WATCH:
- live quote freshness;
- support/reclaim level;
- invalidation / hard stop;
- underlying confirmation where relevant;
- liquidity/volume sanity;
- risk budget and time stop;
- clear reason this is not just catching a falling knife.

Default labels:
- INVESTIGATE;
- ADD WATCH;
- TACTICAL WATCH;
- TRIM WATCH;
- EXIT REVIEW.

Forbidden:
- calling a lower price a buy if it is below invalidation;
- averaging down without a reclaim/confirmation rule;
- using long-term thesis language for a decay/levered product.

### Lane 2 — Long-Term / Structural Compounders

Purpose: Build durable portfolio candidates that can improve long-term risk-adjusted compounding.

Typical time horizon:
- quarters to years.

Candidate sources:
- secular growth themes;
- quality businesses after valuation reset;
- free-cash-flow durability;
- moat/network effects;
- balance sheet strength;
- sector leadership;
- macro tailwind;
- under-owned/underappreciated expectation gap.

Required before promotion to ADD WATCH:
- business thesis;
- valuation/fair-value band or expectation gap;
- earnings/revision direction if available;
- peer/sector comparison;
- risk factors and bear case;
- portfolio role and overlap check;
- add zone, invalidation, review catalyst.

Default labels:
- INVESTIGATE;
- ADD WATCH;
- ADD CANDIDATE only after thesis + price zone + risk budget are explicit.

Forbidden:
- buying a great company at any price;
- upgrading a candidate from narrative alone;
- ignoring concentration/overlap with existing mega-cap/AI exposure.

## Broad Market Research Requirement

Every candidate must be supported by at least three layers when possible:

1. Market structure layer
- broad index regime;
- VIX/rates/credit/liquidity;
- sector/theme trend;
- relative strength vs SPY/QQQ/sector.

2. Asset-specific layer
- price path;
- support/resistance/reclaim;
- volume and volatility;
- fundamentals or issuer mechanics;
- catalyst path.

3. Source/evidence layer
- SEC/company filings where relevant;
- earnings/IR/news;
- public expert/community hypotheses;
- counterclaims;
- source incentives/bias.

A candidate may remain in INVESTIGATE with fewer layers, but it cannot become ADD CANDIDATE without sufficient evidence.

## Current Public-Source Reality

Active autonomous inputs:
- Yahoo public 1-minute chart data for live quote/tape where available;
- Yahoo daily chart data for recent trend;
- FRED for rates/credit/macro pressure;
- SEC submissions metadata;
- internal holdings/risk/strategy rules.

Still incomplete:
- broad live news and community-source ingestion;
- forward estimates and analyst revisions;
- options IV/Greeks;
- reliable institutional ownership/flow;
- fully automated YouTube/Reddit/forum claim extraction.

Until these are connected, candidate suggestions are allowed as INVESTIGATE / ADD WATCH, but ADD CANDIDATE should remain rare and evidence-heavy.

## Candidate Output Format

Each candidate should eventually show:

- ticker;
- lane: tactical / long-term / both;
- source of idea;
- thesis;
- market regime fit;
- price zone;
- invalidation;
- confirmation triggers;
- risk budget;
- expected holding period;
- bull case;
- bear/counter case;
- missing evidence;
- current permission: blocked / investigate / add watch / add candidate / rejected.

## Current Operating Assessment

Capital Radar is partially on track:

- Structure exists for opportunity scout, research candidate map, thesis coverage, IC memos, and live reaction state.
- Named source registry exists for public expert/community hypotheses.
- Live data and reaction state now exist for current holdings.

But the candidate engine is not yet fully mature:

- Current `outputs/research-candidate-map.json` is empty.
- Opportunity scout exists in the live report, but broad external research ingestion is not yet automated.
- Short-term vs long-term candidate lanes need to be made explicit in the dashboard.

Next required build:

1. Seed candidate universe by lane.
2. Generate separate `tickerOfMoment` and `longTermMacroFit` maps.
3. Require evidence gates before candidate promotion.
4. Wire candidate map to dashboard with visual funnel.
