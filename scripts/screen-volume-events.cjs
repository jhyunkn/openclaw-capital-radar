'use strict';

/*
 * screen-volume-events.cjs (one-off, ephemeral)
 *
 * Implements the two-condition screen from the video:
 *   1) Within the last month (~22 trading days), a single day's volume >= 3x
 *      the mean volume of the 20 trading days before it.
 *   2) On that same day, |daily return| <= 3% (big volume, price barely moved).
 *
 * Mechanical-date flag: 2026-09-18 was the S&P quarterly rebalance +
 * triple-witching — volume spikes that day are plumbing, not accumulation.
 *
 * Input : outputs/cache/volume-screen/history.json
 * Output: outputs/cache/volume-screen/events.json (ephemeral, gitignored)
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const inPath = path.join(root, 'outputs', 'cache', 'volume-screen', 'history.json');
const outPath = path.join(root, 'outputs', 'cache', 'volume-screen', 'events.json');

const EVENT_WINDOW = 22;   // last month in trading days
const BASELINE_WINDOW = 20;
const VOL_RATIO = 3.0;
const MAX_ABS_RET = 0.03;
const MECHANICAL_DATES = new Set(['2026-09-18']); // S&P rebalance + triple witching

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

function run() {
  const { fetchedAt, bars: all } = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const results = [];

  for (const [symbol, rawBars] of Object.entries(all)) {
    const bars = [...rawBars].sort((a, b) => a.date < b.date ? -1 : 1);
    if (bars.length < EVENT_WINDOW + BASELINE_WINDOW + 1) continue;

    const lastDate = bars[bars.length - 1].date;
    const windowBars = bars.slice(-EVENT_WINDOW);
    const events = [];

    for (const bar of windowBars) {
      const idx = bars.indexOf(bar);
      if (idx < BASELINE_WINDOW + 1) continue;
      const baseline = bars.slice(idx - BASELINE_WINDOW, idx);
      const vol20 = mean(baseline.map(b => b.volume));
      if (!(vol20 > 0)) continue;
      const ratio = bar.volume / vol20;
      const prevClose = bars[idx - 1].close;
      const ret = bar.close / prevClose - 1;
      if (ratio >= VOL_RATIO && Math.abs(ret) <= MAX_ABS_RET) {
        events.push({
          date: bar.date,
          ratio: Math.round(ratio * 100) / 100,
          retPct: Math.round(ret * 10000) / 100,
          close: bar.close,
          volume: bar.volume,
          avg20Vol: Math.round(vol20),
          mechanical: MECHANICAL_DATES.has(bar.date),
        });
      }
    }

    if (events.length) {
      const latest = events[events.length - 1];
      results.push({
        symbol,
        lastDataDate: lastDate,
        eventCount: events.length,
        latest,
        cleanLatest: [...events].reverse().find(e => !e.mechanical) || null,
        events,
      });
    }
  }

  // Rank: most recent CLEAN event first, then by volume ratio
  const ranked = [...results].sort((a, b) => {
    const da = a.cleanLatest ? a.cleanLatest.date : '0000';
    const db = b.cleanLatest ? b.cleanLatest.date : '0000';
    if (da !== db) return da < db ? 1 : -1;
    const ra = a.cleanLatest ? a.cleanLatest.ratio : 0;
    const rb = b.cleanLatest ? b.cleanLatest.ratio : 0;
    return rb - ra;
  });

  fs.writeFileSync(outPath, JSON.stringify({
    screenedAt: new Date().toISOString(),
    fetchedAt,
    params: { EVENT_WINDOW, BASELINE_WINDOW, VOL_RATIO, MAX_ABS_RET },
    matchCount: results.length,
    ranked,
  }, null, 1));

  console.log(`matches: ${results.length}/${Object.keys(all).length}`);
  console.log('top 15 (clean events only):');
  ranked.slice(0, 15).forEach(r => {
    const e = r.cleanLatest;
    if (!e) return;
    console.log(`  ${r.symbol}  ${e.date}  ${e.ratio}x vol  ${e.retPct >= 0 ? '+' : ''}${e.retPct}%  close ${e.close}`);
  });
}

run();
