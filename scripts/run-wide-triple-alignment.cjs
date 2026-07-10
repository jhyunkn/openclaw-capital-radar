'use strict';
// Wide triple-alignment: score the ENTIRE discovery universe (both scan tracks),
// with point values CALIBRATED to measured history instead of hand-set weights.
//
// Method:
//  1. Fetch 1y daily closes for every discovery ticker (Yahoo v8, cached).
//  2. Calibrate: compute features as of T0 (~126 trading days ago) and the
//     forward 6-month return; derive empirical win-rates per feature bucket.
//  3. Score today's features with those calibrated points. Macro lens = the
//     name's measured resilience through the June 2026 hawkish-repricing shock
//     (fits the plateau-rates regime thesis: no zero-rate rescue coming).
//  4. Deep-verify top finalists against SEC XBRL revenue (hard reject declining).
//
// Expensive (~360 Yahoo fetches) — run from sessions, not the 4h loop.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const UA = 'OpenClaw Capital Radar (public Yahoo Finance endpoint)';

function read(f) { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } }
function write(f, d) { const p = path.join(root, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }
const rnd = (v, d = 1) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

// ---------- universe ----------
const ETF_PATTERN = /^(GLD|IAU|SLV|SIVR|SPY|QQQ|IWM|SOX|XL[A-Z]|VOO|VTI|DIA|EEM|EFA|AGG|TLT|HYG|LQD|GDX|GDXJ|URA|ARKK?)/;
const scanA = read('data/discovery/scan-track-a.json')?.results || [];
const scanB = read('data/discovery/scan-track-b.json')?.results || [];
const meta = {};
for (const [track, rows] of [['A', scanA], ['B', scanB]]) {
  for (const r of rows) {
    if (!r.ticker || ETF_PATTERN.test(r.ticker) || r.ticker.includes('.')) continue;
    const c = r.columns || {};
    meta[r.ticker] = meta[r.ticker] || {
      name: c['Name'] || r.ticker, track,
      gm: Number(c['Gross margin']) || null, om: Number(c['Operating margin']) || null,
      capB: rnd((Number(c['Market cap']) || 0) / 1e9),
    };
  }
}
const tickers = Object.keys(meta);

// ---------- price history ----------
const CACHE = 'data/cache/wide-scan-price-history.json';
async function fetchCloses(t) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1y&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = (await res.json())?.chart?.result?.[0];
  const q = result?.indicators?.quote?.[0] || {};
  const ts = result?.timestamp || [];
  const rows = ts.map((s, i) => ({ d: s, c: q.close?.[i] })).filter(r => Number.isFinite(r.c));
  return rows;
}
async function loadHistory() {
  const cache = read(CACHE) || { fetchedAt: null, series: {} };
  const ageH = cache.fetchedAt ? (Date.now() - new Date(cache.fetchedAt).getTime()) / 3600000 : 1e9;
  const missing = tickers.filter(t => !cache.series[t]);
  const targets = ageH > 20 ? tickers : missing;
  if (targets.length) {
    console.log(`fetching history for ${targets.length} tickers...`);
    let done = 0, failed = 0;
    const queue = [...targets];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const t = queue.shift();
        try { cache.series[t] = await fetchCloses(t); } catch { failed++; }
        if (++done % 60 === 0) console.log(`  ${done}/${targets.length}`);
        await new Promise(r => setTimeout(r, 120));
      }
    }));
    cache.fetchedAt = new Date().toISOString();
    write(CACHE, cache);
    console.log(`history done (${failed} failed)`);
  }
  return cache.series;
}

// ---------- features ----------
function rsi(closes, n = 14) {
  if (closes.length <= n) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return 100 - 100 / (1 + g / Math.max(l, 1e-9));
}
function featuresAt(closes, idx) {
  const upto = closes.slice(0, idx + 1);
  if (upto.length < 40) return null;
  const px = upto[upto.length - 1];
  const high = Math.max(...upto);
  return {
    rsi: rsi(upto.slice(-120)),
    fromHigh: (px / high - 1) * 100,
    trend21: upto.length > 21 ? (px / upto[upto.length - 22] - 1) * 100 : null,
  };
}
const RSI_BUCKETS = [[0, 35], [35, 45], [45, 55], [55, 65], [65, 101]];
const DIS_BUCKETS = [[-100, -35], [-35, -20], [-20, -10], [-10, 0.01]];
const bucketOf = (v, bs) => bs.findIndex(([a, b]) => v >= a && v < b);

