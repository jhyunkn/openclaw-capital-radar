#!/usr/bin/env node
// Fail-closed validator for outputs/narrative-reality-brief.json.
// The brief is worker-written each refresh; this gates the commit/deploy on
// schema completeness AND freshness. Exit 0 = OK, exit 1 = invalid (blocks).
const fs = require('fs');
const path = require('path');

const P = path.join(__dirname, '..', 'outputs', 'narrative-reality-brief.json');
const fail = (msg) => { console.error('NARRATIVE_BRIEF_INVALID: ' + msg); process.exit(1); };

let b;
try {
  b = JSON.parse(fs.readFileSync(P, 'utf8'));
} catch (e) {
  fail('unparseable JSON: ' + e.message);
}

// Freshness: brief must have been written within the last 12h (a stale brief
// must never ride a fresh deploy).
const gen = Date.parse(b.generatedAt);
if (!gen) fail('missing or invalid generatedAt');
if (Date.now() - gen > 12 * 3600 * 1000) fail('stale generatedAt: ' + b.generatedAt);
if (Date.now() - gen < -3600 * 1000) fail('generatedAt is in the future: ' + b.generatedAt);

if (!b.generatedBy || typeof b.generatedBy !== 'string') fail('missing generatedBy');

const themes = b.themes;
if (!Array.isArray(themes) || themes.length < 3 || themes.length > 5) {
  fail('themes must be an array of 3-5, got ' + (Array.isArray(themes) ? themes.length : typeof themes));
}
const CLS = new Set(['NARRATIVE_AHEAD', 'DATA_AHEAD', 'ALIGNED']);
themes.forEach((t, i) => {
  for (const f of ['id', 'label', 'narrative', 'dataAnchor', 'counterRead', 'relevantTickers', 'watchFor']) {
    if (t[f] === undefined || t[f] === null || t[f] === '') fail(`themes[${i}] missing ${f}`);
  }
  if (!CLS.has(t.classification)) fail(`themes[${i}] bad classification: ${t.classification}`);
  if (!Array.isArray(t.relevantTickers) || t.relevantTickers.length === 0) {
    fail(`themes[${i}] relevantTickers must be a non-empty array`);
  }
});

for (const f of ['strategyPosture', 'whereWaveBuilds']) {
  if (!b[f] || typeof b[f] !== 'string') fail('missing ' + f);
}
if (!Array.isArray(b.watchFor) || b.watchFor.length < 3 || b.watchFor.length > 5) {
  fail('watchFor must be an array of 3-5, got ' + (Array.isArray(b.watchFor) ? b.watchFor.length : typeof b.watchFor));
}

console.log(`NARRATIVE_BRIEF_OK: themes=${themes.length} generatedAt=${b.generatedAt}`);
