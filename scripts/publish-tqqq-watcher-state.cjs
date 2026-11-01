'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/publish-tqqq-watcher-state.cjs <payload.json>');
const payload = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
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
