const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'config', 'build-pipeline.json');

function fail(message) {
  console.error(`BUILD PIPELINE FAILED: ${message}`);
  process.exit(1);
}

function tail(value, max = 12000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(text.length - max) : text;
}

if (!fs.existsSync(manifestPath)) fail('config/build-pipeline.json missing');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.stages) || manifest.stages.length === 0) fail('manifest has no stages');

const requestedStage = process.env.BUILD_STAGE || process.argv[2] || '';
const stages = requestedStage ? manifest.stages.filter(stage => stage.name === requestedStage) : manifest.stages;
if (requestedStage && stages.length === 0) fail(`unknown stage: ${requestedStage}`);

const startedAt = Date.now();
const results = [];
console.log(`Capital Radar build pipeline v${manifest.version || 'unknown'} · silent diagnostics`);

for (const stage of stages) {
  if (!stage || !stage.name) fail('stage missing name');
  if (!Array.isArray(stage.commands) || stage.commands.length === 0) fail(`${stage.name} has no commands`);

  const stageStartedAt = Date.now();
  for (const command of stage.commands) {
    const result = spawnSync(command, {
      cwd: root,
      shell: true,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    if (result.error || result.status !== 0) {
      console.error(`FAILED STAGE: ${stage.name}`);
      console.error(`FAILED COMMAND: ${command}`);
      if (result.stdout) console.error(`STDOUT TAIL:\n${tail(result.stdout)}`);
      if (result.stderr) console.error(`STDERR TAIL:\n${tail(result.stderr)}`);
      if (result.error) fail(`${stage.name}: ${command}: ${result.error.message}`);
      fail(`${stage.name}: ${command}: exit ${result.status}`);
    }
  }

  results.push({ stage: stage.name, durationMs: Date.now() - stageStartedAt });
}

const totalMs = Date.now() - startedAt;
const report = { generatedAt: new Date().toISOString(), requestedStage: requestedStage || 'all', totalMs, stages: results };
const outPath = path.join(root, 'outputs', 'build-pipeline-last-run.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`Build pipeline completed in ${(totalMs / 1000).toFixed(1)}s`);
