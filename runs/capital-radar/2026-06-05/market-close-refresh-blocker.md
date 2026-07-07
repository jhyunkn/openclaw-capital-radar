Capital Radar market-close refresh blocker

Date: 2026-06-05
Run: market-close refresh at 4:00 PM America/New_York

Status: partially refreshed, not fully confirmed.

What ran:
- `git status --short` inspected first; existing user/generated changes were not reset or reverted.
- `node live-data-adapter.cjs` failed before writing fresh live state.
- Retried `node live-data-adapter.cjs`; failed the same way.
- Retried with `FRED_FETCH_TIMEOUT_MS=45000` and `FRED_FETCH_RETRIES=5`; failed the same way.
- Direct curl check to `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` timed out after 40 seconds.
- Production stages ran after the adapter failure:
  - `live-state-and-research`
  - `market-orientation`
  - `workbench-hierarchy`
  - `compatibility-artifact-prep` as the current manifest equivalent for the requested `homepage` stage, because `homepage` is not a known stage in `config/build-pipeline.json`
  - `ship`
  - `validation`

Blocking evidence:
- Live adapter refused to write degraded state because FRED returned only 2 series; required at least 6.
- Timed-out FRED series: DGS2, DGS10, DGS30, T10YIE, DFF.
- Because the adapter did not write fresh live state, closing tape changes cannot be honestly confirmed as fully reflected in strategy state.

Artifact status:
- `outputs/live-reaction-state.json` updated at 2026-06-05T20:11:19Z.
- `outputs/strategy-state.json` updated at 2026-06-05T20:07:45Z.
- `index.html` and `public/index.html` updated around 2026-06-05T20:08:40Z.
- Final validation stage passed after narrow validator repairs for the current four-section homepage contract.

Next safe retry:
- Retry `node live-data-adapter.cjs` when FRED endpoints respond from this host.
- Then rerun the production stages in order and reconfirm the four required artifacts.
