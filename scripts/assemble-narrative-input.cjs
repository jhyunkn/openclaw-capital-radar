'use strict';
// Assembles the structured input that Claude Code synthesizes into narrative-reality-brief.json.
// Runs every build. Claude Code reads the output and writes the actual brief during the loop.
// Output: outputs/narrative-reality-input.json

const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function readJson(rel, fallback = null) {
  const p = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

const liveState      = readJson('data/report-state.live.json', {});
const marketNews     = readJson('outputs/market-news.json', {});
const newsCatalyst   = readJson('outputs/news-catalyst-state.json', {});
const conviction     = readJson('outputs/conviction-ranking.json', {});
const dynamicUni     = readJson('outputs/dynamic-universe.json', {});
const oppUniverse    = readJson('data/opportunity-universe.json', {});
const scannerUni     = readJson('data/scanner-universe.json', {});
const marketEvents   = readJson('data/market-events.json', {});

// ── UNIVERSE ──────────────────────────────────────────────────────────────────
const holdingTickers = (liveState.holdings || []).map(h => String(h.ticker || '').toUpperCase()).filter(Boolean);
const oppTickers     = (oppUniverse?.tickers || []).map(t => String(t.ticker || '').toUpperCase());
const scanTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker || '').toUpperCase());
const allTracked     = [...new Set([...holdingTickers, ...oppTickers, ...scanTickers])];

// ── MARKET SNAPSHOT ───────────────────────────────────────────────────────────
const bySymbol    = Object.fromEntries((liveState.liveMarket || []).map(m => [m.symbol, m]));
const byRate      = Object.fromEntries((liveState.liveRatesCredit || []).map(r => [r.id, r]));

const spy   = bySymbol['SPY']  || {};
const qqq   = bySymbol['QQQ']  || {};
const iwm   = bySymbol['IWM']  || {};
const vix   = bySymbol['^VIX'] || {};
const dff   = byRate['DFF']    || {};
const dgs2  = byRate['DGS2']   || {};
const dgs10 = byRate['DGS10']  || {};
const dgs30 = byRate['DGS30']  || {};
const hyoas = byRate['BAMLH0A0HYM2'] || {};
const t10ie = byRate['T10YIE'] || {};

const curve2s10s = (dgs10.value && dgs2.value) ? +(dgs10.value - dgs2.value).toFixed(2) : null;
const real10y    = (dgs10.value && t10ie.value) ? +(dgs10.value - t10ie.value).toFixed(2) : null;

// ── 1M LEADERS / LAGGARDS ────────────────────────────────────────────────────
const allMkt = (liveState.liveMarket || []).filter(m => m.perf1mPct != null && m.symbol !== '^VIX');
const sorted1m = [...allMkt].sort((a, b) => b.perf1mPct - a.perf1mPct);
const leaders1m  = sorted1m.filter(m => m.perf1mPct >  2).map(m => ({ symbol: m.symbol, perf1m: m.perf1mPct, today: m.changePct }));
const laggards1m = sorted1m.filter(m => m.perf1mPct < -10).map(m => ({ symbol: m.symbol, perf1m: m.perf1mPct, today: m.changePct }));

// ── DISLOCATIONS (from conviction pullback context) ───────────────────────────
const pullback = conviction?.pullback_context || {};
const dislocations = (pullback.watchlist_dislocations || []).map(d => ({
  ticker:       d.ticker,
  name:         d.name,
  livePrice:    d.livePrice,
  pctFrom52wH:  d.pctFrom52wHigh,
  trend1m:      d.trend1mPct,
  rsi14:        d.rsi14,
  signal:       d.signal,
  declineReason: d.decline_reason,
}));

// ── HIGH-SIGNAL NEWS (ticker-relevant + high materiality + event signals) ─────
// Tier 1: materiality >= 6 from news-catalyst-state
const highMatNews = (newsCatalyst?.items || [])
  .filter(item => (item.materiality_score || 0) >= 6)
  .map(item => ({
    ticker:    item.ticker,
    headline:  item.headline,
    score:     item.materiality_score,
    pub:       (item.published_at || '').slice(0, 10),
  }));

// Tier 2: tickers in our universe with at least 1 recent headline (last 7 days)
const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
const trackedNewsItems = (newsCatalyst?.items || [])
  .filter(item => {
    if (!allTracked.includes(String(item.ticker || '').toUpperCase())) return false;
    const pub = new Date(item.published_at || 0).getTime();
    return pub > cutoff7d && (item.materiality_score || 0) >= 3;
  })
  .sort((a, b) => (b.materiality_score || 0) - (a.materiality_score || 0))
  .slice(0, 30)
  .map(item => ({
    ticker:   item.ticker,
    headline: item.headline,
    score:    item.materiality_score,
    pub:      (item.published_at || '').slice(0, 10),
  }));

