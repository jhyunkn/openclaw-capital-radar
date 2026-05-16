const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const outDir = path.join(root, 'agent-notes', 'tickers');
fs.mkdirSync(outDir, { recursive: true });

function round(n, digits = 2) {
  return typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
}
function arr(...items) {
  return items.filter(Boolean);
}
function signal(h) {
  return h.computedSignal || h.signal || 'HOLD';
}
function confidenceFor(h) {
  let score = 0.45;
  if (h.thesis || h.actionRationale) score += 0.15;
  if (h.dataContract?.forwardPE != null) score += 0.08;
  if (h.dataContract?.fcfYield != null) score += 0.08;
  if (h.dataContract?.nextEarningsDate) score += 0.08;
  if (h.finviz?.parsed?.avgVolume != null) score += 0.06;
  return Math.max(0.1, Math.min(0.92, Number(score.toFixed(2))));
}
function defaultNote(h) {
  const ticker = h.ticker;
  const current = Number(h.livePrice || 0);
  const low = current ? round(current * 0.92) : null;
  const high = current ? round(current * 1.12) : null;
  const stop = current ? round(current * 0.84) : null;
  const trimLow = current ? round(current * 1.18) : null;
  const trimHigh = current ? round(current * 1.32) : null;
  const bias = signal(h);
  const thesis = h.thesis || h.actionRationale || `${ticker} requires an explicit agent-written thesis. Current system signal is ${bias}.`;
  return {
    ticker,
    lastReviewed: new Date().toISOString().slice(0, 10),
    agentThesis: {
      baseCase: thesis,
      bullCase: `Bull case to be refined by OpenClaw finance agent: identify the specific catalyst, time horizon, and evidence required for ${ticker} to deserve more capital.`,
      bearCase: `Bear case to be refined by OpenClaw finance agent: identify what would make ${ticker} a value trap, crowded trade, or thesis break.`,
      invalidation: h.watch || `Define the concrete price, fundamental, or macro condition that invalidates the ${ticker} thesis.`,
      currentBias: bias,
      confidence: confidenceFor(h)
    },
    technicalMap: {
      trendRegime: h.perf1mPct > 0 && h.perf3mPct > 0 ? 'constructive multi-week trend' : h.perf1mPct < 0 && h.perf3mPct < 0 ? 'deteriorating multi-week trend' : 'mixed / transitional trend',
      supportLevels: arr(low, stop),
      resistanceLevels: arr(high, trimLow),
      buyZone: arr(low, current ? round(current * 0.98) : null),
      trimZone: arr(trimLow, trimHigh),
      stopZone: arr(stop),
      fractalRead: 'Agent should map daily, weekly, and monthly structure before changing strategy. Current seed is a placeholder derived from live price bands.',
      multiTimeframeRead: 'Agent should compare short-term momentum against longer-term thesis persistence. Do not let a one-day move dominate the strategic read.'
    },
    strategyProtocol: {
      holdIf: arr('Thesis remains intact.', 'Position size remains inside risk budget.', 'No material deterioration in trend, liquidity, or data quality.'),
      addIf: arr('Price enters buy/add zone with supportive volume.', 'Scorecard weakness is data-related rather than thesis-related.', 'Macro pressure is stable or improving.'),
      trimIf: arr('Position exceeds configured risk budget.', 'Price enters trim zone without corresponding thesis upgrade.', 'Weakest factor deteriorates for two consecutive reviews.'),
      exitIf: arr('Thesis invalidation condition is triggered.', 'Liquidity or event risk becomes unacceptable.', 'Signal escalates to EXIT REVIEW with confirmed evidence.'),
      doNothingIf: arr('Signal conflict is unresolved.', 'Missing data prevents a clean conclusion.', 'Move is noise inside the action bands.')
    },
    agentLog: [
      {
        date: new Date().toISOString().slice(0, 10),
        observation: `Seeded from live portfolio state. ${ticker} signal is ${bias}; portfolio weight is ${h.portfolioWeightPct ?? 'unknown'}%.`,
        changedSinceLastReview: 'Initial agent-note seed; no prior review history yet.',
        recommendedReaction: bias,
        uncertainty: 'Agent-written thesis and technical map require refinement after source review.',
        nextCheck: 'Review after next market-data refresh or material price/signal change.'
      }
    ],
    openQuestions: arr(
      `What evidence would justify adding to ${ticker} rather than simply holding?`,
      `What exact condition invalidates the ${ticker} thesis?`,
      `Is current weakness/opportunity driven by price action, fundamentals, macro pressure, or missing data?`
    )
  };
}
for (const h of holdings) {
  if (!h.ticker) continue;
  const file = path.join(outDir, `${String(h.ticker).toLowerCase()}.json`);
  if (fs.existsSync(file)) continue;
  fs.writeFileSync(file, JSON.stringify(defaultNote(h), null, 2) + '\n');
}
console.log(`seeded ticker intelligence notes for ${holdings.length} holdings`);
