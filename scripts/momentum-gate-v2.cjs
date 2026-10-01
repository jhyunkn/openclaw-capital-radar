'use strict';

/*
 * momentum-gate-v2.cjs
 *
 * Shared regime-gate implementation (v2) for the momentum engine.
 * Required by BOTH scripts/run-momentum-backtest.cjs and
 * scripts/generate-momentum-state.cjs — single implementation, no drift
 * between the backtest and the live gate.
 *
 * Design (fixed a priori; do NOT tune the parameters):
 *
 *   Stress score S = (SPX below 200d ? 1:0)
 *                  + (HY OAS >= 4.0   ? 1:0)
 *                  + (VIX  >= 30      ? 1:0)
 *
 *   Rationale for the legs/thresholds: VIX 30 marks genuine stress (25 was
 *   noise in the v1 backtest); the old 3.5 HY yellow threshold was noise;
 *   SPX-vs-200d is the primary trend leg. A leg whose input is unavailable
 *   contributes 0 (same substitution the v1 harness used for HY OAS before
 *   2023-09-30, when BAMLH0A0HYM2 history begins).
 *
 *   Exposure tiers (floor — NEVER 0%; the v1 evidence shows 0% exposure is
 *   what creates the catastrophic re-risk lag):
 *     S = 0  -> tier 0 FULL      -> 100% exposure
 *     S = 1  -> tier 1 REDUCED   ->  60% exposure
 *     S >= 2 -> tier 2 DEFENSIVE ->  25% exposure
 *
 *   Target list is ALWAYS the top decile, scaled by exposure; the remainder
 *   is cash. No vigintile concentration (the v1 YELLOW tier cost -17.93pp
 *   over 7 months — concentrating during stress underperforms the decile).
 *
 *   Hysteresis (asymmetric, principled):
 *     - De-risk applies IMMEDIATELY when S rises (crash protection must be
 *       fast — the v1 gate's de-risk leg worked).
 *     - Re-risk moves at most ONE tier per rebalance (one step toward fuller
 *       exposure), and only when the lower S has held for 2 consecutive
 *       rebalances (current + prior). Re-entry is where whipsaw lives.
 *     - The first observation initializes the effective tier (no history to
 *       confirm against).
 *     - fast=true variant: re-risk needs only 1 rebalance of confirmation
 *       (no hold requirement), still at most one tier per rebalance.
 */

const THRESHOLDS = Object.freeze({
  hyOasStress: 4.0, // HY OAS >= 4.0 = credit stress leg
  vixStress: 30,    // VIX >= 30 = genuine stress; 25 was noise
});

const EXPOSURE_BY_TIER = Object.freeze([1.0, 0.6, 0.25]); // tier 0/1/2
const TIER_LABELS = Object.freeze(['FULL', 'REDUCED', 'DEFENSIVE']);
const TIER_COUNT = EXPOSURE_BY_TIER.length;

function r6(x) { return Math.round(x * 1e6) / 1e6; }

/**
 * Compute the stress score from the three legs.
 * inputs: { spxBelow200d: boolean|null, hyOas: number|null, vix: number|null }
 * A leg with an unavailable input contributes 0 (documented substitution).
 * Returns { score, legs, legsAvailable, legsTotal }.
 */
function scoreFromLegs(inputs) {
  const { spxBelow200d = null, hyOas = null, vix = null } = inputs || {};
  const legs = { spxBelow200d: null, hyOasStress: null, vixStress: null };
  let score = 0;
  let available = 0;

  if (spxBelow200d === true || spxBelow200d === false) {
    legs.spxBelow200d = spxBelow200d;
    available++;
    if (spxBelow200d) score++;
  }
  if (typeof hyOas === 'number' && Number.isFinite(hyOas)) {
    legs.hyOasStress = hyOas >= THRESHOLDS.hyOasStress;
    available++;
    if (legs.hyOasStress) score++;
  }
  if (typeof vix === 'number' && Number.isFinite(vix)) {
    legs.vixStress = vix >= THRESHOLDS.vixStress;
    available++;
    if (legs.vixStress) score++;
  }
  return { score, legs, legsAvailable: available, legsTotal: 3 };
}

/**
 * Target tier for a raw score (no hysteresis).
 * Returns { tier, tierLabel, exposure }.
 */
function tierFromScore(score) {
  const s = Math.max(0, Math.floor(score));
  const tier = s <= 0 ? 0 : s === 1 ? 1 : 2;
  return { tier, tierLabel: TIER_LABELS[tier], exposure: EXPOSURE_BY_TIER[tier] };
}

/**
 * Apply the asymmetric hysteresis over a score sequence.
 * scoreSeq: [{ date, score }, ...] ascending by date (rebalance cadence).
 * options: { fast } — fast=true needs only 1 rebalance of confirmation.
 * Returns per-step [{ date, score, tier, tierLabel, exposure, tierChanged }].
 *
 * Rules:
 *   - target tier >= effective tier (de-risk or hold): apply immediately.
 *   - target tier <  effective tier (re-risk): at most one tier per step,
 *     only with confirmation — standard: the lower score has held for 2
 *     consecutive rebalances (current + prior); fast: no hold required.
 *   - First step initializes the effective tier.
 */
function applyHysteresis(scoreSeq, options = {}) {
  const fast = options.fast === true;
  const out = [];
  let effectiveTier = null;
  let prevScore = null;
  for (const step of scoreSeq) {
    const { tier: targetTier } = tierFromScore(step.score);
    let changed = false;
    if (effectiveTier === null) {
      effectiveTier = targetTier; // initialization: no history to confirm against
    } else if (targetTier >= effectiveTier) {
      // De-risk (or hold): immediate. Crash protection must be fast.
      if (effectiveTier !== targetTier) changed = true;
      effectiveTier = targetTier;
    } else {
      // Re-risk: at most one tier per rebalance, only with confirmation.
      const confirmed = fast || (prevScore !== null && prevScore === step.score);
      if (confirmed) {
        effectiveTier = effectiveTier - 1;
        changed = true;
      }
    }
    out.push({
      date: step.date,
      score: step.score,
      tier: effectiveTier,
      tierLabel: TIER_LABELS[effectiveTier],
      exposure: EXPOSURE_BY_TIER[effectiveTier],
      tierChanged: changed,
    });
    prevScore = step.score;
  }
  return out;
}

/** Human-readable one-line summary, e.g. "STRESS 1 · REDUCED · 60% exposure". */
function describe(step) {
  const pct = Math.round(step.exposure * 100);
  return `STRESS ${step.score} · ${step.tierLabel} · ${pct}% exposure`;
}

module.exports = {
  THRESHOLDS,
  EXPOSURE_BY_TIER,
  TIER_LABELS,
  TIER_COUNT,
  scoreFromLegs,
  tierFromScore,
  applyHysteresis,
  describe,
  r6,
};
