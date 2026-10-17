'use strict';
// Episode / reaction state for the narrative brief's reaction layer.
//
// Computes the mechanical state of the current market episode from settled
// Yahoo daily bars (^GSPC, SMH, NVDA, ^VIX) plus the HY OAS level the live
// adapter already fetched: index drawdown from its trailing high, distance
// to the 50/200-day averages, AI-complex zone occupancy against the bands in
// config/reaction-episode.json, VIX behavior, credit calm, and a small
// mechanical capitulation tally. The brief writer turns this into the
// reaction ladder; this script only measures.
//
// Never hard-fails: on fetch failure it re-emits the previous artifact with
// status DEGRADED (or an UNAVAILABLE skeleton on first run), so the lane
// continues and the brief can state honestly that episode data is stale.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'outputs', 'episode-state.json');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config', 'reaction-episode.json'), 'utf8'));

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fallback; }
}
const round = (v, d = 2) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null);

async function fetchBars(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Capital Radar episode state)' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('empty chart result');
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const bars = [];
      for (let i = 0; i < ts.length; i++) {
        const close = q.close?.[i];
        if (!Number.isFinite(close)) continue;
        bars.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          open: q.open?.[i] ?? null, high: q.high?.[i] ?? null,
          low: q.low?.[i] ?? null, close, volume: q.volume?.[i] ?? null,
        });
      }
      if (bars.length < 60) throw new Error(`only ${bars.length} bars`);
      return bars;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('fetch failed');
}

// Settled bars only: drop today's bar while the US session is still open
// (same lesson as the cycle-watch fetcher — a partial bar distorts the math).
function settledBars(bars) {
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayET = nowET.toISOString().slice(0, 10);
  const minutesET = nowET.getHours() * 60 + nowET.getMinutes();
  const last = bars[bars.length - 1];
  if (last && last.date === todayET && minutesET < 16 * 60) return bars.slice(0, -1);
  return bars;
}

function summarize(symbol, bars, zones) {
  const closes = bars.map(b => b.close);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const highWindow = bars.slice(-120);
  const trailingHigh = Math.max(...highWindow.map(b => (Number.isFinite(b.high) ? b.high : b.close)));
  const sma = n => (closes.length >= n ? closes.slice(-n).reduce((a, c) => a + c, 0) / n : null);
  const sma50 = sma(50); const sma200 = sma(200);
  const out = {
    symbol,
    date: last.date,
    close: round(last.close),
    dayChangePct: round(pct(last.close, prev?.close)),
    ret5dPct: round(pct(last.close, closes[closes.length - 6])),
    ret20dPct: round(pct(last.close, closes[closes.length - 21])),
    trailingHigh120: round(trailingHigh),
    drawdownFromHighPct: round(pct(last.close, trailingHigh)),
    sma50: round(sma50), sma200: round(sma200),
    pctVsSma50: round(pct(last.close, sma50)),
    pctVsSma200: round(pct(last.close, sma200)),
    lastVolume: last.volume ?? null,
    avgVolume20: null,
  };
  const priorVols = bars.slice(-21, -1).map(b => b.volume).filter(Number.isFinite);
  if (priorVols.length >= 10 && Number.isFinite(last.volume)) {
    out.avgVolume20 = Math.round(priorVols.reduce((a, c) => a + c, 0) / priorVols.length);
  }
  if (zones) {
    const p = last.close;
    const [z1lo, z1hi] = zones.zone1; const [z2lo, z2hi] = zones.zone2;
    out.zone = p > z1hi ? 'ABOVE_ZONE_1' : p >= z1lo ? 'ZONE_1' : p > z2hi ? 'BETWEEN_ZONES' : p >= z2lo ? 'ZONE_2' : 'BELOW_ZONE_2';
    out.zones = { zone1: zones.zone1, zone2: zones.zone2 };
  }
  return { summary: out, lastBar: last, bars };
}

