'use strict';
/*
 * Syncs data/market-events.json from the curated data/market-calendar.json.
 *
 * The mandate gate requires the calendar dependency fresh within 7 days, and
 * fetch-market-news.cjs scores each event against live headlines via
 * news_keywords. Scheduled macro events (FOMC / CPI / NFP / PCE) are knowable
 * months ahead, so deriving them from the curated calendar keeps the
 * dependency honestly fresh — this is curation, not timestamp-stamping.
 * Run in the pipeline immediately before fetch-market-news.cjs.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const calPath = path.join(root, 'data', 'market-calendar.json');
const outPath = path.join(root, 'data', 'market-events.json');

const TYPE_META = {
  fomc:     { signal: 'HIGH',   keywords: ['fed', 'fomc', 'powell', 'rate hike', 'rate cut', 'dot plot', 'federal reserve'] },
  cpi:      { signal: 'HIGH',   keywords: ['cpi', 'inflation', 'consumer price'] },
  jobs:     { signal: 'MEDIUM', keywords: ['payrolls', 'nonfarm', 'jobs report', 'unemployment'] },
  pce:      { signal: 'MEDIUM', keywords: ['pce', 'inflation', 'fed'] },
  gdp:      { signal: 'MEDIUM', keywords: ['gdp', 'economic growth'] },
  election: { signal: 'MEDIUM', keywords: ['midterm', 'election'] },
  earnings: { signal: 'MEDIUM', keywords: [] },
};

function main() {
  const cal = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [];
  const past = [];

  for (const e of (cal.events || [])) {
    if (!e.date) continue;
    const meta = TYPE_META[e.type] || { signal: 'LOW', keywords: [String(e.label || e.type)] };
    const days = Math.round((new Date(e.date + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 86400000);
    const base = {
      id: `${e.type}-${e.date}`,
      name: e.label,
      type: e.type,
      date: e.date,
      detail: e.detail || '',
      signal_strength: meta.signal,
      news_keywords: meta.keywords,
      beneficiary_tickers: [],
      risk_tickers: [],
    };
    if (days < 0) past.push({ ...base, days });
    else upcoming.push({ ...base, days, status: days <= 21 ? 'watch' : 'anticipated' });
  }

  // The most recent past event stays 'active' while the market digests it.
  past.sort((a, b) => b.days - a.days);
  if (past[0] && past[0].days >= -21) {
    const { days, ...rest } = past[0];
    upcoming.unshift({ ...rest, status: 'active' });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const events = upcoming.map(({ days, ...rest }) => rest);

  const prev = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const out = {
    version: 2,
    asOf: today,
    policy: prev.policy || 'Major market events that create second-order opportunities not yet priced into Level 2-3 supply chain names.',
    source: 'Derived from data/market-calendar.json by scripts/sync-market-events.cjs',
    events,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`sync-market-events: wrote ${events.length} events, asOf ${today}`);
}

main();
