// Triple-alignment engine (opportunity-framework v2):
// every ranked name is scored on three lenses — macro fit, quality math,
// momentum structure — and must clear ALL THREE floors to be TRIPLE_ALIGNED.
// One lens below floor = NEAR_MISS (published with the failing lens named).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(f) { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } }
const framework = read('data/intelligence/opportunity-framework.json') || {};
const cfg = framework.triple_alignment || {};
const ranked = read('outputs/conviction-ranking.json')?.ranked || [];
const wl = read('outputs/watchlist-market-data.json')?.tickers || {};
const scanner = Object.fromEntries((read('data/scanner-universe.json')?.candidates || []).map(c => [c.ticker, c]));
const oppUniverse = Object.fromEntries((read('data/opportunity-universe.json')?.tickers || []).map(t => [t.ticker, t]));
const holdings = new Set(((read('outputs/robinhood-positions.json')?.positions) || []).map(p => p.symbol || p.ticker));

// Regime theme weights — hawkish repricing (re-set these when the regime flips;
// authority: framework.current_regime_read)
const THEME_WEIGHTS = {
  AI_INFRASTRUCTURE: 10, SEMICONDUCTOR_CAPEX: 9, AI_INFERENCE_DEMAND: 8,
  NUCLEAR_POWER: 8, GRID_MODERNIZATION: 8, DEFENSE_AI: 7,
  ENTERPRISE_AI_SOFTWARE: 5, SPACE_ECONOMY: 4,
};
// Fallback keyword map for opportunity-universe names without scanner themeAdjacency
const THEME_KEYWORDS = [
  [/semiconductor|foundry|memory|chip|lithography|wafer/i, 'SEMICONDUCTOR_CAPEX'],
  [/ai infra|data.?cent|hyperscaler|accelerator|gpu/i, 'AI_INFRASTRUCTURE'],
  [/nuclear|uranium/i, 'NUCLEAR_POWER'],
  [/grid|power|electri|utility|transmission/i, 'GRID_MODERNIZATION'],
  [/defense|military|drone|unmanned/i, 'DEFENSE_AI'],
  [/software|saas|platform/i, 'ENTERPRISE_AI_SOFTWARE'],
];

function themesFor(ticker) {
  if (scanner[ticker]?.themeAdjacency?.length) return scanner[ticker].themeAdjacency;
  const themeText = `${oppUniverse[ticker]?.theme || ''} ${oppUniverse[ticker]?.whyCore || ''}`;
  const hits = THEME_KEYWORDS.filter(([re]) => re.test(themeText)).map(([, t]) => t);
  return hits.length ? hits : [];
}

function parseRevGrowth(signals) {
  for (const s of signals || []) {
    const m = /Revenue \+?(-?[\d.]+)% YoY/.exec(s);
    if (m) return Number(m[1]);
  }
  return null;
}

function scoreMacro(r) {
  const themes = themesFor(r.ticker);
  const themeScore = Math.max(0, ...themes.map(t => THEME_WEIGHTS[t] || 0));
  let score = themeScore * 2;
  const notes = [`themes: ${themes.join('/') || 'none mapped'} (${themeScore}x2)`];
  if (r.decline_reason === 'SENTIMENT_DRIVEN') { score += 8; notes.push('decline is rate/sentiment compression — the regime mechanism (+8)'); }
  if (r.catalyst_note || scanner[r.ticker]?.catalystWindow) { score += 2; notes.push('dated catalyst in window (+2)'); }
  return { score: Math.min(30, score), notes };
}

const xbrlByTicker = (() => {
  const src = read('outputs/xbrl-revenue-trends.json');
  const map = {};
  const walk = v => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      if (v.ticker && v.inflection) map[v.ticker] = v.inflection;
      Object.values(v).forEach(walk);
    }
  };
  walk(src);
  return map;
})();

function scoreQuality(r) {
  const gates = r.gate_passed;
  const scannerScored = gates && !Array.isArray(gates) && typeof gates === 'object';
  let score = 0;
  const notes = [];
  let rev = parseRevGrowth(r.fundamental_signals);

  if (scannerScored) {
    if (gates.quality) { score += 12; notes.push('quality gate (+12)'); }
    if (gates.moat) { score += 10; notes.push('moat gate (+10)'); }
  } else {
    // OPP_UNIVERSE injection — never went through scanner XBRL scoring.
    // Fall back to raw XBRL so a coverage gap doesn't read as failed math.
    const x = xbrlByTicker[r.ticker];
    if (x && Number.isFinite(x.yoy_latest)) {
      rev = rev ?? x.yoy_latest;
      if (x.yoy_latest > 10 && /RECOVERY|IMPROVING|INFLECTING/i.test(x.status || '')) {
        score += 12; notes.push(`quality via XBRL fallback: ${x.interpretation} (+12)`);
      }
    } else {
      notes.push('no scanner gates AND no XBRL coverage — quality unmeasured');
    }
    if (oppUniverse[r.ticker]?.moat) { score += 5; notes.push('moat from curated universe only — not scanner-verified (+5, capped)'); }
  }

  if (rev != null && rev < 0) return { score: 0, notes: [`revenue declining ${rev}% — hard reject`], hardReject: true };
  if (rev != null) {
    const pts = rev > 25 ? 10 : rev > 15 ? 7 : rev > 5 ? 4 : rev > 0 ? 2 : 0;
    score += pts; notes.push(`revenue +${rev}% YoY (+${pts})`);
  }
  if ((r.fundamental_signals || []).some(s => /FCF \$[\d,]+M.*(strong|positive)/i.test(s))) { score += 8; notes.push('FCF positive (+8)'); }
  return { score: Math.min(40, score), notes, coverage: scannerScored ? 'SCANNER' : 'XBRL_FALLBACK' };
}

