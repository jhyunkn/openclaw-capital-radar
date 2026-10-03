'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'anticipatory', 'anticipatory-entry-state.json');
const ledgerPath = path.join(root, 'outputs', 'anticipatory', 'forecast-ledger.json');
let failures = 0;
const fail = msg => { failures++; console.error(`ANTICIPATORY_VALIDATION_FAIL: ${msg}`); };
const num = v => Number.isFinite(v);
const text = v => typeof v === 'string' && v.trim().length > 0;

if (!fs.existsSync(statePath)) fail('state artifact missing');
if (!fs.existsSync(ledgerPath)) fail('forecast ledger missing');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : {};
if (state.artifact !== 'anticipatory-entry-state') fail('wrong artifact tag');
if (!['PROBE_AVAILABLE', 'UNAVAILABLE'].includes(state.permission)) fail(`invalid permission ${state.permission}`);
if (!Array.isArray(state.candidates)) fail('candidates must be an array');
if (!state.methodology?.caveats?.some(x => /survivorship/i.test(x))) fail('survivorship caveat is mandatory');

for (const c of state.candidates || []) {
  const tag = c.symbol || '(missing)';
  if (!text(c.symbol)) fail('candidate missing symbol');
  if (!['PROBE_ELIGIBLE', 'BLOCKED'].includes(c.state)) fail(`${tag}: invalid state ${c.state}`);
  if (!['LOW', 'MEDIUM'].includes(c.confidence)) fail(`${tag}: confidence must be LOW or MEDIUM`);
  for (const [label, value] of [['entry.low', c.entry?.low], ['entry.high', c.entry?.high], ['entry.referencePrice', c.entry?.referencePrice], ['invalidation.price', c.invalidation?.price], ['target.price', c.target?.price], ['rewardRisk', c.rewardRisk]]) if (!num(value)) fail(`${tag}: ${label} missing`);
  if (!(c.invalidation?.price < c.entry?.referencePrice)) fail(`${tag}: invalidation must be below reference price`);
  if (!(c.target?.price > c.entry?.referencePrice)) fail(`${tag}: target must be above reference price`);
  if (!num(c.calibration?.n) || !num(c.validation?.n)) fail(`${tag}: sample counts missing`);
  if (c.sizing?.action === 'ADD' || c.sizing?.action === 'BUY') fail(`${tag}: anticipatory path must never authorize ADD/BUY`);
  if (!(c.sizing?.maxPortfolioRiskPct <= 0.25)) fail(`${tag}: risk budget exceeds 0.25%`);
  if (c.sizing?.noAddWithoutConfirmation !== true) fail(`${tag}: confirmation boundary missing`);
  if (c.state === 'PROBE_ELIGIBLE') {
    if (c.blockers?.length) fail(`${tag}: eligible candidate has blockers`);
    if (c.calibration.n < 40 || c.validation.n < 15) fail(`${tag}: eligible with insufficient samples`);
    if (c.calibration.pPositive21 < .55 || c.validation.pPositive21 < .52) fail(`${tag}: eligible below probability floor`);
    if (c.rewardRisk < 1.25 || c.invalidation.riskPct > 10) fail(`${tag}: eligible outside reward/risk limits`);
  } else if (!c.blockers?.length) fail(`${tag}: blocked candidate must explain blockers`);
}
const eligible = (state.candidates || []).filter(c => c.state === 'PROBE_ELIGIBLE').length;
if ((state.permission === 'PROBE_AVAILABLE') !== (eligible > 0)) fail('permission does not match eligible count');
if (ledger.artifact !== 'anticipatory-forecast-ledger' || !Array.isArray(ledger.forecasts)) fail('forecast ledger malformed');
for (const f of ledger.forecasts || []) if (!['PENDING', 'SCORED'].includes(f.status)) fail(`ledger ${f.id}: invalid status`);

if (failures) process.exit(1);
console.log(`anticipatory-entry validation passed: candidates=${state.candidates.length} eligible=${eligible} forecasts=${ledger.forecasts.length}`);