async function main() {
  const prev = readJson('outputs/episode-state.json', null);
  const errors = [];
  const data = {};
  for (const sym of ['^GSPC', 'SMH', 'NVDA', '^VIX']) {
    try { data[sym] = summarize(sym, settledBars(await fetchBars(sym)), cfg.zones[sym]); }
    catch (e) { errors.push(`${sym}: ${e.message}`); }
  }

  if (!data['^GSPC'] || !data['SMH']) {
    // Core episode math impossible — degrade honestly, never block the lane.
    if (prev && prev.spx && prev.status !== 'UNAVAILABLE') {
      const degraded = { ...prev, generatedAt: new Date().toISOString(), status: 'DEGRADED', dataStale: true, lastError: errors.join('; ') };
      fs.writeFileSync(outPath, JSON.stringify(degraded, null, 2));
      console.log(`episode-state: DEGRADED (reusing last good; ${errors.join('; ')})`);
      return;
    }
    fs.writeFileSync(outPath, JSON.stringify({
      artifact: 'episode-state', generatedAt: new Date().toISOString(), status: 'UNAVAILABLE',
      dataStale: true, lastError: errors.join('; '), spx: null, smh: null, nvda: null, vix: null,
      credit: null, mechanicalTally: null, episodeClass: 'UNKNOWN',
    }, null, 2));
    console.log(`episode-state: UNAVAILABLE (${errors.join('; ')})`);
    return;
  }

  // Credit: current HY OAS from the live adapter's committed state.
  const liveState = readJson('data/report-state.live.json', {});
  const hy = (liveState.liveRatesCredit || []).find(r => r.id === 'BAMLH0A0HYM2');
  const hyOas = Number.isFinite(hy?.value) ? hy.value : null;
  let hyChange5d = null;
  const creditCache = readJson('data/cache/credit-series.json', null);
  const series = creditCache?.sources?.BAMLH0A0HYM2?.observations || creditCache?.sources?.BAMLH0A0HYM2?.series || null;
  if (Array.isArray(series) && series.length > 5 && hyOas != null) {
    const vals = series.map(o => Number(o.value ?? o.v)).filter(Number.isFinite);
    if (vals.length > 5) hyChange5d = round(hyOas - vals[vals.length - 6]);
  }
  const th = cfg.thresholds;
  const creditCalm = hyOas != null && hyOas < th.hyOasCrackLevel && (hyChange5d == null || hyChange5d < th.hyOasCrackWidening5d);
  const creditCracking = hyOas != null && (hyOas >= th.hyOasCrackLevel || (hyChange5d != null && hyChange5d >= th.hyOasCrackWidening5d));

  // VIX behavior: spike-and-rollover over the last 5 settled bars.
  let vixBlock = null;
  if (data['^VIX']) {
    const vb = data['^VIX'].bars; const vLast = vb[vb.length - 1];
    const high5 = Math.max(...vb.slice(-5).map(b => b.close));
    vixBlock = { ...data['^VIX'].summary, high5d: round(high5), spikeRollover: high5 >= 25 && vLast.close < high5 * 0.92 };
  }

  // Mechanical capitulation subset (the bottom watch's fuller tally includes
  // judgment signals; this is only what prices/volume/credit can prove).
  const smh = data['SMH'].summary; const smhBar = data['SMH'].lastBar;
  const volMultiple = smh.avgVolume20 && smh.lastVolume ? smh.lastVolume / smh.avgVolume20 : null;
  const rangePos = smhBar && smhBar.high > smhBar.low ? (smhBar.close - smhBar.low) / (smhBar.high - smhBar.low) : null;
  const reversal = (smh.dayChangePct != null && smh.dayChangePct > 0) || (rangePos != null && rangePos >= 0.5);
  const signals = [
    { id: 'zone_occupancy', label: 'AI complex inside a buy zone (SMH or NVDA in Zone 1/2)',
      confirmed: ['ZONE_1', 'ZONE_2'].includes(smh.zone) || ['ZONE_1', 'ZONE_2'].includes(data['NVDA']?.summary.zone || ''),
      detail: `SMH ${smh.zone}, NVDA ${data['NVDA']?.summary.zone || 'n/a'}` },
    { id: 'volume_climax_reversal', label: 'SMH volume climax with intraday reversal',
      confirmed: volMultiple != null && volMultiple >= th.volumeClimaxMultiple && reversal,
      detail: volMultiple != null ? `volume ${volMultiple.toFixed(2)}x 20d avg; close in ${rangePos != null ? Math.round(rangePos * 100) + '% of range' : 'n/a'}` : 'volume unavailable' },
    { id: 'vix_rollover', label: 'VIX spiked and is rolling over',
      confirmed: Boolean(vixBlock?.spikeRollover),
      detail: vixBlock ? `VIX ${vixBlock.close}, 5d high ${vixBlock.high5d}` : 'VIX unavailable' },
    { id: 'credit_calm', label: 'Credit not cracking (HY OAS contained)',
      confirmed: creditCalm,
      detail: hyOas != null ? `HY OAS ${hyOas}${hyChange5d != null ? `, 5d change ${hyChange5d > 0 ? '+' : ''}${hyChange5d}` : ''}` : 'HY OAS unavailable' },
  ];
  const tally = { confirmed: signals.filter(s => s.confirmed).length, of: signals.length, signals };

  // Episode classification — mechanical, thresholds from config. Two axes:
  // the index (SPX drawdown bands) and the AI complex (SMH drawdown bands).
  // A complex-only selloff is a real episode even when the index looks calm —
  // that divergence is the whole point of tracking it — but REGIME_BREAK
  // still requires the index AND credit to break together.
  const spx = data['^GSPC'].summary;
  const axisClass = dd => (dd <= th.correctionDrawdownPct ? 'CORRECTION' : dd <= th.digestionDrawdownPct ? 'DIGESTION' : 'NONE');
  const complexClass = dd => (dd <= -22 ? 'CORRECTION' : dd <= -12 ? 'DIGESTION' : 'NONE');
  const rank = { NONE: 0, DIGESTION: 1, CORRECTION: 2, REGIME_BREAK: 3 };
  let episodeClass = [axisClass(spx.drawdownFromHighPct), complexClass(smh.drawdownFromHighPct)]
    .sort((a, b) => rank[b] - rank[a])[0];
  if (smh.zone === 'ZONE_1' && rank[episodeClass] < rank.DIGESTION) episodeClass = 'DIGESTION';
  if (smh.zone === 'ZONE_2' || smh.zone === 'BELOW_ZONE_2') episodeClass = 'CORRECTION';
  if (spx.drawdownFromHighPct <= th.regimeBreakDrawdownPct || (spx.pctVsSma200 != null && spx.pctVsSma200 < 0 && creditCracking)) episodeClass = 'REGIME_BREAK';

  const out = {
    artifact: 'episode-state',
    generatedAt: new Date().toISOString(),
    dataThrough: spx.date,
    status: errors.length ? 'PARTIAL' : 'OK',
    dataStale: false,
    ...(errors.length ? { fetchErrors: errors } : {}),
    spx, smh, nvda: data['NVDA']?.summary || null, vix: vixBlock,
    credit: { hyOas, change5d: hyChange5d, calm: creditCalm, cracking: creditCracking },
    failureZone: cfg.failureZone,
    mechanicalTally: tally,
    episodeClass,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`episode-state: ${out.status} class=${episodeClass} spxDD=${spx.drawdownFromHighPct}% smhZone=${smh.zone} tally=${tally.confirmed}/${tally.of} through ${spx.date}`);
}

main().catch(e => {
  // Last-resort guard: this generator must never take the lane down.
  console.error('episode-state: unexpected error, writing UNAVAILABLE skeleton:', e.message);
  try {
    fs.writeFileSync(outPath, JSON.stringify({ artifact: 'episode-state', generatedAt: new Date().toISOString(), status: 'UNAVAILABLE', dataStale: true, lastError: e.message, spx: null, smh: null, nvda: null, vix: null, credit: null, mechanicalTally: null, episodeClass: 'UNKNOWN' }, null, 2));
  } catch { /* nothing more to do */ }
  process.exit(0);
});