// ---------- main ----------
(async () => {
  const series = await loadHistory();
  const rows = [];
  for (const t of tickers) {
    const s = (series[t] || []).map(r => r.c);
    const dates = (series[t] || []).map(r => r.d);
    if (s.length < 160) continue;
    const t0 = s.length - 127;                       // ~6 months ago
    const f0 = featuresAt(s, t0);
    const fNow = featuresAt(s, s.length - 1);
    if (!f0 || !fNow) continue;
    const fwd = (s[s.length - 1] / s[t0] - 1) * 100; // forward 6m return from T0
    // Hawkish-shock resilience: return over Jun 1 -> Jun 24 2026 (the repricing flush)
    const jun1 = dates.findIndex(d => d >= 1780272000);   // 2026-06-01
    const jun24 = dates.findIndex(d => d >= 1782259200);  // 2026-06-24
    const shock = jun1 > 0 && jun24 > jun1 ? (s[jun24] / s[jun1] - 1) * 100 : null;
    rows.push({ ticker: t, ...meta[t], f0, fNow, fwd, shock });
  }
  console.log(`${rows.length} tickers with full history`);

  // ---- calibration: empirical win rate + median forward return per bucket ----
  function calibrate(rowsIn, featureFn, buckets) {
    const stats = buckets.map(() => ({ n: 0, wins: 0, rets: [] }));
    for (const r of rowsIn) {
      const v = featureFn(r);
      if (v == null) continue;
      const b = bucketOf(v, buckets);
      if (b < 0) continue;
      stats[b].n++; if (r.fwd > 0) stats[b].wins++; stats[b].rets.push(r.fwd);
    }
    return stats.map((s, i) => ({
      bucket: buckets[i], n: s.n,
      win_rate: s.n ? rnd(s.wins / s.n * 100) : null,
      median_fwd: s.n ? rnd(s.rets.sort((a, b) => a - b)[Math.floor(s.rets.length / 2)]) : null,
    }));
  }
  const calRSI = calibrate(rows, r => r.f0.rsi, RSI_BUCKETS);
  const calDIS = calibrate(rows, r => r.f0.fromHigh, DIS_BUCKETS);
  const calGM = calibrate(rows, r => (r.gm ?? null) && r.gm * 100, [[0, 45], [45, 60], [60, 101]]);
  const calOM = calibrate(rows, r => (r.om ?? null) && r.om * 100, [[0, 10], [10, 25], [25, 101]]);

  // points = (win_rate - 50) scaled; empirical, sign included
  const pts = cal => cal.map(c => c.win_rate == null ? 0 : rnd((c.win_rate - 50) * 0.6));
  const P = { rsi: pts(calRSI), dis: pts(calDIS), gm: pts(calGM), om: pts(calOM) };

  // shock resilience percentile (macro lens for the plateau-rates regime)
  const shocks = rows.map(r => r.shock).filter(Number.isFinite).sort((a, b) => a - b);
  const shockPct = v => Number.isFinite(v) ? rnd(shocks.filter(x => x <= v).length / shocks.length * 100) : null;

  // ---- score today ----
  for (const r of rows) {
    const bR = bucketOf(r.fNow.rsi, RSI_BUCKETS);
    const bD = bucketOf(r.fNow.fromHigh, DIS_BUCKETS);
    const bG = r.gm != null ? bucketOf(r.gm * 100, [[0, 45], [45, 60], [60, 101]]) : -1;
    const bO = r.om != null ? bucketOf(r.om * 100, [[0, 10], [10, 25], [25, 101]]) : -1;
    const sp = shockPct(r.shock);
    const macroPts = sp != null ? rnd((sp - 50) * 0.24) : 0; // resilience percentile -> +-12
    r.scores = {
      momentum_rsi: bR >= 0 ? P.rsi[bR] : 0,
      momentum_dislocation: bD >= 0 ? P.dis[bD] : 0,
      quality_gm: bG >= 0 ? P.gm[bG] : 0,
      quality_om: bO >= 0 ? P.om[bO] : 0,
      macro_shock_resilience: macroPts,
    };
    r.total = rnd(Object.values(r.scores).reduce((a, b) => a + b, 0));
    // calibrated probability estimate: mean of the bucket win rates this name sits in
    const wrs = [bR >= 0 ? calRSI[bR].win_rate : null, bD >= 0 ? calDIS[bD].win_rate : null, bG >= 0 ? calGM[bG].win_rate : null].filter(v => v != null);
    r.p_positive_6m = wrs.length ? rnd(wrs.reduce((a, b) => a + b, 0) / wrs.length) : null;
    r.shock_resilience_pct = sp;
  }
  rows.sort((a, b) => b.total - a.total);

  // ---- deep verify finalists via SEC XBRL ----
  const cikCache = read('outputs/cache/sec-company-tickers.json');
  const cikOf = {};
  for (const [t, v] of Object.entries(cikCache?.map || {})) {
    if (v?.cik) cikOf[t.toUpperCase()] = String(v.cik).padStart(10, '0');
  }
  async function revYoY(t) {
    const cik = cikOf[t];
    if (!cik) return { ok: false, note: 'no CIK (possibly foreign filer)' };
    try {
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: { 'user-agent': 'OpenClaw Capital Radar research jun.hn.nam@gmail.com' } });
      if (!res.ok) return { ok: false, note: `SEC ${res.status}` };
      const facts = (await res.json())?.facts?.['us-gaap'] || {};
      const concept = facts.RevenueFromContractWithCustomerExcludingAssessedTax || facts.Revenues || facts.SalesRevenueNet;
      const units = concept?.units?.USD || [];
      const q = units.filter(u => u.form === '10-Q' || u.form === '10-K').filter(u => { const days = (new Date(u.end) - new Date(u.start)) / 86400000; return days > 60 && days < 120; });
      q.sort((a, b) => a.end.localeCompare(b.end));
      if (q.length < 5) return { ok: false, note: 'insufficient quarterly data' };
      const last = q[q.length - 1], prior = q.find(u => Math.abs((new Date(u.end) - new Date(last.end)) / 86400000 + 365) < 25);
      if (!prior) return { ok: false, note: 'no YoY comparable' };
      return { ok: true, yoy: rnd((last.val / prior.val - 1) * 100), latest_q: last.end };
    } catch (e) { return { ok: false, note: String(e.message || e).slice(0, 60) }; }
  }
  const FINALISTS = 15;
  console.log(`SEC-verifying top ${FINALISTS}...`);
  for (const r of rows.slice(0, FINALISTS)) {
    r.sec = await revYoY(r.ticker);
    if (r.sec.ok && r.sec.yoy < 0) r.hard_reject = 'revenue declining YoY (SEC-verified)';
    await new Promise(res => setTimeout(res, 150));
  }
  const final = rows.slice(0, FINALISTS).filter(r => !r.hard_reject);

  const state = {
    artifact: 'wide-alignment-scan', version: 1, generatedAt: new Date().toISOString(),
    universe: rows.length, method: 'calibrated bucket win-rates (T0=~126 trading days ago, fwd 6m) + Jun-2026 hawkish-shock resilience as macro lens',
    regime_thesis: 'Plateau rates ~3-3.5%, no zero-rate rescue, adjustment risk elevated — resilience and current cash generation weighted by measured behavior, not judgment',
    honest_limits: ['single 6m calibration window, in-sample', 'universe survivorship (current scan members)', 'quality lens = margins + SEC revenue for finalists only; no FCF/balance-sheet depth yet'],
    calibration: { rsi_at_t0: calRSI, dislocation_at_t0: calDIS, gross_margin: calGM, operating_margin: calOM, points_scale: '(win_rate - 50) x 0.6 per bucket; macro = (shock-resilience percentile - 50) x 0.24' },
    finalists: final.map(r => ({ ticker: r.ticker, name: r.name, track: r.track, total: r.total, p_positive_6m: r.p_positive_6m, scores: r.scores, rsi: rnd(r.fNow.rsi), from_high_pct: rnd(r.fNow.fromHigh), shock_resilience_pct: r.shock_resilience_pct, cap_b: r.capB, sec: r.sec }))
      .concat(rows.slice(0, FINALISTS).filter(r => r.hard_reject).map(r => ({ ticker: r.ticker, hard_reject: r.hard_reject }))),
    top_50: rows.slice(0, 50).map(r => ({ ticker: r.ticker, total: r.total, p: r.p_positive_6m })),
  };
  write('outputs/wide-alignment-scan.json', state);
  write('public/outputs/wide-alignment-scan.json', state);
  console.log('\n=== calibration (RSI@T0 -> fwd 6m win rate) ===');
  calRSI.forEach((c, i) => console.log(`RSI ${RSI_BUCKETS[i]}: n=${c.n} win=${c.win_rate}% med=${c.median_fwd}%`));
  calDIS.forEach((c, i) => console.log(`FromHigh ${DIS_BUCKETS[i]}: n=${c.n} win=${c.win_rate}% med=${c.median_fwd}%`));
  console.log('\n=== finalists ===');
  final.forEach(r => console.log(`${r.ticker.padEnd(6)} total:${r.total} p6m:${r.p_positive_6m}% rsi:${rnd(r.fNow.rsi)} fromHigh:${rnd(r.fNow.fromHigh)}% shock:${r.shock_resilience_pct}pct rev:${r.sec?.ok ? r.sec.yoy + '%' : r.sec?.note}`));
})();
