'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const out  = path.join(root, 'outputs', 'news-catalyst-state.json');

// ── Tickers to scan ──────────────────────────────────────────────────────────
const HOLDINGS   = ['MSFT','AMZN','CEG','META','TSLT','CONL','SPY','MA','BMNR','TSNF','NFLX'];
const CANDIDATES = ['RDDT','RKLB','NXT','ETN','GOOGL','PWR','GEV','TMDX','NVDA','AVGO','CCJ','PLTR','VRT','IBIT','OKLO','HIMS'];
const ALL_TICKERS = [...new Set([...HOLDINGS, ...CANDIDATES])];

// ── Materiality keyword rules ────────────────────────────────────────────────
// Score 8-10: can influence promotion decisions (hard evidence of material change)
// Score 5-7:  background context only
// Score 1-4:  noise / general market commentary
const HIGH_SIGNALS = [
  { pattern: /earnings?\s+(beat|miss|surprise|shock|blow|topped?|exceed)/i,        signal: 'earnings_surprise' },
  { pattern: /\b(eps|earnings\s+per\s+share)\s+(beat|miss|exceed|surpass|below)/i,  signal: 'eps_beat_miss' },
  { pattern: /revenue\s+(beat|miss|fell|surge|grew|decline)/i,                      signal: 'revenue_surprise' },
  { pattern: /guidance\s+(raised?|cut|lower|withdraw|suspended?|improved?)/i,        signal: 'guidance_change' },
  { pattern: /\b(ceo|cfo|cto|coo|chairman)\s+(resign|depart|fire|terminat|step)/i,  signal: 'executive_change' },
  { pattern: /\b(acqui|merger|takeover|buyout|going\s+private|leveraged\s+buyout)\b/i, signal: 'ma_event' },
  { pattern: /\bdividend\s+(cut|suspend|eliminat|halt|reduce|special|increase)/i,    signal: 'dividend_action' },
  { pattern: /\b(bankruptcy|chapter\s+11|chapter\s+7|insolvent|receivership)\b/i,    signal: 'bankruptcy' },
  { pattern: /\bFDA\s+(approv|appli|appro|reject|refus|complet|clear|accept)/i,      signal: 'fda_decision' },
  { pattern: /\bSEC\s+(investigat|subpoena|charge|enforcement|sanction|fine)\b/i,    signal: 'sec_action' },
  { pattern: /\b(regulat\w+\s+approv|regulat\w+\s+reject|consent\s+order)\b/i,       signal: 'regulatory_decision' },
  { pattern: /\b(restatement|restated|accounting\s+error|material\s+weakness)\b/i,   signal: 'restatement' },
  { pattern: /\b(reverse\s+split|stock\s+split|delisting|delist)\b/i,               signal: 'corporate_action' },
  { pattern: /\b(activist\s+investor|activist\s+stake|short\s+seller)\b/i,           signal: 'activist' },
  { pattern: /\b(layoffs?|mass\s+layoffs?|restructur\w+|headcount\s+reduction)\b/i,  signal: 'restructuring' },
  { pattern: /\bmajor\s+(contract|deal|order|win)\b/i,                               signal: 'contract_win' },
];

const MEDIUM_SIGNALS = [
  { pattern: /analyst\s+(upgrade|downgrade|initiat)/i,                              signal: 'analyst_rating' },
  { pattern: /price\s+target\s+(raise|cut|lower|increase|decreas)/i,                signal: 'price_target' },
  { pattern: /\b(partnership|collaborat|joint\s+venture|licensing\s+agreement)\b/i, signal: 'partnership' },
  { pattern: /\b(product\s+launch|new\s+product|introduced?)\b/i,                   signal: 'product_launch' },
  { pattern: /\b(market\s+share|expansion|new\s+market|enter\w+\s+market)\b/i,      signal: 'market_position' },
  { pattern: /\b(backlog|order\s+book|bookings?)\b/i,                               signal: 'backlog_update' },
  { pattern: /\b(margin\s+expand|margin\s+compress|gross\s+margin)\b/i,             signal: 'margin_signal' },
  { pattern: /earnings?\s+(preview|estimate|expect)/i,                              signal: 'earnings_preview' },
];

