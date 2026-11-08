'use strict';
// Reader for data/cache/earnings-calendar.json (written by fetch-earnings-calendar.cjs).
// Returns a sourced fact or 'unknown' — never an estimate.
const fs = require('fs');
const path = require('path');

const MAX_CACHE_AGE_DAYS = 7;
let cache;
function load() {
  if (cache !== undefined) return cache;
  try {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'cache', 'earnings-calendar.json'), 'utf8'));
    const ageDays = (Date.now() - Date.parse(json.generatedAt)) / 86_400_000;
    cache = ageDays <= MAX_CACHE_AGE_DAYS ? json : null;
  } catch { cache = null; }
  return cache;
}

function todayIso() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000); }

// { status: 'scheduled', date, time, daysAway, epsForecast, source, asOf }
// { status: 'none_in_window', windowEnd, lastReported, source, asOf }
// 'unknown' when the feed is missing or stale.
function earningsFor(symbol) {
  const c = load();
  if (!c) return 'unknown';
  const sym = String(symbol || '').toUpperCase();
  const list = c.bySymbol[sym] || [];
  const today = todayIso();
  const next = list.find(r => r.date >= today);
  const last = [...list].reverse().find(r => r.date < today) || null;
  const base = { source: c.source, asOf: c.generatedAt };
  if (next) return { status: 'scheduled', date: next.date, time: next.time, daysAway: daysBetween(today, next.date), epsForecast: next.epsForecast, ...base };
  return { status: 'none_in_window', windowEnd: c.windowEnd, lastReported: last ? last.date : null, ...base };
}

function formatEarnings(e, { short = false } = {}) {
  if (!e || e === 'unknown') return short ? 'earnings date unknown' : 'Earnings date unknown (feed unavailable; never guessed)';
  if (e.status === 'scheduled') {
    const d = new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return `earnings ${d}${e.time ? ` ${e.time}` : ''} (${e.daysAway === 0 ? 'today' : `in ${e.daysAway}d`})`;
  }
  const end = new Date(`${e.windowEnd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return e.lastReported ? `reported ${e.lastReported.slice(5).replace('-', '/')} · next not before ${end}` : `no earnings before ${end}`;
}

// Funds, leveraged ETFs and coins have no earnings of their own; showing "no earnings before
// <date>" for them would read as information.
const NO_EARNINGS = new Set(['SPY', 'QQQ', 'IAU', 'GLD', 'SLV', 'SIVR', 'TQQQ', 'SQQQ', 'SOXL', 'TSLT', 'CONL', 'NVDL', 'DOGE', 'BTC', 'ETH', 'SOL']);
function hasEarnings(symbol) { return !NO_EARNINGS.has(String(symbol || '').toUpperCase()); }

module.exports = { earningsFor, formatEarnings, hasEarnings };
