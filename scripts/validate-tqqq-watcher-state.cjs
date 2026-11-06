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
// Stale-flag consistency: the flag must agree with observation age. A state
// whose observedAt is older than maxAgeMinutes is stale whether or not the
// gateway declared it — a stale:false on an old observation is a lie the
// renderer would otherwise have to correct at display time.
const maxAge = Number(state.maxAgeMinutes) > 0 ? Number(state.maxAgeMinutes) : 20;
const observedMs = state.observedAt ? new Date(state.observedAt).getTime() : NaN;
if (!Number.isFinite(observedMs)) {
  if (state.stale !== true) errors.push('observedAt is missing or unparsable but stale is not true');
} else if ((Date.now() - observedMs) / 60000 > maxAge && state.stale !== true) {
  errors.push(`observedAt is ${Math.round((Date.now() - observedMs) / 60000)}m old (max ${maxAge}m) but stale is not true — stale flag is inconsistent with observation age`);
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, gateCount: state.gates.length, sourceCount: state.sources.length }));
