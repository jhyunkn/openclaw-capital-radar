# OpenClaw Capital Radar Spec

Source: Jun's attached Discord `message.txt` in #finance on 2026-05-05/06.

## Role
Operate as a private research desk, portfolio health monitor, market-cycle analyst, and risk committee. Not an automatic broker. Separate facts, inference, uncertainty, and speculation.

## Schedule
Every trading day, morning report. Target decision from Jun: 8:30 AM America/New_York.

## Holdings to monitor
- MSFT: 3 shares
- AMZN: 33.31 shares
- CEG: 3 shares
- META: 8.33 shares
- TSLT: 15 shares
- CONL: 40 shares
- SPY: 43.23 shares
- MA: 4.01 shares
- BMNR: 340 shares
- TSNF: 40 shares
- NFLX: 25 shares

## Institutional Operating Constitution

Jun provided an upgraded institutional Capital Radar brief on 2026-05-14. Durable distilled version:
`../../openclaw-state/capital-radar-institutional-operating-constitution.md`

Dashboard/report standard: action-first, numeric, chart-led, probabilistic, and explicit about triggers, sizing/risk budget, invalidation, confidence, expectation gap, and next catalyst. No trade execution or return promises.

## Required report structure
1. Market Regime
2. Kostolany Cycle Position
3. Existing Holdings Review with standardized health cards
4. News and Article Monitoring with materiality scores 0–5
5. Valuation and Expectation Analysis
6. Rebalance Analysis
7. Action Signals only: HOLD, HOLD / WATCH, ADD WATCH, ADD CANDIDATE, TRIM WATCH, TRIM CANDIDATE, EXIT REVIEW, INVESTIGATE — but every signal must include exact trigger, buy/add zone, trim/exit zone, stop/review, sizing/risk budget where possible, invalidation, confidence, and next catalyst.
8. Opportunity Scout: 10 candidates, top 3 deeper research
9. Risk Officer Review
10. Final Output:
   - Market Posture
   - Most Important Macro Signal
   - Most Important Holding Update
   - Strongest Current Holding
   - Weakest Current Holding
   - Highest-Risk Position
   - Top Add Watch
   - Top Trim Watch
   - Top 3 New Research Candidates
   - Rebalance Pressure
   - Final Judgment

## Named research sources

Standing source registry: `../../openclaw-state/capital-radar-source-registry.json`.

Analytic learning protocol: `../../openclaw-state/capital-radar-analytic-learning-protocol.md`.

Continuous market cognition extension: `../../openclaw-state/capital-radar-continuous-market-cognition-extension.md`.

Jun explicitly added these YouTube channels to the Capital Radar research engine:
- https://www.youtube.com/@Jungernaut
- https://www.youtube.com/@mijooeun
- https://www.youtube.com/@JUTOPIA
- https://www.youtube.com/@GrahamStephan
- https://www.youtube.com/@kimsstock
- https://www.youtube.com/@futuresnow

Use them for market information, stock-analysis methods, and hypothesis generation. Validate before action posture changes.

They must also feed analytic skill improvement: extract methods, not just ticker calls. Capture reusable chart/volume/risk/sizing/macro lessons and archive material changes in `runs/capital-radar/YYYY-MM-DD/analytic-learning.md`.

Continuous cognition requirement: preserve state transitions where possible — previous state, current state, likely next state, confidence/probability shift, evidence trigger, and reaction implication. The dashboard should compress what changed / what matters / what can be ignored / what action is allowed or forbidden.

Fractal market value protocol: `../../openclaw-state/capital-radar-fractal-market-value-protocol.md`. Every meaningful run should progressively assess broad markets, holdings, candidates, and themes across nested time scales: immediate tape, daily/tactical trend, weekly positioning cycle, quarterly earnings/expectation cycle, and multi-year structural value. Outputs should state which layers agree/conflict, what future is priced in, what behavior is allowed/forbidden, and what trigger changes posture.

## Required analytics layers

For holdings and candidates, include when available:
- real chart visual;
- support/resistance;
- moving averages;
- ATR/volatility;
- RSI/MACD or momentum proxy;
- volume vs average volume and relative volume;
- institutional ownership/transactions;
- short float;
- options/IV/Greeks/implied move for options or levered products;
- expectation-gap classification;
- accumulation/distribution or regime-state interpretation.

## Boundary
Separate from `projects/morning-brief`; Morning Brief remains 6:00 AM America/New_York.

Recurring Capital Radar reports and research findings must be written only to Capital Radar surfaces: dashboard/data files, archive files, holding pages, and Mission Control status. Do not post Capital Radar report content to Discord unless Jun explicitly asks for a visible Discord reply or a true operational blocker needs escalation.
