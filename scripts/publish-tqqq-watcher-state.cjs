'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/publish-tqqq-watcher-state.cjs <payload.json>');
const payload = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
// Recompute the stale flag from observation age BEFORE fingerprinting.
// The gateway's declared `stale` is a claim, not a measurement: a payload
// whose observedAt is older than maxAgeMinutes is stale whether or not the
// gateway said so. The state file is read by the validator, the renderer,
// and the fingerprint, so fixing it here fixes all consumers. This changes
// only the flag (and a staleReason), never price, gates, or the decision.
const maxAge = Number(payload.maxAgeMinutes) > 0 ? Number(payload.maxAgeMinutes) : 20;
const observedMs = payload.observedAt ? new Date(payload.observedAt).getTime() : NaN;
const ageMinutes = Number.isFinite(observedMs) ? (Date.now() - observedMs) / 60000 : Infinity;
const ageStale = !Number.isFinite(ageMinutes) || ageMinutes > maxAge;
if (ageStale && payload.stale !== true) {
  payload.stale = true;
  payload.staleReason = !payload.observedAt
    ? 'No observation timestamp on file.'
    : `Observation is ${Math.round(ageMinutes)}m old (max ${maxAge}m).`;
}
const material = {
  stale: payload.stale === true,
  market: payload.market,
  decision: payload.decision,
  price: payload.price,
  zone: payload.zone,
  gates: payload.gates,
  holdings: payload.holdings,
  sizing: payload.sizing,
  order: payload.order,
  approval: payload.approval,
  sourceFreshness: (payload.sources || []).map(source => ({ id: source.id, status: source.status, asOf: source.asOf })),
};
payload.fingerprint = crypto.createHash('sha256').update(JSON.stringify(material)).digest('hex');
payload.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(root, 'outputs', 'tqqq-watcher-state.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, fingerprint: payload.fingerprint }));
