'use strict';
/*
 * Earnings-date feed: Nasdaq's public earnings calendar (api.nasdaq.com/api/calendar/earnings),
 * one request per trading day from 7 days back to ~9 weeks ahead. Writes
 * data/cache/earnings-calendar.json, read through scripts/lib/earnings.cjs.
 *
 * Fail-soft: if more than a fifth of the days fail, the previous cache is kept and the build
 * continues — readers then treat a cache older than 7 days as unknown (never guessed).
 */
const fs = require('fs');
const path = require('path');
const { isTradingDay, nyParts } = require('./lib/market-session.cjs');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'data', 'cache', 'earnings-calendar.json');
const BACK_DAYS = 7;
const AHEAD_DAYS = 63;
const CONCURRENCY = 4;

const TIME = { 'time-pre-market': 'BMO', 'time-after-hours': 'AMC', 'time-not-supplied': null };

function tradingDates() {
  const out = [];
  const now = Date.now();
  for (let d = -BACK_DAYS; d <= AHEAD_DAYS; d++) {
    const { date, weekday } = nyParts(now + d * 86_400_000);
    if (isTradingDay(date, weekday)) out.push(date);
  }
  return out;
}

async function fetchDay(date) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) CapitalRadar/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json?.data?.rows || []).map(row => ({
        symbol: String(row.symbol || '').toUpperCase().replace('.', '-'),
        date,
        time: TIME[row.time] ?? null,
        epsForecast: row.epsForecast && row.epsForecast !== 'N/A' ? row.epsForecast : null,
        fiscalQuarterEnding: row.fiscalQuarterEnding || null,
      })).filter(row => row.symbol);
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  return [];
}

async function main() {
  const dates = tradingDates();
  const rows = [];
  const failed = [];
  for (let i = 0; i < dates.length; i += CONCURRENCY) {
    const batch = dates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchDay));
    results.forEach((r, j) => (r.status === 'fulfilled' ? rows.push(...r.value) : failed.push(`${batch[j]}: ${r.reason?.message || r.reason}`)));
  }
  if (failed.length > dates.length / 5) {
    console.warn(`fetch-earnings-calendar: ${failed.length}/${dates.length} days failed — keeping previous cache. First: ${failed[0]}`);
    return;
  }
  const bySymbol = {};
  for (const row of rows) (bySymbol[row.symbol] ||= []).push({ date: row.date, time: row.time, epsForecast: row.epsForecast, fiscalQuarterEnding: row.fiscalQuarterEnding });
  for (const list of Object.values(bySymbol)) list.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(outPath, JSON.stringify({
    artifact: 'earnings-calendar-cache',
    source: 'Nasdaq earnings calendar (api.nasdaq.com/api/calendar/earnings)',
    generatedAt: new Date().toISOString(),
    windowStart: dates[0],
    windowEnd: dates[dates.length - 1],
    daysFetched: dates.length - failed.length,
    daysFailed: failed,
    symbolCount: Object.keys(bySymbol).length,
    bySymbol,
  }));
  console.log(`fetch-earnings-calendar: ${rows.length} reports for ${Object.keys(bySymbol).length} symbols over ${dates[0]}..${dates[dates.length - 1]} (${failed.length} day(s) failed)`);
}

main().catch(err => { console.warn(`fetch-earnings-calendar: ${err.message} — keeping previous cache`); });
