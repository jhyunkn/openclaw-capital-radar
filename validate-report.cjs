const fs = require('fs');
const path = require('path');
const input = process.argv[2] || path.join(__dirname, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(input, 'utf8'));
const allowedSignals = ["HOLD","HOLD / WATCH","ADD WATCH","ADD CANDIDATE","TRIM WATCH","TRIM CANDIDATE","EXIT REVIEW","INVESTIGATE","TACTICAL WATCH","SPECULATIVE REVIEW"];
const requiredSections = ['marketRegime','kostolanyCycle','holdings','newsMonitoring','valuationExpectation','rebalance','opportunityScout','riskOfficer','finalOutput'];
const errors = [];
for (const key of requiredSections) if (!state[key]) errors.push('missing ' + key);
if (!Array.isArray(state.holdings) || state.holdings.length < 11) errors.push('expected at least 11 holdings');
for (const h of state.holdings || []) {
  if (!allowedSignals.includes(h.signal)) errors.push('invalid holding signal for ' + h.ticker + ': ' + h.signal);
  for (const key of ['ticker','shares','role','signal','health','thesis','watch','actionRationale']) if (h[key] === undefined || h[key] === '') errors.push('holding ' + (h.ticker || '?') + ' missing ' + key);
}
for (const c of state.opportunityScout?.candidates || []) if (!allowedSignals.includes(c.signal)) errors.push('invalid candidate signal for ' + c.ticker + ': ' + c.signal);
if (state.meta?.dataStatus !== 'SAMPLE_ONLY_REPLACE_BEFORE_USE') console.warn('Notice: dataStatus is not sample-only; verify sources before publishing.');
if (errors.length) { console.error(errors.map(e => '- ' + e).join('\n')); process.exit(1); }
console.log('validation passed:', input);