// Tier 3: active market event signals (already confirmed by the event detection engine)
const activeEvents = Object.values(marketNews?.event_activity || {})
  .filter(ev => ev.news_active === true || ev.news_hit_count > 0)
  .map(ev => ({
    event_id:         ev.event_id,
    name:             ev.name,
    status:           ev.status,
    signal_strength:  ev.signal_strength,
    hit_count:        ev.news_hit_count,
    matched_headlines: (ev.matched_headlines || []).slice(0, 3),
    beneficiaries:    ev.beneficiary_tickers || [],
  }));

// ── OPPORTUNITY SIGNALS (system-detected, not news-derived) ──────────────────
const convPromotions  = (dynamicUni?.conviction_promotions  || []).map(e => ({
  ticker: e.ticker, score: e.score, thesis: (e.thesis || '').slice(0, 200),
  pct52wH: e.pct_from_52w_high, rsi: e.rsi14, insiderSignal: e.open_market_signal,
  revenueInflection: e.revenue_inflection,
}));
const watchPromotions = (dynamicUni?.watchlist_promotions   || []).map(e => ({
  ticker: e.ticker, score: e.score, thesis: (e.thesis || '').slice(0, 200),
  pct52wH: e.pct_from_52w_high, rsi: e.rsi14, revenueInflection: e.revenue_inflection,
}));

// ── TOP CONVICTION (screener output) ─────────────────────────────────────────
const convTop = (conviction?.top10 || []).slice(0, 8).map(cv => ({
  ticker:        cv.ticker,
  score:         cv.conviction_score,
  tier:          cv.conviction_tier,
  window:        cv.window_score,
  timingStatus:  cv.timing_status,
  pct52wH:       cv.pct_from_52w_high,
  rsi:           cv.rsi14,
  declineExp:    (cv.decline_explanation || '').slice(0, 160),
  signals:       (cv.fundamental_signals || []).slice(0, 3),
}));

// ── ASSEMBLE OUTPUT ───────────────────────────────────────────────────────────
const input = {
  assembledAt: new Date().toISOString(),
  purpose: 'Input for Claude Code to synthesize into outputs/narrative-reality-brief.json. Read this file during the operating loop and write the brief.',

  marketSnapshot: {
    spy:  { price: spy.price,  day: spy.changePct,  perf1m: spy.perf1mPct,  perf3m: spy.perf3mPct  },
    qqq:  { price: qqq.price,  day: qqq.changePct,  perf1m: qqq.perf1mPct,  perf3m: qqq.perf3mPct  },
    iwm:  { price: iwm.price,  day: iwm.changePct,  perf1m: iwm.perf1mPct,  perf3m: iwm.perf3mPct  },
    vix:  { price: vix.price,  day: vix.changePct,  perf1m: vix.perf1mPct   },
    rates: {
      dff: dff.value, dgs2: dgs2.value, dgs10: dgs10.value, dgs30: dgs30.value,
      curve2s10s, real10y, hyOas: hyoas.value, t10ie: t10ie.value,
    },
    leaders1m,
    laggards1m,
  },

  portfolioContext: {
    holdings: holdingTickers,
    dislocations,
    pullbackPosture: pullback.posture_on_pullback || '',
    spyTrend1m:     pullback.spy_trend_1m_pct,
  },

  opportunitySignals: {
    convictionPromotions:  convPromotions,
    watchlistPromotions:   watchPromotions,
    topConviction:         convTop,
  },

  // Filtered news ready for synthesis
  news: {
    highMateriality:   highMatNews,     // score >= 6, always include
    trackedUniverse:   trackedNewsItems, // about our tickers, score >= 3
    activeEvents,                        // market events confirmed by headline scan
  },

  synthesisInstructions: [
    'Read the data above and write outputs/narrative-reality-brief.json.',
    'Identify 3-5 major themes active in the market right now (e.g. nuclear/AI power, software SaaS, financial rails, credit/macro).',
    'For each theme, extract: (1) the prevailing market narrative — what the news and price action imply the market believes; (2) what the hard data actually shows (use the dislocation depths, credit spreads, revenue signals, insider buying); (3) a counter-read — where narrative and data diverge, and what that means for positioning.',
    'Classify each theme: NARRATIVE_AHEAD (price is ahead of fundamentals — caution), DATA_AHEAD (fundamentals ahead of price — opportunity), or ALIGNED (narrative and data agree).',
    'Write a strategyPosture (1-2 sentences: current action posture).',
    'Write whereWaveBuilds (1-2 sentences: where the next move is most likely to materialize, and what the trigger is).',
    'Write watchFor (3-5 specific, measurable signals that would change the posture).',
    'Be direct. No filler. Anchor every claim to a data point in this input.',
    'The audience is a single investor (Jun) reviewing this at the start of the day.',
  ],
};

fs.writeFileSync(
  path.join(root, 'outputs', 'narrative-reality-input.json'),
  JSON.stringify(input, null, 2)
);
console.log(`assembled narrative input: ${activeEvents.length} active events, ${highMatNews.length} high-materiality news, ${trackedNewsItems.length} tracked-universe items, ${dislocations.length} dislocations`);
