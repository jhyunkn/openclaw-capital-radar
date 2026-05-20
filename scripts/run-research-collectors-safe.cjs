const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const publicOutputs = path.join(root, 'public', 'outputs');
fs.mkdirSync(outputs, { recursive: true });
fs.mkdirSync(publicOutputs, { recursive: true });

const collectors = [
  {
    name: 'SEC company evidence',
    script: 'collect-sec-company-evidence.cjs',
    output: 'sec-company-evidence-collection.json',
    timeout_ms: 30000
  },
  {
    name: 'Manager filing index',
    script: 'collect-manager-filing-index.cjs',
    output: 'manager-filing-index.json',
    timeout_ms: 30000
  },
  {
    name: 'Market structure snapshot',
    script: 'collect-market-structure-state.cjs',
    output: 'market-structure-collection.json',
    timeout_ms: 15000
  }
];

function writeBoth(name, data) {
  for (const dir of [outputs, publicOutputs]) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2) + '\n');
  }
}
function readOutput(name) {
  try { return JSON.parse(fs.readFileSync(path.join(outputs, name), 'utf8')); }
  catch { return null; }
}
function placeholder(name, collector, reason) {
  return {
    as_of: new Date().toISOString(),
    artifact: collector.output.replace('.json', ''),
    collection_status: 'degraded',
    records: [],
    missing: [{ reason }],
    summary: { records: 0, degraded: true },
    render_permission: true
  };
}

const results = [];
for (const collector of collectors) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [path.join(__dirname, collector.script)], {
    cwd: root,
    encoding: 'utf8',
    timeout: collector.timeout_ms,
    env: process.env
  });
  const duration_ms = Date.now() - started;
  const timedOut = result.error && result.error.code === 'ETIMEDOUT';
  const failed = result.status !== 0 || result.error;
  let status = 'ok';
  let reason = null;

  if (timedOut) {
    status = 'degraded';
    reason = `collector_timeout_${collector.timeout_ms}ms`;
  } else if (failed) {
    status = 'degraded';
    reason = result.error ? result.error.message : `exit_${result.status}`;
  }

  if (status === 'degraded') {
    writeBoth(collector.output, placeholder(collector.output, collector, reason));
  }

  const output = readOutput(collector.output);
  if (!output) {
    status = 'degraded';
    reason = reason || 'collector_output_missing';
    writeBoth(collector.output, placeholder(collector.output, collector, reason));
  }

  results.push({
    name: collector.name,
    script: collector.script,
    output: collector.output,
    status,
    reason,
    duration_ms,
    stdout_tail: String(result.stdout || '').slice(-500),
    stderr_tail: String(result.stderr || '').slice(-500)
  });
}

const health = {
  as_of: new Date().toISOString(),
  artifact: 'research-collector-health-state',
  collectors: results,
  summary: {
    ok: results.filter(r => r.status === 'ok').length,
    degraded: results.filter(r => r.status !== 'ok').length,
    total: results.length
  },
  render_permission: true
};
writeBoth('research-collector-health-state.json', health);

for (const item of results) {
  const suffix = item.status === 'ok' ? '' : ` (${item.reason})`;
  console.log(`${item.status}: ${item.name}${suffix}`);
}
console.log(`research collectors complete: ok=${health.summary.ok} degraded=${health.summary.degraded}`);
