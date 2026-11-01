'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'tqqq-watcher-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const errors = [];

const required = ['artifact', 'observedAt', 'stale', 'decision', 'market', 'price', 'zone', 'gates', 'holdings', 'sizing', 'order', 'approval', 'reviewStamp', 'sources'];
for (const key of required) if (!(key in state)) errors.push(`missing ${key}`);
if (!Array.isArray(state.gates) || state.gates.length < 7) errors.push('strategy requires at least seven independently visible gates');
for (const id of ['bottom_zone', 'qqq_vwap', 'tqqq_vwap', 'rising_bars', 'breadth', 'credit', 'risk_veto', 'broker_capacity']) {
  if (!state.gates?.some(gate => gate.id === id)) errors.push(`missing gate ${id}`);
}
if (!Array.isArray(state.sources) || state.sources.length < 3) errors.push('at least three timestamped source families are required');
if (state.stale !== true && !state.fingerprint) errors.push('fresh state requires a material-input fingerprint');
if (state.stale !== true && state.reviewStamp?.status === 'CLEARED' && state.reviewStamp?.fingerprint !== state.fingerprint) errors.push('C clearance fingerprint mismatch');
if (state.order?.state !== 'NONE' && state.approval?.authorized !== true) errors.push('non-NONE order state requires explicit approval');
if (state.market?.status !== 'OPEN' && state.decision?.action !== 'WAIT') errors.push('closed/non-open market must render WAIT');
if (Number(state.sizing?.deployFraction) !== 0.5) errors.push('Agentic entry allocation must remain 50% of available cash');
if (Number(state.policy?.pauseThresholdPct) !== -12) errors.push('pause threshold must remain -12%');

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, gateCount: state.gates.length, sourceCount: state.sources.length }));
