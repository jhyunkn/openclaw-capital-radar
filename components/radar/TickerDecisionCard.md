# TickerDecisionCard

Status: needed / staged.

Purpose: summarize a ticker's decision posture in one card.

Input data shape: `TickerSignal` from `lib/types/radar.ts`.

Decision supported: whether the ticker is an add, hold, trim, avoid, or watch candidate under the current regime.

Implementation note: keep this component data-driven. Do not hardcode PLTR or any one ticker into the component.
