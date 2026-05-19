const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'config', 'build-pipeline.json');

function fail(message) {
  console.error(`BUILD PIPELINE FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) fail('config/build-pipeline.json missing');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) fail('manifest has no stages');

const requestedStage = process.env.BUILD_STAGE || process.argv[2] || '';
const stages = requestedStage ? manifest.stages.filter(stage => stage.name === requestedStage) : manifest.stages;
if (requestedStage && stages.length === 0) fail(`unknown stage: ${requestedStage}`);

const startedAt = Date.now();
const results = [];

console.log(`Capital Radar build pipeline v${manifest.version || 'unknown'}`);
console.log(manifest.policy || 'Manifest-driven build pipeline.');

for (const stage of stages) {
  if (!stage || !stage.name) fail('stage missing name');
  if (!Array.isArray(stage.commands) || stage.commands.length === 0) fail(`${stage.name} has no commands`);

  const stageStartedAt = Date.now();
  console.log(`\n=== stage: ${stage.name} ===`);
  if (stage.description) console.log(stage.description);

  for (const command of stage.commands) {
    console.log(`\n$ ${command}`);
    const result = spawnSync(command, {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    if (result.error) fail(`${stage.name}: ${command}: ${result.error.message}`);
    if (result.status !== 0) fail(`${stage.name}: ${command}: exit ${result.status}`);
  }

  const durationMs = Date.now() - stageStartedAt;
  results.push({ stage: stage.name, durationMs });
  console.log(`=== completed: ${stage.name} (${(durationMs / 1000).toFixed(1)}s) ===`);
}

const totalMs = Date.now() - startedAt;
const report = {
  generatedAt: new Date().toISOString(),
  requestedStage: requestedStage || 'all',
  totalMs,
  stages: results,
};

const outPath = path.join(root, 'outputs', 'build-pipeline-last-run.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nBuild pipeline completed in ${(totalMs / 1000).toFixed(1)}s`);
console.log(`Wrote ${path.relative(root, outPath)}`);
