# Financial Report

Separate automation from Morning Brief.

- Purpose: finance-focused search/report automation.
- Schedule target: 8:30 AM America/New_York, aligned with market open context.
- Boundary: do not modify `projects/morning-brief` for this automation.
- Morning Brief remains its own 6:00 AM America/New_York process.

## Local validation plan

1. Define finance-search sources and report format.
2. Build local generator/check scripts under this folder only.
3. Validate locally before any GitHub/Vercel setup.
4. Only after local validation, create a separate GitHub/Vercel path if Jun approves.


## Usable V1 packet

The report now has an executable packet, not just a prototype:

- `REPORT_TEMPLATE.md` ? required report structure and publication gates.
- `data/report-state.sample.json` ? machine-readable daily report state.
- `validate-report.cjs` ? validates required sections, holdings, and allowed action signals.
- `generate-daily-report.cjs` ? renders Markdown output to `outputs/`.
- `USABILITY_IMPLEMENTATION_PLAN.md` ? precedent-to-report translation and next blockers.

Run locally from the workspace root:

```powershell
node projects/financial-report/validate-report.cjs
node projects/financial-report/generate-daily-report.cjs
```

Current state remains sample-only until live data adapters and source verification are wired.
