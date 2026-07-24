'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`RANKING_INTEGRITY_FAIL: ${message}`);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fail(`missing ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`invalid JSON ${rel}: ${error.message}`);
    return null;
  }
}
function arr(value) {
  return Array.isArray(value) ? value : [];
}
function checkUnique(label, rows) {
  const counts = new Map();
  for (const row of rows) {
    const ticker = String(row?.ticker || '').trim().toUpperCase();
    if (!ticker) fail(`${label}: row missing ticker`);
    counts.set(ticker, (counts.get(ticker) || 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length) fail(`${label}: duplicate tickers ${duplicates.map(([ticker, count]) => `${ticker}x${count}`).join(', ')}`);
}

const candidate = read('outputs/candidate-ranking.json');
if (candidate) {
  checkUnique('candidate-ranking.ranked', arr(candidate.ranked));
  if (candidate.summary?.total !== arr(candidate.ranked).length) fail(`candidate-ranking: summary.total=${candidate.summary?.total} but ranked=${arr(candidate.ranked).length}`);
  if (candidate.summary?.tier_a !== arr(candidate.tier_a).length) fail(`candidate-ranking: tier_a summary mismatch`);
  if (candidate.summary?.duplicates_removed == null) fail('candidate-ranking: summary.duplicates_removed missing');
  for (const row of arr(candidate.ranked)) {
    if (/Index Ballast|Streaming|AI Compute Expansion/.test(String(row.macro_theme || ''))) {
      fail(`candidate-ranking: ${row.ticker} has stale/generic macro_theme "${row.macro_theme}"`);
    }
  }
}

const conviction = read('outputs/conviction-ranking.json');
if (conviction) {
  checkUnique('conviction-ranking.ranked', arr(conviction.ranked));
  for (const row of arr(conviction.ranked)) {
    if (!row.technical_confirmation?.status) fail(`conviction-ranking: ${row.ticker} missing technical_confirmation`);
    if (/verify thesis before sizing/i.test(String(row.action_permission || '')) && row.technical_confirmation?.status === 'NO_BOTTOM_CONFIRMATION') {
      fail(`conviction-ranking: ${row.ticker} allows sizing language despite no bottom confirmation`);
    }
  }
}

const triple = read('outputs/triple-alignment-state.json');
if (triple) {
  checkUnique('triple-alignment.aligned', arr(triple.aligned));
  checkUnique('triple-alignment.near_miss', arr(triple.near_miss));
  for (const row of arr(triple.aligned)) {
    const notes = arr(row.detail?.momentum).join(' ');
    if (/falling dislocation/i.test(notes)) fail(`triple-alignment: ${row.ticker} aligned despite falling dislocation`);
  }
}

if (failed) process.exit(1);
console.log('RANKING_INTEGRITY_OK');
