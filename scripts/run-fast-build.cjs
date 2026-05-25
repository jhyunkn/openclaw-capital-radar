const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'outputs', 'fast-build-report.json');

const steps = [
  {
    name: 'render-homepage',
    command: 'node',
    args: ['scripts/render-capital-radar-home.cjs'],
    purpose: 'Render the canonical homepage from existing committed/generated artifacts.'
  },
  {
    name: 'validate-operational-sections',
    command: 'node',
    args: ['scripts/validate-operational-sections.cjs'],
    purpose: 'Verify required operational homepage sections are present before packaging.'
  },
  {
    name: 'build-vercel-static-output',
    command: 'node',
    args: ['scripts/build-vercel.cjs'],
    purpose: 'Copy existing static assets, data, outputs, pages, and index.html into public/.'
  }
];

function runStep(step) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, CAPITAL_RADAR_BUILD_MODE: 'fast' }
  });
  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;
  const entry = {
    name: step.name,
    purpose: step.purpose,
    command: [step.command, ...step.args].join(' '),
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    durationMs,
    startedAt,
    finishedAt,
    stdoutTail: String(result.stdout || '').split('\n').slice(-25).join('\n').trim(),
    stderrTail: String(result.stderr || '').split('\n').slice(-25).join('\n').trim()
  };
  if (entry.status === 'FAIL') {
    const err = new Error(`fast build failed at ${step.name}`);
    err.entry = entry;
    throw err;
  }
  return entry;
}

function assertFile(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`required fast-build output missing: ${rel}`);
  return { file: rel, bytes: fs.statSync(file).size };
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: 'fast',
  policy: 'Fast build renders UI from existing artifacts only. It does not refresh live market data, regenerate research artifacts, or replace the full production pipeline by itself.',
  steps: [],
  requiredOutputs: []
};

try {
  for (const step of steps) report.steps.push(runStep(step));
  report.requiredOutputs = [
    assertFile('index.html'),
    assertFile('public/index.html'),
    assertFile('public/health.json')
  ];
  report.status = 'PASS';
} catch (error) {
  if (error.entry) report.steps.push(error.entry);
  report.status = 'FAIL';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`fast build ${report.status}: wrote outputs/fast-build-report.json`);
}
