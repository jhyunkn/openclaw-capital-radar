'use strict';
// Cycle Watch — state generator.
// Reads data/cycle-watch-history.json + data/cycle-thesis.json and writes
// outputs/cycle-watch-state.json: per-signal current value, 1d delta, 30d
// spark data, distance to tripwire, status (calm/watch/tripped/stale), and
// consecutive-day counters. Runs inside the scheduled refresh loop — no
// human or agent step. Never throws: worst case it writes all-STALE.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel, fb = null) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; } };
function write(rel, data) {
  for (const dir of ['outputs', 'public/outputs']) {
    const p = path.join(root, dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  }
}
const r2 = v => (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(2)) : null;
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

function sparkOf(snaps, key, n = 30) {
  return snaps.slice(-n).map(s => num(s[key]));
}

function evalStatus(history, key, evaluate) {
  // Walk back from latest while evaluate() returns watch/tripped → streak count.
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const st = evaluate(history[i], history.slice(0, i + 1));
    if (st === 'watch' || st === 'tripped') streak++; else break;
  }
  return streak;
}

function main() {
  const asOf = new Date().toISOString();
  let state;
  try {
    state = build(asOf);
  } catch (e) {
    console.warn('[cycle-watch] generator error (all-stale fallback):', e.message);
    state = { artifact: 'cycle-watch-state', asOf, stale_all: true, signals: [], thesis: null, error: String(e && e.message || e) };
  }
  write('cycle-watch-state.json', state);
  console.log(`[cycle-watch] state written: ${state.signals ? state.signals.length : 0} signals, asOf ${asOf}`);
}

