'use strict';
// Cycle Watch — daily data lens.
// Fetches Yahoo daily bars for the late-D/distribution tripwire set, computes a
// per-trading-day snapshot, and appends it to data/cycle-watch-history.json.
// - Backfills the last 60 trading days on first run (one-time).
// - Dedupes by trading date: never double-appends.
// - SETTLED BARS ONLY: Yahoo's chart API returns the in-progress day's bar
//   with close = latest intraday print. A run during market hours (e.g. the
//   2026-10-16 10:37 ET manual refresh) used to append that partial bar as
//   the day's "close" — stamping SPX 7,733.01 / VIX 15.97 for a day that
//   actually closed 7,659.44 / 19.99 — and dedupe locked the error in
//   forever. Bars are now filtered to settled closes (date before today ET,
//   or today after a 16:15 ET settle buffer), snapshots dated after the
//   latest settled bar are pruned, and the latest settled snapshot is
//   recomputed on every run so a partial capture self-heals once the bar
//   settles.
// - NEVER depends on FRED. Credit/breadth use labeled Yahoo proxies.
// - Fail-soft: on fetch failure it logs and exits 0 WITHOUT appending, so the
//   build never breaks; generate-cycle-watch-state.cjs marks signals STALE.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const HISTORY_PATH = path.join(root, 'data', 'cycle-watch-history.json');

const SYMBOLS = {
  spx: '^GSPC', vix: '^VIX', tnx: '^TNX',
  hyg: 'HYG', lqd: 'LQD', rsp: 'RSP', spy: 'SPY',
  aapl: 'AAPL', msft: 'MSFT', nvda: 'NVDA', amzn: 'AMZN',
  meta: 'META', googl: 'GOOGL', tsla: 'TSLA',
};
const MAG7 = ['aapl', 'msft', 'nvda', 'amzn', 'meta', 'googl', 'tsla'];
const BACKFILL_TRADING_DAYS = 60;
const DAYS_OF_HISTORY = 420; // ~290 trading days: covers 200D MA + 60d backfill

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }
function writeJson(p, d) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }
const r2 = v => (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(2)) : null;
const r4 = v => (typeof v === 'number' && Number.isFinite(v)) ? Number(v.toFixed(4)) : null;
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

