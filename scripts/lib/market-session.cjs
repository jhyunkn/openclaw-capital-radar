'use strict';
// US equity regular-session clock (America/New_York, 9:30–16:00, weekdays minus NYSE
// full-day closures). Used so freshness gates measure staleness in market time: a
// Friday-close quote read on Sunday is as current as a quote can be.
const fs = require('fs');
const path = require('path');

const holidays = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'market-holidays.json'), 'utf8'));
    return new Set(cfg.closures || []);
  } catch { return new Set(); }
})();

function nyParts(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(new Date(ms));
  const get = type => parts.find(p => p.type === type).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: get('weekday') };
}

function isTradingDay(dateIso, weekday) {
  return weekday !== 'Sat' && weekday !== 'Sun' && !holidays.has(dateIso);
}

// Epoch ms of the most recent regular-session close at or before `nowMs`.
function lastSessionClose(nowMs = Date.now()) {
  for (let back = 0; back < 10; back++) {
    // Probe a day at a time; 16:00 ET is 20:00 or 21:00 UTC depending on DST.
    const probe = nowMs - back * 86_400_000;
    const { date, weekday, minutes } = nyParts(probe);
    if (!isTradingDay(date, weekday)) continue;
    if (back === 0 && minutes < 16 * 60) continue;
    for (const utcHour of [20, 21]) {
      const candidate = Date.parse(`${date}T${String(utcHour).padStart(2, '0')}:00:00Z`);
      const p = nyParts(candidate);
      if (p.date === date && p.minutes === 16 * 60) return candidate;
    }
  }
  return null;
}

function isMarketOpen(nowMs = Date.now()) {
  const { date, weekday, minutes } = nyParts(nowMs);
  return isTradingDay(date, weekday) && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

module.exports = { lastSessionClose, isMarketOpen, isTradingDay, nyParts };
