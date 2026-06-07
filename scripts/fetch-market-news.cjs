'use strict';

// Fetches market news from Yahoo Finance RSS for all tracked tickers.
// Detects key signal phrases in headlines and maps them to opportunity signals.
// Also evaluates market-events.json against current news to flag which
// anticipated events are showing early signs of materializing.
//
// Output: outputs/market-news.json
// Pipeline position: after fetch-watchlist-market-data (tickers known), before generate-dynamic-universe

const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const OUT_PATH = path.join(root, 'outputs', 'market-news.json');

fs.mkdirSync(path.join(root, 'outputs'), { recursive: true });

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe      = readJson('data/opportunity-universe.json');
const scannerUni    = readJson('data/scanner-universe.json');
const marketEvents  = readJson('data/market-events.json');

const convictionTickers = (universe?.tickers     || []).map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
const ALL_TICKERS       = [...new Set([...convictionTickers, ...scannerTickers])];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Signal phrase detection — maps headline keywords to actionable signal types
const SIGNAL_RULES = [
  // Space economy
  { patterns: [/spacex\s*ipo|starlink\s*ipo|starlink\s*listing|spacex\s*s-1|spacex\s*going\s*public/i], signal: 'SPACEX_IPO',       impact: 'POSITIVE', strength: 15 },
  { patterns: [/space\s*economy|commercial\s*space|satellite\s*constellation|rocket\s*launch|space\s*launch/i], signal: 'SPACE_ECONOMY', impact: 'POSITIVE', strength: 8 },
  // Nuclear
  { patterns: [/smr\s*permit|nuclear\s*permit|nuclear\s*license|haleu|small\s*modular\s*reactor|nrc\s*approv/i], signal: 'NUCLEAR_PERMIT',  impact: 'POSITIVE', strength: 12 },
  { patterns: [/nuclear\s*ppa|nuclear\s*power\s*purchase|nuclear\s*data\s*center/i], signal: 'NUCLEAR_DEMAND', impact: 'POSITIVE', strength: 10 },
  // Defense
  { patterns: [/golden\s*dome|missile\s*defense\s*system|autonomous\s*drone\s*defense/i], signal: 'GOLDEN_DOME',   impact: 'POSITIVE', strength: 12 },
  { patterns: [/defense\s*contract|dod\s*award|pentagon\s*contract|military\s*award/i],   signal: 'DEFENSE_CONTRACT', impact: 'POSITIVE', strength: 8 },
  // IPO / M&A
  { patterns: [/\bipo\b|files?\s*s-1|going\s*public|initial\s*public\s*offering/i], signal: 'IPO_CATALYST', impact: 'POSITIVE', strength: 10 },
  { patterns: [/acquires?|acquisition|merger|takeover\s*bid|buyout/i],               signal: 'MA_EVENT',     impact: 'POSITIVE', strength: 10 },
  // Earnings / guidance
  { patterns: [/raises?\s*guidance|beat[s]?\s*estimate|above\s*expectations|strong\s*quarter/i], signal: 'POSITIVE_EARNINGS', impact: 'POSITIVE', strength: 8 },
  { patterns: [/cut[s]?\s*guidance|miss(es)?\s*estimate|below\s*expectations|weak\s*quarter/i],  signal: 'NEGATIVE_EARNINGS', impact: 'NEGATIVE', strength: 8 },
  // Geopolitical risk
  { patterns: [/china\s*(chip|ban|export|sanction)|export\s*control.*chip|bis\s*rule|entity\s*list/i], signal: 'CHINA_RISK',    impact: 'NEGATIVE', strength: 10 },
  { patterns: [/tariff|trade\s*war|import\s*duty/i],                                                    signal: 'TARIFF_RISK',  impact: 'NEGATIVE', strength: 6 },
  // AI / power
  { patterns: [/ai\s*(power|energy|electricity)\s*(demand|crisis|shortage|constraint)/i], signal: 'AI_POWER_DEMAND', impact: 'POSITIVE', strength: 8 },
  { patterns: [/data\s*center\s*power|hyperscaler\s*(energy|power|ppa)/i],                signal: 'AI_POWER_DEMAND', impact: 'POSITIVE', strength: 8 },
  // Partnerships / supply agreements
  { patterns: [/strategic\s*(partnership|alliance)|supply\s*agreement|multi[-\s]year\s*contract/i], signal: 'STRATEGIC_WIN', impact: 'POSITIVE', strength: 7 },
];

// Parse RSS XML headlines (no external deps — simple regex)
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title   = block.match(/<title>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/title>/i)?.[1]?.trim() || '';
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1]?.trim() || '';
    const link    = block.match(/<link>(.*?)<\/link>/i)?.[1]?.trim()
                 || block.match(/<link\s+[^>]*href="([^"]+)"/i)?.[1]?.trim() || '';
    if (title) items.push({ title, pubDate, link });
  }
  return items;
}

function detectSignals(headlines, cutoffDays = 7) {
  const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
  const signals = [];
  const signalSet = new Set();

  for (const h of headlines) {
    const ts = h.pubDate ? new Date(h.pubDate).getTime() : 0;
    if (ts && ts < cutoff) continue; // only recent headlines

    for (const rule of SIGNAL_RULES) {
      const matched = rule.patterns.some(p => p.test(h.title));
      if (matched && !signalSet.has(rule.signal)) {
        signalSet.add(rule.signal);
        signals.push({ signal: rule.signal, impact: rule.impact, strength: rule.strength, headline: h.title.slice(0, 120), date: h.pubDate });
      }
    }
  }
  return signals;
}

