# Capital Radar - Investment Blueprint Format

## Core shift

Capital Radar should not be a news recap. It should be a daily investment blueprint and risk committee memo.

A news recap says: what happened.

An investing blueprint says:

1. What changed?
2. Why does it matter?
3. Which holdings are affected?
4. Is the thesis stronger or weaker?
5. Is valuation still acceptable?
6. What would change the decision?
7. What should be watched next?
8. What risk is being ignored?
9. What action signal follows?
10. What evidence would upgrade or downgrade the view?

## Ideal report architecture

1. One-page Decision Dashboard
2. Market Regime / Macro Backdrop
3. Kostolany Cycle + Sentiment Position
4. Portfolio Exposure Map
5. Existing Holdings Health Cards
6. Material News / Events
7. Valuation + Expectations Check
8. Rebalance Pressure
9. Opportunity Scout
10. Risk Officer Review
11. Action Signal Table
12. Final Judgment + Watchlist Triggers
13. Evidence Appendix

## Section purposes

### 1. One-page Decision Dashboard

Purpose: answer what Jun should pay attention to today.

Include:

- Market posture
- Risk level
- Top holding concern
- Strongest holding
- Weakest holding
- Highest-risk position
- Top add watch
- Top trim watch
- Rebalance pressure
- Three watch triggers

### 2. Market Regime

Purpose: classify the investing weather.

Inputs:

- Growth
- Inflation
- Policy/rates
- Liquidity/credit
- Risk appetite
- Volatility
- Earnings revision climate

### 3. Kostolany Cycle + Sentiment Position

Purpose: locate market psychology and liquidity cycle.

Output should classify the environment as one of:

- Accumulation
- Markup
- Euphoria
- Distribution
- Panic
- Repair

Then state whether speculation should be increased, held, or reduced.

### 4. Portfolio Exposure Map

Purpose: show hidden concentration.

Use buckets:

- Core compounder
- Index anchor
- Thematic growth
- Speculative single-name
- Levered / decay product
- Crypto / proxy exposure
- AI infrastructure exposure
- Rate-sensitive duration equity

This is where TSLT and CONL must be separated from MSFT, AMZN, META, MA, and SPY.

### 5. Existing Holdings Health Cards

Purpose: make every position decision-ready.

Each card should include:

- Ticker / shares / market value / portfolio weight
- Role
- Thesis
- Health score
- Action signal
- What changed
- Valuation status
- Momentum / revision status
- Bear case
- Kill or trim trigger
- Add trigger
- Confidence
- Evidence links

### 6. Material News / Events

Purpose: filter noise.

Every item gets:

- Materiality 0-5
- Affected holdings
- Fact summary
- Thesis impact
- Time horizon
- Source/date
- Confidence

Only materiality 4-5 items should affect action signals.

### 7. Valuation + Expectations

Purpose: answer what is priced in.

Fields:

- Forward P/E
- EV/EBITDA
- FCF yield
- Revenue growth
- Margin trend
- Earnings revisions
- Guidance change
- Relative valuation vs peers / SPY / history
- Implied expectation
- Valuation risk score

### 8. Rebalance Pressure

Purpose: convert analysis into portfolio-level judgment.

Inputs:

- Position weight
- Risk bucket
- Correlation
- Drawdown risk
- Valuation stretch
- Thesis deterioration
- Opportunity cost vs SPY
- Cash/add capacity

Output:

- None / Low / Medium / High / Urgent
- Add pressure
- Trim pressure
- Risk budget notes

### 9. Opportunity Scout

Purpose: find candidates worth researching, not random tickers.

Each candidate:

- Ticker / name
- Theme
- Why now
- Quality score
- Valuation score
- Catalyst
- Risk
- Fit with portfolio
- Signal: ADD WATCH or ADD CANDIDATE only
- Rank top 10; deep dive top 3

### 10. Risk Officer Review

Purpose: adversarial check.

Must answer:

- What can go wrong?
- What is crowded?
- What is misunderstood?
- What is levered or path-dependent?
- What is correlated with existing holdings?
- What signal requires human review?

## Scoring model

### Holding Health Score - 100 points

| Category | Weight |
|---|---:|
| Business quality / moat | 15 |
| Thesis strength | 15 |
| Valuation / expectations | 15 |
| Earnings revisions / fundamentals trend | 15 |
| Momentum / relative strength | 10 |
| Balance sheet / liquidity | 10 |
| Portfolio fit / diversification | 10 |
| Risk flags / downside asymmetry | 10 |

Risk flags subtract points:

- Levered ETF/ETN/path dependency: -10 to -25
- Unknown thesis/liquidity: -10 to -30
- Crowded narrative: -5 to -15
- Deteriorating revisions: -5 to -20
- Valuation extreme: -5 to -20

### Score bands

- 85-100: Strong HOLD / possible ADD WATCH
- 70-84: HOLD
- 55-69: HOLD / WATCH
- 40-54: TRIM WATCH or INVESTIGATE
- 25-39: TRIM CANDIDATE / EXIT REVIEW
- 0-24: EXIT REVIEW

### Opportunity Candidate Score - 100 points

| Category | Weight |
|---|---:|
| Quality | 20 |
| Valuation asymmetry | 20 |
| Catalyst / timing | 15 |
| Revision / momentum inflection | 15 |
| Portfolio fit | 10 |
| Downside clarity | 10 |
| Source confidence | 10 |

Candidate bands:

- 80+: ADD CANDIDATE
- 65-79: ADD WATCH
- 50-64: RESEARCH WATCH / archive until stronger evidence
- Below 50: reject / archive

## Claim discipline

Every material statement should be labeled as one of:

- Fact: source-backed data or event
- Derived metric: calculation from facts
- Inference: interpretation from evidence
- Assumption: forward-looking input
- Speculation: plausible but weakly evidenced possibility
- Action signal: constrained non-brokerage output

Example:

> Fact: 10Y yield rose X bps this week.  
> Inference: Duration-sensitive growth multiples may face pressure.  
> Uncertainty: Earnings revisions have not confirmed broad deterioration.  
> Action Signal: HOLD / WATCH for high-multiple names.

## V1 implementation priorities

1. Live price and portfolio weights.
2. Rates and credit snapshot.
3. Decision dashboard + exposure map.
4. Health scoring object for each holding.
5. Evidence appendix with URLs and timestamps.
6. Material news scan.
7. Valuation fields and estimates.
8. Candidate scanner.
9. PDF/PPT export only after the data spine is reliable.
