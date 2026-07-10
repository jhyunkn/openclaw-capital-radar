'use strict';
// Tests the standing macro thesis against long history instead of trusting it.
// Thesis under test (framework current_regime_read.jun_thesis):
//   "2008-shape adjustment coming; rates plateau ~3-3.5%, no zero-rate rescue."
// Evidence examined, mathematically:
//   1. Yield-curve re-steepening after deep inversion -> forward SPX drawdowns
//      (the classic pre-recession sequence: 2000, 2007)
//   2. HY credit spread level -> forward 12m SPX returns (tight spreads = time
//      still on the clock historically?)
//   3. Fed plateau episodes (rates held after hiking) -> what followed
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = (f, d) => fs.writeFileSync(path.join(root, f), JSON.stringify(d, null, 2) + '\n');
const rnd = (v, d = 1) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

async function fredCsv(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=1954-01-01`, { headers: { 'user-agent': 'OpenClaw Capital Radar research' } });
  if (!res.ok) throw new Error(`FRED ${id} ${res.status}`);
  const text = await res.text();
  return text.split('\n').slice(1).map(l => {
    const [d, v] = l.split(',');
    const n = Number(v);
    return d && Number.isFinite(n) ? { d, v: n } : null;
  }).filter(Boolean);
}
async function yahooMax(sym) {
  // daily bars for full depth, downsampled to month-start; forward math is in months
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=0&period2=${Math.floor(Date.now()/1000)}&interval=1mo`, { headers: { 'user-agent': 'OpenClaw Capital Radar (public endpoint)', accept: 'application/json' } });
  const r = (await res.json())?.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] || {};
  return (r?.timestamp || []).map((s, i) => ({ d: new Date(s * 1000).toISOString().slice(0, 10), v: q.close?.[i] })).filter(x => Number.isFinite(x.v));
}