function scoreMateriality(headline) {
  const signals = [];
  let score = 1;

  for (const { pattern, signal } of HIGH_SIGNALS) {
    if (pattern.test(headline)) { signals.push(signal); score = Math.max(score, 8); }
  }
  if (score < 8) {
    for (const { pattern, signal } of MEDIUM_SIGNALS) {
      if (pattern.test(headline)) { signals.push(signal); score = Math.max(score, 5); }
    }
  }

  const tier = score >= 8 ? 'HIGH' : score >= 5 ? 'MEDIUM' : 'LOW';
  return { score, tier, signals };
}

// ── RSS fetch + parse ────────────────────────────────────────────────────────
function fetchRss(ticker) {
  return new Promise(resolve => {
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'CapitalRadar/1.0 jun.hn.nam@gmail.com', 'Accept': 'application/rss+xml, application/xml, text/xml' },
      timeout: 12000
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function parseRssItems(xml, ticker) {
  const items = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const block of itemMatches.slice(0, 8)) {
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   block.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const link  = (block.match(/<link>([\s\S]*?)<\/link>/)   || [])[1];
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
    if (!title) continue;
    const headline = title.trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
    let published_at = null;
    if (pubDate) {
      const d = new Date(pubDate.trim());
      if (!isNaN(d)) published_at = d.toISOString();
    }
    items.push({ ticker, headline, published_at, url: (link||'').trim(), source: 'Yahoo Finance RSS' });
  }
  return items;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  const rawItems = [];
  const errors   = [];

  console.log(`news-catalyst: scanning ${ALL_TICKERS.length} tickers via Yahoo Finance RSS`);

  for (const ticker of ALL_TICKERS) {
    try {
      const xml = await fetchRss(ticker);
      const parsed = parseRssItems(xml, ticker);
      rawItems.push(...parsed);
      process.stdout.write(parsed.length > 0 ? '.' : 'x');
    } catch (e) {
      errors.push({ ticker, error: e.message });
      process.stdout.write('!');
    }
    await delay(150); // respect Yahoo rate limits
  }
  console.log();

  // Deduplicate by headline + ticker
  const seen = new Set();
  const deduped = rawItems.filter(item => {
    const key = `${item.ticker}::${item.headline.toLowerCase().slice(0,80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Score and classify
  const items = deduped.map(item => {
    const { score, tier, signals } = scoreMateriality(item.headline);
    return {
      ...item,
      materiality_score: score,
      materiality_tier: tier,
      materiality_signals: signals,
      can_influence_promotion: score >= 8,
      is_holding: HOLDINGS.includes(item.ticker),
      is_candidate: CANDIDATES.includes(item.ticker)
    };
  });

  // Sort: high materiality first, then by publish date desc
  items.sort((a, b) => {
    if (b.materiality_score !== a.materiality_score) return b.materiality_score - a.materiality_score;
    return new Date(b.published_at || 0) - new Date(a.published_at || 0);
  });

  const high   = items.filter(x => x.materiality_score >= 8);
  const medium = items.filter(x => x.materiality_score >= 5 && x.materiality_score < 8);
  const low    = items.filter(x => x.materiality_score < 5);
  const tickersWithNews = new Set(items.map(x => x.ticker));

  const state = {
    artifact: 'news-catalyst-state',
    scanned_at: now,
    source_label: 'Yahoo Finance RSS',
    source_id: 'yahoo-finance-rss-news',
    stale_after_hours: 6,
    tickers_scanned: ALL_TICKERS,
    tickers_with_news: [...tickersWithNews],
    items,
    summary: {
      total_items: items.length,
      high_materiality: high.length,
      medium_materiality: medium.length,
      low_materiality: low.length,
      can_influence_promotion: high.length,
      tickers_with_news: tickersWithNews.size,
      errors: errors.length
    },
    operationalGates: {
      hasLiveNews: items.length > 0,
      hasHighMaterialityItems: high.length > 0,
      promotionGatingActive: true,
      promotionThreshold: 'materiality_score >= 8 required to count as primary evidence',
      canClaimFreshNewsCausality: high.length > 0
    },
    promotionRule: 'Only items with materiality_score >= 8 (HIGH tier) can support candidate promotion. MEDIUM/LOW items are research context only, not promotion evidence.',
    errors
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n');
  console.log(`news-catalyst: ${items.length} items | HIGH=${high.length} MEDIUM=${medium.length} LOW=${low.length} | can_promote=${high.length} | errors=${errors.length}`);
  console.log(`wrote ${path.relative(root, out)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