async function fetchTickerNews(ticker) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSS(xml);
  } catch (err) {
    return [];
  }
}

// Check how well a market event's news_keywords match the aggregated headlines
function scoreEventActivity(event, allHeadlines) {
  let hits = 0;
  const matchedHeadlines = [];
  for (const h of allHeadlines) {
    for (const kw of (event.news_keywords || [])) {
      if (new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(h.title)) {
        hits++;
        if (!matchedHeadlines.includes(h.title)) matchedHeadlines.push(h.title.slice(0, 100));
        break;
      }
    }
  }
  return { hits, matchedHeadlines: matchedHeadlines.slice(0, 3) };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  const tickerResults  = {};
  const allHeadlines   = [];
  const errors         = [];

  console.log(`Fetching news for ${ALL_TICKERS.length} tickers via Yahoo Finance RSS...`);

  for (const ticker of ALL_TICKERS) {
    await delay(150);
    const headlines = await fetchTickerNews(ticker);
    const signals   = detectSignals(headlines);
    tickerResults[ticker] = {
      ticker,
      headline_count:    headlines.length,
      recent_headlines:  headlines.slice(0, 5).map(h => ({ title: h.title, date: h.pubDate })),
      signals_detected:  signals,
      positive_signals:  signals.filter(s => s.impact === 'POSITIVE').map(s => s.signal),
      negative_signals:  signals.filter(s => s.impact === 'NEGATIVE').map(s => s.signal),
      news_signal_score: signals.filter(s => s.impact === 'POSITIVE').reduce((a, s) => a + s.strength, 0)
                       - signals.filter(s => s.impact === 'NEGATIVE').reduce((a, s) => a + s.strength, 0),
    };
    allHeadlines.push(...headlines);

    if (signals.length) {
      console.log(`${ticker.padEnd(5)} ${signals.map(s => `${s.signal}(${s.impact[0]})`).join(' ')}`);
    } else {
      process.stdout.write('.');
    }
  }
  console.log('');

  // Evaluate market events against current news activity
  const eventActivity = {};
  for (const event of (marketEvents?.events || [])) {
    const { hits, matchedHeadlines } = scoreEventActivity(event, allHeadlines);
    eventActivity[event.id] = {
      event_id:          event.id,
      name:              event.name,
      status:            event.status,
      signal_strength:   event.signal_strength,
      news_hit_count:    hits,
      matched_headlines: matchedHeadlines,
      news_active:       hits >= 2, // ≥2 headline hits = event is in the news cycle
      beneficiary_tickers: event.beneficiary_tickers,
      risk_tickers:        event.risk_tickers,
    };
    console.log(`Event: ${event.name} — ${hits} headline hits ${hits >= 2 ? '⚡ ACTIVE' : ''}`);
  }

  // Build active event signals per ticker
  const tickerEventSignals = {};
  for (const event of (marketEvents?.events || [])) {
    const activity = eventActivity[event.id];
    for (const ticker of (event.beneficiary_tickers || [])) {
      if (!tickerEventSignals[ticker]) tickerEventSignals[ticker] = [];
      tickerEventSignals[ticker].push({
        event_id:       event.id,
        event_name:     event.name,
        event_type:     event.type,
        signal_strength: event.signal_strength,
        news_active:    activity.news_active,
        impact:         'POSITIVE',
        score_boost:    event.signal_strength === 'HIGH' ? 12 : event.signal_strength === 'MEDIUM' ? 6 : 3,
      });
    }
    for (const ticker of (event.risk_tickers || [])) {
      if (!tickerEventSignals[ticker]) tickerEventSignals[ticker] = [];
      tickerEventSignals[ticker].push({
        event_id:       event.id,
        event_name:     event.name,
        event_type:     event.type,
        signal_strength: event.signal_strength,
        news_active:    activity.news_active,
        impact:         'NEGATIVE',
        score_boost:    event.signal_strength === 'HIGH' ? -10 : event.signal_strength === 'MEDIUM' ? -5 : -2,
      });
    }
  }

  // Summary
  const allSignals   = Object.values(tickerResults).flatMap(t => t.signals_detected);
  const signalCounts = {};
  for (const s of allSignals) signalCounts[s.signal] = (signalCounts[s.signal] || 0) + 1;
  const topSignals   = Object.entries(signalCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const activeEvents = Object.values(eventActivity).filter(e => e.news_active);

  const output = {
    artifact:    'market-news',
    generatedAt: new Date().toISOString(),
    source:      'Yahoo Finance RSS + market-events.json',
    total_tickers: ALL_TICKERS.length,
    tickers:     tickerResults,
    event_activity: eventActivity,
    ticker_event_signals: tickerEventSignals,
    summary: {
      total_headlines:       allHeadlines.length,
      tickers_with_signals:  Object.values(tickerResults).filter(t => t.signals_detected.length).length,
      active_market_events:  activeEvents.length,
      top_signals_this_build: topSignals.map(([s, c]) => `${s}(${c})`),
      active_events:         activeEvents.map(e => e.name),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nmarket-news: ${output.total_tickers} tickers  headlines: ${allHeadlines.length}  active events: ${activeEvents.length}`);
  if (topSignals.length) {
    console.log(`Top signals: ${topSignals.map(([s,c]) => `${s}:${c}`).join('  ')}`);
  }
})();
