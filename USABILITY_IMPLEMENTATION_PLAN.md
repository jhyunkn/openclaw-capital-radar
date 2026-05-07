# Capital Radar ? Usability Implementation Plan

Date: 2026-05-07

## Why this update exists

The precedent research showed that the financial report should not be a decorative dashboard. It needs to become an institution-style report workflow: trusted sources, market cockpit, macro/rates/credit context, insight cards, human review gates, and a final committee-style judgment.

## Usable V1 definition

A usable Capital Radar report must answer, every trading morning:

1. What is the market regime?
2. Where are we in the Kostolany cycle?
3. What changed in the existing holdings?
4. Which news items are materially thesis-changing?
5. Are valuations/expectations still acceptable?
6. Is rebalance pressure rising or falling?
7. What are the allowed action signals?
8. What new opportunities deserve research?
9. What does the risk officer object to?
10. What is the final compact judgment?

## Files added

- `REPORT_TEMPLATE.md` ? human-readable report structure and publication gates.
- `data/report-state.sample.json` ? machine-readable state object for one daily report.
- `generate-daily-report.cjs` ? renders the state object into a Markdown daily report.
- `validate-report.cjs` ? checks required sections, holdings, and allowed action signals.
- `outputs/2026-05-07-capital-radar-sample.md` ? generated sample output.

## Precedent-to-report translation

- FRED / ALFRED ? source dates, release freshness, vintage/revision awareness.
- Bloomberg / Koyfin / TradingView ? market cockpit, holdings watchlist, cross-asset tape.
- BIS / Treasury ? rates, credit, liquidity, fiscal plumbing.
- World Bank / JPMorgan / BlackRock ? report-native chartbook and committee-ready framing.
- Visual Capitalist / OWID ? narrative clarity and visual explanation, but subordinate to source trust.

## Next blockers

1. Live data adapters: market tape, rates, macro, holdings prices, valuation fields, news/filings.
2. Decision on source stack: free/public first vs paid market data provider.
3. Output format: Markdown first is working; PDF/PPT can come after data reliability.
4. Human review protocol for TRIM/EXIT signals.
