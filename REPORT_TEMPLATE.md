# Capital Radar Daily Report Template

Use this file as the human-readable structure. Use `data/report-state.sample.json` as the machine-readable version and `generate-daily-report.cjs` to produce a Markdown report.

## Operating principle

The report must be useful before it is beautiful. Every claim needs one of four labels:

- **Fact** ? source-backed market/macro/company data.
- **Inference** ? reasoned interpretation from facts.
- **Uncertainty** ? unresolved or weak evidence.
- **Action signal** ? one of the allowed non-brokerage signals.

Allowed signals: HOLD, HOLD / WATCH, ADD WATCH, ADD CANDIDATE, TRIM WATCH, TRIM CANDIDATE, EXIT REVIEW, INVESTIGATE.

## Required sections

1. Market Regime
2. Kostolany Cycle Position
3. Existing Holdings Review with standardized health cards
4. News and Article Monitoring with materiality 0?5
5. Valuation and Expectation Analysis
6. Rebalance Analysis
7. Action Signals
8. Opportunity Scout: 10 candidates, top 3 deeper research
9. Risk Officer Review
10. Final Output

## Usability gates before publication

- No mock data remains.
- Each material claim has source/date.
- Every holding has a signal, thesis, bear case, and next trigger.
- Levered/speculative products are explicitly separated from compounder holdings.
- Risk Officer section is completed before Final Judgment.
- Any trim/exit language is human-reviewed.
