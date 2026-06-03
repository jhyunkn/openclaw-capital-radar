'use strict';
// Delta brief: "what changed since the last run."
// Compares current live state to the previous reaction state snapshot and
// produces a concise operator summary — price movers, posture changes,
// news alerts, and candidate gate changes.
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out  = path.join(root, 'outputs', 'delta-brief.json');

function read(rel, fb = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function pct(v) { return v != null ? (v > 0 ? '+' : '') + v.toFixed(2) + '%' : null; }
function arr(v) { return Array.isArray(v) ? v : []; }

const current  = read('outputs/live-reaction-state.json', {});
const previous = read('outputs/live-reaction-state.previous.json', {});
const news     = read('outputs/news-catalyst-state.json', { items: [] });
const ranking  = read('outputs/candidate-ranking.json', { ranked: [] });
const live     = read('data/report-state.live.json', {});

const currentRows  = arr(current.all);
const previousRows = arr(previous.all || previous.holdings || []);
const prevByTicker = Object.fromEntries(previousRows.map(r => [r.ticker, r]));

// ── Price movers ──────────────────────────────────────────────────────────────
const movers = [];
for (const row of currentRows) {
  const prev = prevByTicker[row.ticker];
  const prevPrice = num(prev?.price);
  const curPrice  = num(row.price);
  if (prevPrice == null || curPrice == null) continue;
  const changePct = ((curPrice - prevPrice) / prevPrice) * 100;
  if (Math.abs(changePct) >= 1.5) {
    movers.push({
      ticker: row.ticker,
      prev_price: Math.round(prevPrice * 100) / 100,
      current_price: Math.round(curPrice * 100) / 100,
      change_pct: Math.round(changePct * 100) / 100,
      direction: changePct > 0 ? 'up' : 'down'
    });
  }
}
movers.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

// ── Posture / permission changes ──────────────────────────────────────────────
const postureChanges = [];
for (const row of currentRows) {
  const prev = prevByTicker[row.ticker];
  if (!prev) continue;
  const prevPerm = prev.reaction?.permission || prev.permission;
  const curPerm  = row.reaction?.permission  || row.permission;
  if (prevPerm !== curPerm) {
    postureChanges.push({ ticker: row.ticker, from: prevPerm, to: curPerm });
  }
}

// ── High materiality news ─────────────────────────────────────────────────────
const highNews = arr(news.items).filter(n => n.materiality_score >= 8);
const medNews  = arr(news.items).filter(n => n.materiality_score >= 5 && n.materiality_score < 8);

// ── Holdings in portfolio with notable day moves ───────────────────────────────
const holdingMovers = arr(live.holdings)
  .filter(h => Math.abs(num(h.dayChangePct) ?? 0) >= 2)
  .map(h => ({ ticker: h.ticker, dayChangePct: h.dayChangePct, livePrice: h.livePrice }))
  .sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct));

// ── Overall posture delta ─────────────────────────────────────────────────────
const prevPosture = previous.posture || null;
const curPosture  = current.posture  || null;
const postureChanged = prevPosture && curPosture && prevPosture !== curPosture;

// ── Top candidates that moved in ranking ──────────────────────────────────────
const topCandidates = arr(ranking.tier_a).slice(0, 3).map(c => ({
  ticker: c.ticker, adjusted_score: c.adjusted_score, tier: c.tier,
  next_gate: c.next_gate, fundamental_signals: c.fundamental_signals
}));

// ── Build narrative summary ────────────────────────────────────────────────────
const lines = [];
if (postureChanged) lines.push(`Posture changed: ${prevPosture} → ${curPosture}.`);
if (movers.length)   lines.push(`Notable moves since last run: ${movers.slice(0,4).map(m => `${m.ticker} ${pct(m.change_pct)}`).join(', ')}.`);
if (holdingMovers.length) lines.push(`Holdings with day moves ≥2%: ${holdingMovers.slice(0,4).map(h => `${h.ticker} ${pct(h.dayChangePct)}`).join(', ')}.`);
if (highNews.length) lines.push(`${highNews.length} HIGH materiality news item${highNews.length>1?'s':''}: ${highNews.map(n => `${n.ticker} — ${n.materiality_signals?.join('/')}`).join('; ')}.`);
if (postureChanges.length) lines.push(`Permission changes: ${postureChanges.map(c => `${c.ticker} ${c.from}→${c.to}`).join(', ')}.`);
if (!lines.length) lines.push('No significant changes detected since last run.');

const state = {
  artifact: 'delta-brief',
  generated_at: new Date().toISOString(),
  previous_run_at: previous.generatedAt || null,
  current_run_at:  current.generatedAt  || null,
  posture: curPosture,
  posture_changed: postureChanged,
  posture_from: prevPosture,
  summary_lines: lines,
  narrative: lines.join(' '),
  price_movers: movers,
  posture_changes: postureChanges,
  holding_movers: holdingMovers,
  high_news: highNews.map(n => ({ ticker: n.ticker, headline: n.headline, signals: n.materiality_signals, published_at: n.published_at })),
  medium_news: medNews.map(n => ({ ticker: n.ticker, headline: n.headline })),
  top_candidates: topCandidates,
  operator_action_required: highNews.length > 0 || postureChanges.length > 0 || movers.some(m => Math.abs(m.change_pct) >= 5)
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n');
console.log(`delta-brief: ${lines.length} summary lines | movers=${movers.length} news-high=${highNews.length} posture-changes=${postureChanges.length}`);
console.log(`narrative: ${state.narrative}`);
