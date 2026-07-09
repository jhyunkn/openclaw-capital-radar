// Ingests market-wide Robinhood scan results (data/discovery/scan-track-*.json)
// into outputs/discovery-state.json: dedupes against tracked universes and holdings,
// ranks by opportunity-framework fit, and surfaces the top candidates per track.
// Scan snapshots refresh via Robinhood MCP sessions; this script tolerates stale
// snapshots but downgrades status so the display can say so.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(f) { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
const round = (v, d = 1) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

const trackA = read('data/discovery/scan-track-a.json');
const trackB = read('data/discovery/scan-track-b.json');
const framework = read('data/intelligence/opportunity-framework.json');

// Names the radar already tracks — discovery only surfaces NEW names.
const tracked = new Set();
for (const t of (read('data/opportunity-universe.json')?.tickers || [])) tracked.add(t.ticker);
for (const c of (read('data/scanner-universe.json')?.candidates || [])) tracked.add(c.ticker);
for (const h of (read('outputs/robinhood-positions.json')?.positions || [])) tracked.add(h.symbol || h.ticker);

const ETF_PATTERN = /^(GLD|IAU|SLV|SIVR|SPY|QQQ|IWM|SOX|XL[A-Z]|VOO|VTI|DIA|EEM|EFA|AGG|TLT|HYG|LQD|GDX|GDXJ|URA|ARKK?)/;

function staleness(snapshot) {
  if (!snapshot?.fetched_at) return 'MISSING';
  const ageDays = (Date.now() - new Date(snapshot.fetched_at).getTime()) / 86400000;
  if (ageDays > 7) return 'STALE';
  if (ageDays > 2) return 'AGING';
  return 'FRESH';
}

function candidatesFrom(snapshot, track) {
  if (!snapshot?.results) return [];
  return snapshot.results.map(r => {
    const c = r.columns || {};
    const gm = num(c['Gross margin']);
    const om = num(c['Operating margin']);
    const rsi = num(c['RSI']);
    const cap = num(c['Market cap']);
    if (!r.ticker || rsi == null || cap == null) return null;
    if (tracked.has(r.ticker) || ETF_PATTERN.test(r.ticker)) return null;
    // Framework fit: quality margins always score; dislocation depth scores Track A,
    // trend-sweet-spot scores Track B. Range roughly 0-100.
    // Margins are clamped: GM above ~75% is usually an accounting structure
    // (REITs, royalty cos, exchanges), not pricing power — without the clamp the
    // ranking degenerates into a REIT list.
    const quality = Math.min(gm || 0, 0.75) * 40 + Math.min(om || 0, 0.40) * 60;
    const setup = track === 'A'
      ? Math.max(0, 45 - rsi) * 1.5              // deeper oversold = better
      : Math.max(0, 15 - Math.abs(rsi - 62));    // RSI ~62 sweet spot
    return {
      ticker: r.ticker,
      name: c['Name'] || r.ticker,
      track: track === 'A' ? 'A_dislocated_quality' : 'B_inflection_leaders',
      last: num(c['Last']),
      rsi: round(rsi),
      gross_margin_pct: round((gm || 0) * 100),
      operating_margin_pct: round((om || 0) * 100),
      market_cap_b: round(cap / 1e9),
      framework_fit: round(quality + setup),
      why: track === 'A'
        ? `RSI ${round(rsi)} with ${round((gm || 0) * 100)}% GM / ${round((om || 0) * 100)}% OM — quality marked down, business intact pending XBRL check`
        : `RSI ${round(rsi)} holding strength with ${round((gm || 0) * 100)}% GM and positive EPS — inflection candidate pending event check`,
      next_gate: track === 'A'
        ? 'Verify revenue not declining (XBRL) + one evidence signal (insider/backlog/re-accel), then promote to scanner-universe with moat research'
        : 'Verify dated inflection event within 2 quarters + not >25% above 20d base, then promote'
    };
  }).filter(Boolean).sort((a, b) => b.framework_fit - a.framework_fit);
}

const a = candidatesFrom(trackA, 'A');
const b = candidatesFrom(trackB, 'B');
const TOP_N = 12;

const state = {
  artifact: 'discovery-state',
  version: 1,
  generatedAt: new Date().toISOString(),
  framework_version: framework?.version || null,
  doctrine: framework?.doctrine?.discovery_before_curation || 'Market-wide screen before curation.',
  snapshots: {
    track_a: { fetched_at: trackA?.fetched_at || null, total_matches: trackA?.total_items || 0, status: staleness(trackA), scan_id: trackA?.scan_id || null },
    track_b: { fetched_at: trackB?.fetched_at || null, total_matches: trackB?.total_items || 0, status: staleness(trackB), scan_id: trackB?.scan_id || null }
  },
  refresh_instruction: 'Refresh via Robinhood MCP: run_scan on each scan_id, save results to data/discovery/scan-track-{a,b}.json with fetched_at.',
  excluded_already_tracked: [...tracked].length,
  track_a_candidates: a.slice(0, TOP_N),
  track_b_candidates: b.slice(0, TOP_N),
  full_counts: { track_a_new: a.length, track_b_new: b.length }
};

for (const f of ['outputs/discovery-state.json', 'public/outputs/discovery-state.json']) {
  const p = path.join(root, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
}
console.log(`discovery-state: A ${a.length} new (top: ${a.slice(0, 5).map(x => x.ticker).join(', ')}) | B ${b.length} new (top: ${b.slice(0, 5).map(x => x.ticker).join(', ')}) | snapshots ${state.snapshots.track_a.status}/${state.snapshots.track_b.status}`);
