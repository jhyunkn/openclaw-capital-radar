function clampProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asymmetryScore({ probabilityUp = 0, probabilityDown = 0, upsideReward = 1, downsideRisk = 1 } = {}) {
  const up = clampProbability(probabilityUp) / 100;
  const down = clampProbability(probabilityDown) / 100;
  const reward = Number(upsideReward) || 1;
  const risk = Math.max(0.01, Number(downsideRisk) || 1);
  return Math.round(((up * reward) / Math.max(0.01, down * risk)) * 10) / 10;
}

function valuationRiskScore(risk) {
  return { low: 20, moderate: 45, high: 70, extreme: 90 }[risk] ?? 50;
}

function technicalRegimeScore(regime) {
  return { uptrend: 80, recovery: 65, transition: 50, range: 45, breakdown: 20 }[regime] ?? 50;
}

function liquidityConditionScore(condition) {
  return { supportive: 80, neutral: 55, tightening: 35, stress: 15 }[condition] ?? 50;
}

module.exports = {
  clampProbability,
  asymmetryScore,
  valuationRiskScore,
  technicalRegimeScore,
  liquidityConditionScore,
};
