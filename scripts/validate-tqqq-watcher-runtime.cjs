'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.resolve(root, process.argv[2] || 'index.html');
const html = fs.readFileSync(target, 'utf8');
const errors = [];

for (const marker of [
  'id="tqqq-watcher"',
  'data-observed-at=',
  'data-max-age-minutes=',
  'id="tqqq-watcher-freshness-runtime"',
  'data-tqw-freshness',
  'data-tqw-action',
  'data-tqw-price',
  'data-tqw-gate-status',
  'data-tqw-gate-detail',
  'Observation expired. Refresh market and broker evidence before making a decision.',
  "action.textContent = 'WAIT'",
  "status.textContent = 'STALE'",
  "source.textContent = 'STALE · refresh required'",
]) {
  if (!html.includes(marker)) errors.push(`missing runtime marker: ${marker}`);
}

if (!/ageMinutes\s*>\s*maxAgeMinutes/.test(html)) errors.push('runtime does not enforce the max-age threshold');
if (!/window\.setInterval\(update,\s*30000\)/.test(html)) errors.push('runtime does not recheck freshness every 30 seconds');

if (errors.length) {
  console.error(JSON.stringify({ ok: false, target: path.relative(root, target), errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, target: path.relative(root, target), checks: 15 }));
