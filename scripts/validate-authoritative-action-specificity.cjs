const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = path.join(root, 'outputs', 'authoritative-action-state.json');
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const seen = new Map();
for (const row of d.actionStates || []) {
  const ticker = row.ticker;
  const levels = row.levels || {};
  const add = levels.addZone || {};
  const trim = levels.trimZone || {};
  const stop = Number(levels.stopReview);
  const hard = Number(levels.hardExit);
  for (const [name, zone] of [['addZone', add], ['trimZone', trim]]) {
    if (!Number.isFinite(Number(zone.low)) || !Number.isFinite(Number(zone.high))) errors.push(`${ticker}: ${name} missing numeric low/high`);
    if (Number(zone.low) <= 0 || Number(zone.high) <= 0) errors.push(`${ticker}: ${name} has non-positive levels`);
    if (Number(zone.low) === Number(zone.high)) errors.push(`${ticker}: ${name} collapsed to single price; needs ticker-specific range or explicit unavailable state`);
  }
  if (!Number.isFinite(stop) || stop <= 0) errors.push(`${ticker}: stopReview missing/non-positive`);
  if (!Number.isFinite(hard) || hard <= 0) errors.push(`${ticker}: hardExit missing/non-positive`);
  const sig = JSON.stringify({ addLow:add.low, addHigh:add.high, trimLow:trim.low, trimHigh:trim.high, stop:levels.stopReview, hard:levels.hardExit });
  if (seen.has(sig)) errors.push(`${ticker}: duplicates exact level set used by ${seen.get(sig)}`);
  seen.set(sig, ticker);
  if (!levels.volatility || !levels.volatility.formula) errors.push(`${ticker}: missing volatility formula/source for levels`);
}
const result = { ok: errors.length === 0, errors, checkedAt: new Date().toISOString(), checked: (d.actionStates || []).length };
const out = path.join(root, 'outputs', 'authoritative-action-state-validation.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
if (!result.ok) { console.error(JSON.stringify(result, null, 2)); process.exit(1); }
console.log(JSON.stringify(result, null, 2));
