'use strict';
// Ranks candidates by a composite score: existing opportunity_score +
// XBRL fundamental quality bonus. Produces a ranked list with a top-3
// "closest to promotion" panel and a clear differentiation between
// fundamentally strong vs. weak candidates.
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out  = path.join(root, 'outputs', 'candidate-ranking.json');

function read(rel, fb = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; }
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }

const asymmetry = read('outputs/opportunity-asymmetry-state.json', { opportunity_clusters: [] });
const xbrlData  = read('outputs/sec-xbrl-fundamentals.json', { results: [] });
const newsData  = read('outputs/news-catalyst-state.json', { items: [] });

// Build lookups
const xbrlByTicker = Object.fromEntries(
  (xbrlData.results || []).filter(r => r.ticker && r.fundamentals)
    .map(r => [r.ticker.toUpperCase(), r.fundamentals])
);
const highNewsByTicker = {};
for (const item of (newsData.items || []).filter(n => n.materiality_score >= 8)) {
  const t = String(item.ticker || '').toUpperCase();
  if (!highNewsByTicker[t]) highNewsByTicker[t] = [];
  highNewsByTicker[t].push(item);
}

function fundamentalBonus(xbrl, ticker) {
  if (!xbrl) return { bonus: 0, signals: ['no XBRL data'] };
  const signals = [];
  let bonus = 0;
  const growth = num(xbrl.revenue_growth_pct);
  const fcf    = num(xbrl.fcf_usd_millions);
  const gm     = num(xbrl.gross_margin_pct);
  const dil    = xbrl.dilution_flag;

  if (growth != null && growth > 40)  { bonus += 10; signals.push(`rev +${growth.toFixed(0)}%`); }
  else if (growth != null && growth > 20) { bonus +=  6; signals.push(`rev +${growth.toFixed(0)}%`); }
  else if (growth != null && growth > 8)  { bonus +=  3; signals.push(`rev +${growth.toFixed(0)}%`); }
  else if (growth != null && growth <= 0) { bonus -=  8; signals.push(`rev ${growth.toFixed(0)}%`); }

  if (fcf != null && fcf > 5000)   { bonus +=  8; signals.push(`FCF $${(fcf/1000).toFixed(1)}B`); }
  else if (fcf != null && fcf > 0) { bonus +=  5; signals.push(`FCF $${fcf.toFixed(0)}M`); }
  else if (fcf != null && fcf < 0) { bonus -=  8; signals.push(`FCF -$${Math.abs(fcf).toFixed(0)}M (burning)`); }

  if (gm != null && gm > 65) { bonus += 6; signals.push(`GM ${gm.toFixed(0)}%`); }
  else if (gm != null && gm > 40) { bonus += 3; signals.push(`GM ${gm.toFixed(0)}%`); }

  if (dil === 'low')      { bonus += 3;  signals.push('dilution: low'); }
  if (dil === 'elevated') { bonus -= 6;  signals.push('dilution: elevated'); }

  return { bonus: clamp(bonus, -25, 22), signals };
}

function newsFlag(ticker) {
  const items = highNewsByTicker[ticker] || [];
  if (!items.length) return null;
  return {
    count: items.length,
    latest: items[0]?.headline,
    signals: items[0]?.materiality_signals || []
  };
}

// Flatten all candidates across clusters
const candidates = [];
for (const cluster of (asymmetry.opportunity_clusters || [])) {
  for (const t of (cluster.candidate_tickers || [])) {
    const ticker = String(t.ticker || '').toUpperCase();
    const xbrl   = xbrlByTicker[ticker] || null;
    const { bonus, signals: fundSignals } = fundamentalBonus(xbrl, ticker);
    const baseScore  = num(t.opportunity_score) ?? 0;
    const conviction = num(t.conviction_score) ?? 0;
    const adjusted   = clamp(baseScore + bonus);
    const news       = newsFlag(ticker);

    candidates.push({
      ticker,
      name: t.name || ticker,
      macro_theme: cluster.macro_theme,
      opportunity_score: baseScore,
      conviction_score: conviction,
      fundamental_bonus: bonus,
      fundamental_signals: fundSignals,
      adjusted_score: adjusted,
      promotion_status: t.promotion_status,
      next_gate: t.next_gate,
      why_this_ticker: t.why_this_ticker,
      action_permission: t.action_permission,
      zone_status: t.zone_status,
      missing_evidence: t.missing_evidence || [],
      high_materiality_news: news,
      has_xbrl: xbrl !== null,
      xbrl_summary: xbrl ? {
        revenue_growth_pct: xbrl.revenue_growth_pct,
        fcf_usd_millions:   xbrl.fcf_usd_millions,
        gross_margin_pct:   xbrl.gross_margin_pct,
        dilution_flag:      xbrl.dilution_flag
      } : null
    });
  }
}

// Sort by adjusted score descending
candidates.sort((a, b) => b.adjusted_score - a.adjusted_score || b.conviction_score - a.conviction_score);

// Tier classification
for (const c of candidates) {
  // Tier A: strong fundamentals, adjusted ≥80, positive FCF
  const hasFcf = c.xbrl_summary?.fcf_usd_millions > 0;
  if (c.adjusted_score >= 80 && c.has_xbrl && hasFcf)  c.tier = 'A';
  else if (c.adjusted_score >= 65 && c.has_xbrl)        c.tier = 'B';
  else if (!c.has_xbrl || c.adjusted_score < 50)        c.tier = 'D';
  else                                                    c.tier = 'C';
}

const top3    = candidates.filter(c => c.tier === 'A').slice(0, 3);
const tierB   = candidates.filter(c => c.tier === 'B');
const tierC   = candidates.filter(c => c.tier === 'C');
const tierD   = candidates.filter(c => c.tier === 'D');

const state = {
  artifact: 'candidate-ranking',
  generated_at: new Date().toISOString(),
  source_note: 'Adjusted score = opportunity_score + XBRL fundamental quality bonus (max ±35). Tier A = strong fundamentals + score ≥75. Tier B = score 60-74. Tier C = score 45-59. Tier D = pre-revenue or no XBRL.',
  promotion_rule: 'Only Tier A and B candidates eligible for add-watch promotion. Risk budget gate must clear independently.',
  summary: {
    total: candidates.length,
    tier_a: top3.length,
    tier_b: tierB.length,
    tier_c: tierC.length,
    tier_d: tierD.length,
    with_high_news: candidates.filter(c => c.high_materiality_news).length
  },
  top3,
  ranked: candidates,
  tier_a: candidates.filter(c => c.tier === 'A'),
  tier_b: tierB,
  tier_c: tierC,
  tier_d: tierD
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n');
console.log(`candidate-ranking: ${candidates.length} candidates ranked | Tier A=${state.tier_a.length} B=${tierB.length} C=${tierC.length} D=${tierD.length}`);
console.log(`Top 3: ${top3.map(c => `${c.ticker}(${c.adjusted_score})`).join(' > ')}`);
