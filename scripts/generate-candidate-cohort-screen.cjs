'use strict';
// Screens XBRL fundamentals + live prices for NOW-profile candidates:
// profitable, growing 15%+, trading at a reasonable FCF multiple.
// Run: node scripts/generate-candidate-cohort-screen.cjs

const fs   = require('fs');
const path = require('path');

const root        = path.join(__dirname, '..');
const xbrlPath    = path.join(root, 'outputs', 'sec-xbrl-fundamentals.json');
const statePath   = path.join(root, 'data', 'report-state.live.json');
const outPath     = path.join(root, 'outputs', 'candidate-cohort-screen.json');

function round(n, d = 1) { return typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : null; }

function nowScore(g) {
  // Higher score = closer to the NOW profile (profitable, growing, reasonable valuation)
  let score = 0;
  if (g.fcf_usd_millions > 0) score += 30;                      // must be FCF positive
  if (g.revenue_growth_pct >= 20) score += 25;
  else if (g.revenue_growth_pct >= 15) score += 15;
  else if (g.revenue_growth_pct >= 10) score += 5;
  if (g.p_fcf != null && g.p_fcf > 0) {
    if (g.p_fcf <= 20) score += 25;
    else if (g.p_fcf <= 30) score += 20;
    else if (g.p_fcf <= 40) score += 12;
    else if (g.p_fcf <= 60) score += 5;
  }
  if (g.gross_margin_pct >= 60) score += 10;
  else if (g.gross_margin_pct >= 40) score += 5;
  if (g.dilution_flag === 'low') score += 5;
  else if (g.dilution_flag === 'high') score -= 10;
  return Math.min(100, score);
}

function profileLabel(score) {
  if (score >= 75) return 'STRONG NOW-PROFILE';
  if (score >= 55) return 'NOW-PROFILE';
  if (score >= 35) return 'WATCH';
  return 'DOES NOT FIT';
}

function main() {
  if (!fs.existsSync(xbrlPath)) {
    console.error(`XBRL file not found: ${xbrlPath}`);
    console.error('Run: npm run collect:xbrl');
    process.exit(1);
  }
  if (!fs.existsSync(statePath)) {
    console.error(`Live state not found: ${statePath}`);
    process.exit(1);
  }

  const xbrl  = JSON.parse(fs.readFileSync(xbrlPath, 'utf8'));
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

  // Build price map from live state market tape
  const priceMap = {};
  const tape = Array.isArray(state.liveMarket) ? state.liveMarket : [];
  for (const q of tape) {
    if (q.symbol && q.price != null) priceMap[q.symbol] = q.price;
  }
  // Also check holdings for prices
  const holdings = Array.isArray(state.holdings) ? state.holdings : [];
  for (const h of holdings) {
    if (h.ticker && h.livePrice != null) priceMap[h.ticker] = h.livePrice;
  }

  const results = [];

  for (const r of (xbrl.results || [])) {
    if (r.status !== 'ok' && r.status !== 'thin') continue;
    const f = r.fundamentals || {};
    if (!f.revenue_ttm_usd_millions) continue;

    const price  = priceMap[r.ticker] ?? null;
    const shares = f.shares_outstanding_millions ?? null;
    const fcf    = f.fcf_usd_millions ?? null;

    const marketCapM = price != null && shares != null ? price * shares : null;
    const pFcf = marketCapM != null && fcf != null && fcf > 0
      ? round(marketCapM / fcf, 1)
      : null;

    const enriched = {
      ticker:              r.ticker,
      name:                r.entityName || r.ticker,
      revenue_ttm_m:       round(f.revenue_ttm_usd_millions, 0),
      revenue_growth_pct:  round(f.revenue_growth_pct, 1),
      fcf_m:               fcf != null ? round(fcf, 0) : null,
      gross_margin_pct:    round(f.gross_margin_pct, 1),
      shares_m:            shares,
      price:               price,
      market_cap_m:        marketCapM != null ? round(marketCapM, 0) : null,
      p_fcf:               pFcf,
      dilution_flag:       f.dilution_flag || null,
    };

    enriched.now_score   = nowScore(enriched);
    enriched.now_profile = profileLabel(enriched.now_score);
    results.push(enriched);
  }

  results.sort((a, b) => b.now_score - a.now_score);

  const output = {
    generated_at:    new Date().toISOString(),
    note:            'NOW-profile screen: profitable FCF, 15%+ revenue growth, reasonable P/FCF multiple. Higher score = closer to the NOW profile at its entry point (23x FCF, 21% growth).',
    profile_tiers: {
      STRONG_NOW_PROFILE: 'score >= 75: strong fit',
      NOW_PROFILE:        'score 55-74: fits the profile',
      WATCH:              'score 35-54: partial fit, watch for improvement',
      DOES_NOT_FIT:       'score < 35: does not fit NOW profile criteria'
    },
    results,
    missing_price: results.filter(r => r.price == null).map(r => r.ticker),
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  // Print summary table
  console.log('\nNOW-Profile Cohort Screen');
  console.log('─'.repeat(90));
  console.log(
    'Ticker'.padEnd(8) +
    'Revenue$M'.padStart(10) + 'Growth%'.padStart(9) + 'FCF$M'.padStart(8) +
    'MktCap$M'.padStart(10) + 'P/FCF'.padStart(7) + 'Margin%'.padStart(9) +
    'Score'.padStart(7) + '  Profile'
  );
  console.log('─'.repeat(90));
  for (const r of results) {
    const line =
      r.ticker.padEnd(8) +
      String(r.revenue_ttm_m ?? 'n/a').padStart(10) +
      String(r.revenue_growth_pct ?? 'n/a').padStart(9) +
      String(r.fcf_m ?? 'n/a').padStart(8) +
      String(r.market_cap_m ?? 'n/a').padStart(10) +
      String(r.p_fcf ?? 'n/a').padStart(7) +
      String(r.gross_margin_pct ?? 'n/a').padStart(9) +
      String(r.now_score).padStart(7) +
      '  ' + r.now_profile;
    console.log(line);
  }
  console.log('─'.repeat(90));
  console.log(`\nWrote ${path.relative(root, outPath)}`);
  if (output.missing_price.length) {
    console.log(`Missing live price (market cap unavailable): ${output.missing_price.join(', ')}`);
    console.log('Run npm run generate:live to refresh prices.');
  }
}

main();