async function fetchBars(symbol, days) {
  const now = Math.floor(Date.now() / 1000);
  const p1 = now - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${now}&interval=1d&events=div%2Csplits`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; capital-radar/1.0)' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const j = await res.json();
  const r = j.chart && j.chart.result && j.chart.result[0];
  if (!r) throw new Error(`Yahoo ${symbol}: no result (${j.chart && j.chart.error && j.chart.error.description})`);
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const adj = (r.indicators && r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) || null;
  const ts = r.timestamp || [];
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const close = q.close && q.close[i];
    if (typeof close !== 'number') continue;
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close,
      adj: adj && typeof adj[i] === 'number' ? adj[i] : close,
    });
  }
  return { symbol, fiftyTwoWeekHigh: r.meta && r.meta.fiftyTwoWeekHigh, bars };
}

function byDate(bars) { const m = {}; for (const b of bars) m[b.date] = b; return m; }

// Current America/New_York date ('YYYY-MM-DD') and minutes since midnight,
// via Intl — no external tz database needed.
function etNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = t => (parts.find(p => p.type === t) || {}).value || '';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}
const SETTLE_BUFFER_MIN = 16 * 60 + 15; // 16:15 ET — after the 16:00 close settles
function isSettledBar(barDate, now) {
  return barDate < now.date || (barDate === now.date && now.minutes >= SETTLE_BUFFER_MIN);
}

async function main() {
  const results = {};
  const failures = [];
  await Promise.all(Object.entries(SYMBOLS).map(async ([key, sym]) => {
    try { results[key] = await fetchBars(sym, DAYS_OF_HISTORY); }
    catch (e) { failures.push(`${sym}: ${e.message}`); }
  }));

  // Drop in-progress bars: only settled daily closes may enter history
  // (see header — a partial bar stamped as a close is how the 2026-10-16
  // snapshot landed wrong). All downstream math (200D windows, prior-close
  // lookups) therefore works on completed bars only.
  const now = etNow();
  for (const k of Object.keys(results)) {
    if (results[k]) results[k].bars = results[k].bars.filter(b => isSettledBar(b.date, now));
  }

  // Core symbols are mandatory for a usable snapshot.
  for (const k of ['spx', 'vix', 'tnx', 'hyg', 'lqd', 'rsp', 'spy']) {
    if (!results[k] || !results[k].bars.length) {
      console.warn(`[cycle-watch] fetch incomplete (${failures.join('; ')}). No append; state generator will mark STALE.`);
      return; // exit 0 — fail-soft, never break the build
    }
  }

  const maps = {}; for (const [k, v] of Object.entries(results)) maps[k] = byDate(v.bars);
  const spxDates = results.spx.bars.map(b => b.date);
  const closes = (key, date) => { const b = maps[key][date]; return b ? b.close : null; };
  const adjs = (key, date) => { const b = maps[key][date]; return b ? b.adj : null; };
  // closes strictly before date, most-recent-first
  const closesBefore = (key, date, n) => {
    const out = [];
    for (let i = spxDates.length - 1; i >= 0 && out.length < n; i--) {
      const d = spxDates[i]; if (d >= date) continue;
      const c = closes(key, d); if (c != null) out.push(c);
    }
    return out;
  };
  const rollingHigh = (key, date, n) => {
    const vals = [closes(key, date), ...closesBefore(key, date, n - 1)].filter(v => v != null);
    return vals.length ? Math.max(...vals) : null;
  };

  const existing = readJson(HISTORY_PATH, null);
  const latestSettledDate = spxDates[spxDates.length - 1];
  // Prune snapshots dated after the latest settled bar: they can only be
  // partial intraday captures written by a mid-session run (see header).
  const snapshots = (existing && Array.isArray(existing.snapshots) ? existing.snapshots : [])
    .filter(s => s.date <= latestSettledDate);
  const have = new Set(snapshots.map(s => s.date));
  const targetDates = spxDates.slice(-BACKFILL_TRADING_DAYS);
  let appended = 0;
  let refreshed = 0;

  for (const date of targetDates) {
    // Dedupe — except the latest settled date, which is always recomputed
    // so a snapshot first written from a partial bar self-heals once the
    // bar settles.
    if (have.has(date) && date !== latestSettledDate) continue;
    const spxClose = closes('spx', date);
    const ma200arr = [spxClose, ...closesBefore('spx', date, 199)].filter(v => v != null);
    const ma200 = ma200arr.length >= 200 ? avg(ma200arr) : null;
    const hyg = adjs('hyg', date), lqd = adjs('lqd', date);
    const ratio = (hyg != null && lqd) ? hyg / lqd : null;
    const ratioPrev = [];
    for (let i = 1; i <= 50; i++) {
      const d = spxDates[spxDates.indexOf(date) - i]; if (!d) break;
      const h = adjs('hyg', d), l = adjs('lqd', d);
      if (h != null && l) ratioPrev.push(h / l);
    }
    const ratioMa50 = ratioPrev.length >= 50 ? avg(ratioPrev) : null;
    const rsp = adjs('rsp', date), spy = adjs('spy', date);
    const rspSpy = (rsp != null && spy) ? rsp / spy : null;
    const rspSpy30 = (() => {
      const d = spxDates[spxDates.indexOf(date) - 30]; if (!d) return null;
      const rh = adjs('rsp', d), sh = adjs('spy', d);
      return (rh != null && sh) ? rh / sh : null;
    })();
    let mag7Gap = null;
    if (spy != null) {
      const offs = [];
      for (const k of MAG7) {
        const c = closes(k, date); if (c == null) continue;
        const hi = rollingHigh(k, date, 252) || (results[k] && results[k].fiftyTwoWeekHigh);
        if (hi) offs.push((c / hi - 1) * 100);
      }
      const spyHi = rollingHigh('spy', date, 252) || (results.spy && results.spy.fiftyTwoWeekHigh);
      if (offs.length >= 5 && spyHi) mag7Gap = ((spy / spyHi - 1) * 100) - avg(offs);
    }
    const snap = {
      date,
      spx_close: r2(spxClose),
      spx_ma200: r2(ma200),
      spx_vs_200d_pct: (spxClose != null && ma200) ? r2((spxClose / ma200 - 1) * 100) : null,
      vix: r2(closes('vix', date)),
      us10y: r2(closes('tnx', date)),
      hyg_lqd_ratio: r4(ratio),
      hyg_lqd_vs_ma50_pct: (ratio != null && ratioMa50) ? r2((ratio / ratioMa50 - 1) * 100) : null,
      rsp_spy_ratio: r4(rspSpy),
      rsp_spy_30d_pct: (rspSpy != null && rspSpy30) ? r2((rspSpy / rspSpy30 - 1) * 100) : null,
      mag7_gap_pts: r2(mag7Gap),
    };
    if (have.has(date)) {
      const idx = snapshots.findIndex(s => s.date === date);
      if (JSON.stringify(snapshots[idx]) !== JSON.stringify(snap)) { snapshots[idx] = snap; refreshed++; }
    } else {
      snapshots.push(snap);
      appended++;
    }
  }
  snapshots.sort((a, b) => a.date < b.date ? -1 : 1);

  writeJson(HISTORY_PATH, {
    artifact: 'cycle-watch-history',
    version: 1,
    updated_at: new Date().toISOString(),
    backfill_trading_days: BACKFILL_TRADING_DAYS,
    failures: failures.length ? failures : undefined,
    note: 'hyg_lqd and rsp_spy are Yahoo-ETF PROXIES for credit spreads and breadth (FRED down since 2026-09-18). Labeled as proxy wherever displayed.',
    snapshots,
  });
  console.log(`[cycle-watch] history updated: ${snapshots.length} snapshots, +${appended} new, ${refreshed} refreshed. Failures: ${failures.length ? failures.join('; ') : 'none'}`);
}

main().catch(e => { console.warn('[cycle-watch] fatal fetch error (fail-soft):', e.message); });