function scoreMomentum(ticker) {
  const w = wl[ticker] || {};
  const rsi = Number.isFinite(w.rsi14) ? w.rsi14 : null;
  const trend = Number.isFinite(w.trend1mPct) ? w.trend1mPct : null;
  const pct52 = Number.isFinite(w.pctFrom52wHigh) ? w.pctFrom52wHigh : null;
  if (rsi == null || pct52 == null) return { score: 0, shape: 'NO_DATA', notes: ['no watchlist technicals — cannot score momentum'] };
  const reversion =
    (rsi >= 33 && rsi <= 52 ? 12 : rsi > 52 && rsi <= 58 ? 6 : 0) +
    (trend != null && trend >= -8 && trend <= 8 ? 8 : trend != null && trend > 8 ? 4 : 0) +
    (pct52 <= -18 ? 10 : pct52 <= -12 ? 5 : 0);
  const leadership =
    (rsi >= 50 && rsi <= 70 ? 12 : 0) +
    (trend != null && trend > 0 ? 8 : 0) +
    (pct52 >= -15 ? 10 : pct52 >= -20 ? 4 : 0);
  const shape = reversion >= leadership ? 'REVERSION' : 'LEADERSHIP';
  const score = Math.max(reversion, leadership);
  return { score, shape, notes: [`RSI ${rsi}, 1m ${trend != null ? trend + '%' : '?'}, ${pct52}% from 52wH → ${shape} shape ${score}/30`] };
}

const FLOORS = { macro: cfg.lenses?.macro_fit?.floor ?? 16, quality: cfg.lenses?.quality_math?.floor ?? 22, momentum: cfg.lenses?.momentum_structure?.floor ?? 16 };

const results = [];
for (const r of ranked) {
  if (holdings.has(r.ticker)) continue;
  const macro = scoreMacro(r);
  const quality = scoreQuality(r);
  const momentum = scoreMomentum(r.ticker);
  if (quality.hardReject) continue;
  const fails = [
    macro.score < FLOORS.macro ? 'macro_fit' : null,
    quality.score < FLOORS.quality ? 'quality_math' : null,
    momentum.score < FLOORS.momentum ? 'momentum_structure' : null,
  ].filter(Boolean);
  const verdict = fails.length === 0 ? 'TRIPLE_ALIGNED' : fails.length === 1 ? 'NEAR_MISS' : 'FILTERED';
  results.push({
    ticker: r.ticker, name: r.name, verdict,
    total: macro.score + quality.score + momentum.score,
    macro_fit: macro.score, quality_math: quality.score, momentum_structure: momentum.score,
    quality_coverage: quality.coverage || 'SCANNER',
    momentum_shape: momentum.shape,
    failing_lens: fails.length === 1 ? fails[0] : (fails.length > 1 ? fails.join('+') : null),
    conviction: r.conviction_score ?? null,
    detail: { macro: macro.notes, quality: quality.notes, momentum: momentum.notes },
  });
}
results.sort((a, b) => (a.verdict === b.verdict ? b.total - a.total : a.verdict === 'TRIPLE_ALIGNED' ? -1 : b.verdict === 'TRIPLE_ALIGNED' ? 1 : a.verdict === 'NEAR_MISS' ? -1 : 1));

const state = {
  artifact: 'triple-alignment-state',
  version: 1,
  generatedAt: new Date().toISOString(),
  framework_version: framework.version || null,
  regime: framework.current_regime_read?.regime || 'unset',
  floors: FLOORS,
  doctrine: cfg.principle || 'All three lenses must clear their floors.',
  aligned: results.filter(r => r.verdict === 'TRIPLE_ALIGNED'),
  near_miss: results.filter(r => r.verdict === 'NEAR_MISS'),
  filtered_count: results.filter(r => r.verdict === 'FILTERED').length,
};
for (const f of ['outputs/triple-alignment-state.json', 'public/outputs/triple-alignment-state.json']) {
  const p = path.join(root, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
}
console.log(`TRIPLE_ALIGNED: ${state.aligned.map(r => `${r.ticker}(${r.total})`).join(', ') || 'none'}`);
console.log(`NEAR_MISS: ${state.near_miss.map(r => `${r.ticker}(fails ${r.failing_lens})`).join(', ') || 'none'}`);
console.log(`filtered: ${state.filtered_count}`);
