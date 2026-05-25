const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'config', 'build-pipeline.json');
const outPath = path.join(root, 'outputs', 'build-lane-last-run.json');

function fail(message) {
  console.error(`BUILD LANE FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) fail('config/build-pipeline.json missing');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestStages = Array.isArray(manifest.stages) ? manifest.stages.map(stage => stage.name) : [];

const lanes = {
  data: {
    description: 'Refresh data/research artifacts without rendering production as the default npm build.',
    stages: ['base-data', 'ticker-workbenches', 'live-state-and-research', 'market-orientation']
  },
  audit: {
    description: 'Run architecture/evidence coverage audit only.',
    stages: ['architecture-audit']
  },
  validation: {
    description: 'Run validation stage only against existing artifacts.',
    stages: ['validation']
  },
  ship: {
    description: 'Render/package production surface from existing artifacts using the existing ship stage.',
    stages: ['ship']
  },
  full: {
    description: 'Run every stage through the existing manifest-driven full pipeline.',
    stages: manifestStages
  }
};

const arg = process.argv[2] || '';
if (!arg || arg === '--help' || arg === '-h' || arg === '--list') {
  console.log('Capital Radar build lanes');
  console.log('');
  for (const [name, lane] of Object.entries(lanes)) {
    console.log(`${name.padEnd(12)} ${lane.stages.join(' -> ')}`);
    console.log(`             ${lane.description}`);
  }
  process.exit(0);
}

const lane = lanes[arg];
if (!lane) fail(`unknown lane "${arg}". Use --list to see available lanes.`);

for (const stage of lane.stages) {
  if (!manifestStages.includes(stage)) fail(`lane "${arg}" references unknown stage "${stage}"`);
}

const startedAt = Date.now();
const report = {
  generatedAt: new Date().toISOString(),
  lane: arg,
  description: lane.description,
  stages: [],
  policy: 'Lane runner is additive. It does not change npm run build or Vercel production behavior unless package/build settings are explicitly changed later.'
};

console.log(`Capital Radar lane: ${arg}`);
console.log(lane.description);
console.log(`Stages: ${lane.stages.join(' -> ')}`);

for (const stage of lane.stages) {
  const t0 = Date.now();
  console.log(`\n--- lane stage: ${stage} ---`);
  const result = spawnSync('node', ['scripts/run-build-pipeline.cjs'], {
    cwd: root,
    shell: false,
    stdio: 'inherit',
    env: { ...process.env, BUILD_STAGE: stage, CAPITAL_RADAR_BUILD_LANE: arg }
  });
  const durationMs = Date.now() - t0;
  report.stages.push({ stage, durationMs, status: result.status === 0 ? 'PASS' : 'FAIL' });
  if (result.error) fail(`${stage}: ${result.error.message}`);
  if (result.status !== 0) fail(`${stage}: exit ${result.status}`);
}

report.totalMs = Date.now() - startedAt;
report.status = 'PASS';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(`\nBuild lane completed: ${arg} in ${(report.totalMs / 1000).toFixed(1)}s`);
console.log(`Wrote ${path.relative(root, outPath)}`);