function build(asOf) {
  const hist = read('data/cycle-watch-history.json', null);
  const thesis = read('data/cycle-thesis.json', null);
  const snaps = hist && Array.isArray(hist.snapshots) ? hist.snapshots : [];
  const latest = snaps[snaps.length - 1] || null;
  const prev = snaps[snaps.length - 2] || null;
  const latestAgeDays = latest ? (Date.now() - new Date(latest.date + 'T23:59:59Z').getTime()) / 864e5 : Infinity;
  const feedStale = !latest || latestAgeDays > 3;

  const delta = (k) => (latest && prev && num(latest[k]) != null && num(prev[k]) != null) ? r2(latest[k] - prev[k]) : null;
  const staleChip = (value) => (feedStale || value == null) ? 'stale' : null;

  const defs = [
    {
      id: 'spx_200d', name: 'S&P 500 vs 200-day', unit: '%',
      value: latest ? latest.spx_vs_200d_pct : null,
      display: latest && num(latest.spx_vs_200d_pct) != null
        ? `${latest.spx_vs_200d_pct >= 0 ? '+' : ''}${latest.spx_vs_200d_pct.toFixed(1)}% ${latest.spx_vs_200d_pct >= 0 ? 'above' : 'below'}`
        : null,
      sub: latest && num(latest.spx_close) != null && num(latest.spx_ma200) != null
        ? `${Math.round(latest.spx_close).toLocaleString('en-US')} vs ${Math.round(latest.spx_ma200).toLocaleString('en-US')}` : null,
      delta1d: delta('spx_vs_200d_pct'),
      spark: sparkOf(snaps, 'spx_vs_200d_pct'),
      tripwire: 'Daily close below 200D',
      distance: latest && num(latest.spx_vs_200d_pct) != null
        ? (latest.spx_vs_200d_pct >= 0 ? `${latest.spx_vs_200d_pct.toFixed(1)}% of clearance` : `${Math.abs(latest.spx_vs_200d_pct).toFixed(1)}% BELOW — broken`) : null,
      evaluate: (s) => num(s.spx_close) != null && num(s.spx_ma200) != null && s.spx_close < s.spx_ma200 ? 'tripped'
        : (num(s.spx_vs_200d_pct) != null && s.spx_vs_200d_pct >= 0 && s.spx_vs_200d_pct <= 3 ? 'watch' : 'calm'),
    },
    {
      id: 'vix', name: 'VIX', unit: '',
      value: latest ? latest.vix : null,
      display: latest && num(latest.vix) != null ? latest.vix.toFixed(2) : null,
      sub: 'complacency gauge', delta1d: delta('vix'),
      spark: sparkOf(snaps, 'vix'),
      tripwire: '> 25 = watch · spike + 200D break = tripped',
      distance: latest && num(latest.vix) != null ? `${r2(25 - latest.vix)} pts below 25` : null,
      evaluate: (s, h) => {
        const spxBroken = num(s.spx_close) != null && num(s.spx_ma200) != null && s.spx_close < s.spx_ma200;
        if (num(s.vix) != null && s.vix > 25 && spxBroken) return 'tripped';
        if (num(s.vix) != null && s.vix > 25) return 'watch';
        return 'calm';
      },
    },
    {
      id: 'us10y', name: '10Y Treasury', unit: '%',
      value: latest ? latest.us10y : null,
      display: latest && num(latest.us10y) != null ? latest.us10y.toFixed(2) + '%' : null,
      sub: 'term-premium revolt watch', delta1d: delta('us10y'),
      spark: sparkOf(snaps, 'us10y'),
      tripwire: 'New 30d high = watch',
      distance: (() => {
        const vals = sparkOf(snaps, 'us10y').filter(v => v != null);
        if (!vals.length || latest == null || num(latest.us10y) == null) return null;
        const hi = Math.max(...vals);
        return latest.us10y >= hi ? 'AT 30d high' : `${r2(hi - latest.us10y)}% below 30d high ${hi.toFixed(2)}%`;
      })(),
      evaluate: (s, h) => {
        const vals = h.map(x => num(x.us10y)).filter(v => v != null).slice(-30);
        if (!vals.length || num(s.us10y) == null) return 'calm';
        return s.us10y >= Math.max(...vals) ? 'watch' : 'calm';
      },
    },
    {
      id: 'credit_proxy', name: 'Credit — HYG/LQD', unit: '%', proxy: true,
      value: latest ? latest.hyg_lqd_vs_ma50_pct : null,
      display: latest && num(latest.hyg_lqd_vs_ma50_pct) != null
        ? `${latest.hyg_lqd_vs_ma50_pct >= 0 ? '+' : ''}${latest.hyg_lqd_vs_ma50_pct.toFixed(2)}% vs 50d avg` : null,
      sub: 'PROXY for HY spreads (FRED down)', delta1d: delta('hyg_lqd_vs_ma50_pct'),
      spark: sparkOf(snaps, 'hyg_lqd_vs_ma50_pct'),
      tripwire: '−1% = watch · −2.5% = tripped',
      distance: latest && num(latest.hyg_lqd_vs_ma50_pct) != null
        ? `${r2(latest.hyg_lqd_vs_ma50_pct + 1)}% above watch line` : null,
      evaluate: (s) => num(s.hyg_lqd_vs_ma50_pct) == null ? 'calm'
        : s.hyg_lqd_vs_ma50_pct <= -2.5 ? 'tripped' : s.hyg_lqd_vs_ma50_pct <= -1 ? 'watch' : 'calm',
    },
    {
      id: 'breadth_proxy', name: 'Breadth — RSP/SPY', unit: '%', proxy: true,
      value: latest ? latest.rsp_spy_30d_pct : null,
      display: latest && num(latest.rsp_spy_30d_pct) != null
        ? `${latest.rsp_spy_30d_pct >= 0 ? '+' : ''}${latest.rsp_spy_30d_pct.toFixed(2)}% / 30d` : null,
      sub: 'PROXY for % above 50dma', delta1d: delta('rsp_spy_30d_pct'),
      spark: sparkOf(snaps, 'rsp_spy_30d_pct'),
      tripwire: 'New 30d low = watch',
      distance: (() => {
        const vals = sparkOf(snaps, 'rsp_spy_ratio').filter(v => v != null);
        if (!vals.length || latest == null || num(latest.rsp_spy_ratio) == null) return null;
        const lo = Math.min(...vals);
        return latest.rsp_spy_ratio <= lo ? 'AT 30d low' : `${((latest.rsp_spy_ratio / lo - 1) * 100).toFixed(2)}% above 30d low`;
      })(),
      evaluate: (s, h) => {
        const vals = h.map(x => num(x.rsp_spy_ratio)).filter(v => v != null).slice(-30);
        if (!vals.length || num(s.rsp_spy_ratio) == null) return 'calm';
        return s.rsp_spy_ratio <= Math.min(...vals) ? 'watch' : 'calm';
      },
    },
    {
      id: 'mag7_gap', name: 'Mag7 divergence gap', unit: 'pts',
      value: latest ? latest.mag7_gap_pts : null,
      display: latest && num(latest.mag7_gap_pts) != null ? latest.mag7_gap_pts.toFixed(2) + ' pts' : null,
      sub: 'SPY vs avg Mag7 % off 1y high', delta1d: delta('mag7_gap_pts'),
      spark: sparkOf(snaps, 'mag7_gap_pts'),
      tripwire: '> 12 pts = watch (rollover risk)',
      distance: latest && num(latest.mag7_gap_pts) != null ? `${r2(12 - latest.mag7_gap_pts)} pts below 12` : null,
      evaluate: (s) => num(s.mag7_gap_pts) != null && s.mag7_gap_pts > 12 ? 'watch' : 'calm',
    },
  ];

  const signals = defs.map(d => {
    const raw = d.evaluate(latest || {}, snaps);
    const stale = staleChip(d.value);
    return {
      id: d.id, name: d.name, unit: d.unit, proxy: !!d.proxy,
      value: d.value, display: d.display, sub: d.sub,
      delta_1d: d.delta1d,
      spark_30d: d.spark,
      tripwire: d.tripwire, distance: d.distance,
      status: stale || raw,
      streak_days: stale ? 0 : evalStatus(snaps, d.id, d.evaluate),
      as_of_date: latest ? latest.date : null,
    };
  });

  return {
    artifact: 'cycle-watch-state',
    asOf,
    data_through: latest ? latest.date : null,
    feed_stale: feedStale,
    history_snapshots: snaps.length,
    thesis: thesis ? {
      read: thesis.read,
      exceptions: thesis.exceptions,
      analogs: thesis.analogs,
      updated: thesis.updated,
    } : null,
    signals,
  };
}

main();