(async () => {
  console.log('fetching long history: T10Y2Y, HY OAS, Fed funds, SPX...');
  const [curve, hy, ff, spx] = await Promise.all([
    fredCsv('T10Y2Y'), fredCsv('BAA10Y'), fredCsv('DFF'), yahooMax('^GSPC'),
  ]);
  console.log(`curve ${curve.length} rows since ${curve[0].d} | HY ${hy.length} since ${hy[0].d} | SPX ${spx.length} since ${spx[0].d}`);
  const spxDates = spx.map(r => r.d);
  function spxAtOrAfter(d) {
    if (d < spxDates[0]) return null; // before series start — no lookalike joins
    const i = spxDates.findIndex(x => x >= d);
    return i >= 0 ? { i, v: spx[i].v } : null;
  }
  // months, using monthly bars
  function fwdReturn(d, months) {
    const a = spxAtOrAfter(d);
    if (!a || a.i + months >= spx.length) return null;
    return (spx[a.i + months].v / a.v - 1) * 100;
  }
  function maxDrawdownAfter(d, months) {
    const a = spxAtOrAfter(d);
    if (!a) return null;
    const seg = spx.slice(a.i, Math.min(a.i + months, spx.length)).map(r => r.v);
    if (seg.length < 3) return null;
    let peak = seg[0], mdd = 0;
    for (const v of seg) { peak = Math.max(peak, v); mdd = Math.min(mdd, (v / peak - 1) * 100); }
    return mdd;
  }

  // --- 1. re-steepening after deep inversion ---
  // Episode = curve was inverted below -0.25 for >60 obs, then crosses back above +0.25.
  const episodes = [];
  let invCount = 0;
  for (let i = 1; i < curve.length; i++) {
    if (curve[i].v < -0.25) invCount++;
    if (curve[i].v > 0.25 && curve[i - 1].v <= 0.25) {
      if (invCount > 60) episodes.push(curve[i].d);
      invCount = 0;
    }
    if (curve[i].v > 0.5) invCount = 0;
  }
  const steepening = episodes.map(d => ({
    resteepened: d,
    spx_fwd_6m: rnd(fwdReturn(d, 6)),
    spx_fwd_12m: rnd(fwdReturn(d, 12)),
    max_drawdown_18m: rnd(maxDrawdownAfter(d, 18)),
  }));

  // --- 2. HY OAS level buckets vs forward 12m SPX (monthly samples) ---
  const hyBuckets = [[0, 2], [2, 2.5], [2.5, 3.5], [3.5, 100]]; // Baa-10Y spread
  const hyStats = hyBuckets.map(() => ({ n: 0, rets: [], mdds: [] }));
  for (let i = 0; i < hy.length; i += 21) {
    const b = hyBuckets.findIndex(([a, z]) => hy[i].v >= a && hy[i].v < z);
    const fr = fwdReturn(hy[i].d, 12);
    const mdd = maxDrawdownAfter(hy[i].d, 12);
    if (b >= 0 && fr != null) { hyStats[b].n++; hyStats[b].rets.push(fr); if (mdd != null) hyStats[b].mdds.push(mdd); }
  }
  const med = a => a.length ? rnd(a.sort((x, y) => x - y)[Math.floor(a.length / 2)]) : null;
  const hyTable = hyStats.map((s, i) => ({
    baa10y_spread: hyBuckets[i], n_months: s.n,
    median_fwd_12m: med(s.rets),
    pct_negative_12m: s.n ? rnd(s.rets.filter(r => r < 0).length / s.n * 100) : null,
    median_max_drawdown_12m: med(s.mdds),
  }));

  // --- 3. Fed plateau episodes: DFF stable within 25bp for 6m after >100bp hike in prior 18m ---
  const ffM = ff.filter((_, i) => i % 21 === 0);
  const plateaus = [];
  for (let i = 26; i < ffM.length - 6; i++) {
    const hiked = ffM[i].v - ffM[i - 18].v > 1.0;
    const flat6 = Math.abs(ffM[i].v - ffM[i - 6].v) < 0.25;
    const wasFlat = plateaus.length && (new Date(ffM[i].d) - new Date(plateaus[plateaus.length - 1].start)) < 500 * 86400000;
    if (hiked && flat6 && !wasFlat) plateaus.push({ start: ffM[i].d, rate: rnd(ffM[i].v, 2) });
  }
  const plateauTable = plateaus.map(p => ({
    plateau_from: p.start, fed_funds: p.rate,
    spx_fwd_12m: rnd(fwdReturn(p.start, 12)),
    max_drawdown_18m: rnd(maxDrawdownAfter(p.start, 18)),
  }));

  const current = {
    curve_now: curve[curve.length - 1],
    hy_now: hy[hy.length - 1],
    ff_now: ff[ff.length - 1],
  };
  const state = {
    artifact: 'macro-thesis-test', generatedAt: new Date().toISOString(),
    thesis_under_test: '2008-shape adjustment coming; rates plateau ~3-3.5%, no zero-rate rescue',
    current,
    test_1_resteepening_after_inversion: steepening,
    test_2_baa10y_spread_vs_forward: hyTable,
    test_3_fed_plateau_episodes: plateauTable,
    note: 'All computed from FRED (T10Y2Y, BAA10Y, DFF) and Yahoo ^GSPC full daily history (downsampled monthly) at run time. HY OAS unavailable long-range (ICE licensing) — Baa-10Y is the unrestricted long-history credit spread.',
  };
  write('outputs/macro-thesis-test.json', state);
  console.log('\n=== 1. curve re-steepened after deep inversion ===');
  steepening.forEach(e => console.log(`${e.resteepened}: fwd6m ${e.spx_fwd_6m}% fwd12m ${e.spx_fwd_12m}% maxDD18m ${e.max_drawdown_18m}%`));
  console.log('\n=== 2. Baa-10Y credit spread -> fwd 12m SPX (monthly obs since 1986) ===');
  hyTable.forEach(h => console.log(`Baa10Y ${h.baa10y_spread}: n=${h.n_months} medFwd12m=${h.median_fwd_12m}% pctNeg=${h.pct_negative_12m}% medMaxDD=${h.median_max_drawdown_12m}%`));
  console.log('\n=== 3. Fed plateau after >100bp hikes ===');
  plateauTable.forEach(p => console.log(`${p.plateau_from} @ ${p.fed_funds}%: fwd12m ${p.spx_fwd_12m}% maxDD18m ${p.max_drawdown_18m}%`));
  console.log(`\nNOW: curve ${current.curve_now.v} | HY OAS ${current.hy_now.v} | FF ${current.ff_now.v}`);
})();
