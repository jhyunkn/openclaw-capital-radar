# Mock Data

Mock data lives here before any radar component is connected to live data.

Purpose:

- stabilize component data contracts
- test visual states without touching live-data collectors
- make decision visuals reproducible
- prevent one-off hardcoded values inside production components

Current files:

- `pltr-signal.json` — first ticker-level decision-support mock for PLTR.

Rule: if a visual cannot render from a mock JSON object, it is not ready for live-data integration.
