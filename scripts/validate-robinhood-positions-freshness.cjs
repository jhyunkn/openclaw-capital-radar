'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const rhPath = path.join(root, 'outputs', 'robinhood-positions.json');
const outPath = path.join(root, 'outputs', 'robinhood-positions-freshness-status.json');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function writeStatus(status) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(status, null, 2) + '\n');
  console.log(JSON.stringify(status, null, 2));
}

const maxAgeHours = Number(arg('max-age-hours', '24'));
const checkedAt = new Date().toISOString();

if (!fs.existsSync(rhPath)) {
  writeStatus({
    schema: 'capital-radar-robinhood-positions-freshness.v1',
    checkedAt,
    ok: false,
    status: 'missing',
    blocker: 'outputs/robinhood-positions.json is missing',
    requiredAction: 'Restore the authenticated Robinhood positions producer before portfolio blocks can be treated as live.'
  });
  process.exit(2);
}

let rh;
try {
  rh = JSON.parse(fs.readFileSync(rhPath, 'utf8').replace(/^\uFEFF/, ''));
} catch (err) {
  writeStatus({
    schema: 'capital-radar-robinhood-positions-freshness.v1',
    checkedAt,
    ok: false,
    status: 'invalid_json',
    blocker: `outputs/robinhood-positions.json is not valid JSON: ${err.message}`,
    requiredAction: 'Repair or regenerate the Robinhood positions artifact from the authenticated producer.'
  });
  process.exit(2);
}

const syncedMs = Date.parse(rh.syncedAt || '');
const ageHours = Number.isFinite(syncedMs) ? (Date.now() - syncedMs) / 3_600_000 : null;
const positionCount = Array.isArray(rh.positions) ? rh.positions.length : 0;
const ok = ageHours != null && ageHours <= maxAgeHours && positionCount > 0;

writeStatus({
  schema: 'capital-radar-robinhood-positions-freshness.v1',
  checkedAt,
  ok,
  status: ok ? 'fresh' : ageHours == null ? 'missing_syncedAt' : 'stale',
  syncedAt: rh.syncedAt || null,
  ageHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
  maxAgeHours,
  positionCount,
  source: rh.source || null,
  blocker: ok ? null : ageHours == null
    ? 'Robinhood positions artifact has no parseable syncedAt timestamp.'
    : `Robinhood positions artifact is ${ageHours.toFixed(1)}h old; max allowed is ${maxAgeHours}h.`,
  requiredAction: ok ? null : 'Restore/re-auth the authenticated Robinhood positions producer; graceful degrade only prevents dashboard failure and does not restore live portfolio data.'
});

process.exit(ok ? 0 : 2);
