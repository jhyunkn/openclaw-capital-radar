const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const reportPath = path.join(outputsDir, 'capital-radar-home-build-report.json');

const stages = [
  {
    name: 'baseline-home-shell',
    commands: [
      'node scripts/render-operating-brain-home.cjs',
    ],
  },
  {
    name: 'decision-brief',
    commands: [
      'node scripts/generate-market-decision-brief-state.cjs',
      'node scripts/inject-market-decision-brief-home.cjs',
    ],
  },
  {
    name: 'operational-chart',
    commands: [
      'node scripts/generate-operational-chart-state.cjs',
      'node scripts/inject-operational-chart-home.cjs',
    ],
  },
  {
    name: 'cleanup-legacy-home-sections',
    commands: [
      'node scripts/strip-legacy-brief-strategy-home.cjs',
      'node scripts/strip-visual-regime-home.cjs',
    ],
  },
  {
    name: 'holdings',
    commands: [
      'node scripts/generate-research-universe-state.cjs',
      'node scripts/run-research-collectors-safe.cjs',
      'node scripts/generate-institutional-source-states.cjs',
      'node scripts/generate-holding-zone-state.cjs',
      'node scripts/validate-holding-zone-state.cjs',
      'node scripts/inject-strong-holdings-cards-home.cjs',
      'node scripts/strip-holdings-role-method-home.cjs',
    ],
  },
  {
    name: 'opportunity',
    commands: [
      'node scripts/generate-opportunity-band-state.cjs',
      'node scripts/refine-opportunity-asymmetry-filter.cjs',
      'node scripts/enrich-opportunity-near-miss-diagnostics.cjs',
      'node scripts/inject-opportunity-promotion-board-home.cjs',
    ],
  },
  {
    name: 'market-tape',
    commands: [
      'node scripts/generate-market-tape-state.cjs',
      'node scripts/inject-market-tape-board-home.cjs',
    ],
  },
];

function fail(message, report) {
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    status: 'FAILED',
    error: message,
    ...report,
  }, null, 2));
  console.error(`CAPITAL RADAR HOME BUILD FAILED: ${message}`);
  process.exit(1);
}

function run(command) {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const durationMs = Date.now() - startedAt;
  if (result.error) return { command, status: 'ERROR', durationMs, error: result.error.message };
  if (result.status !== 0) return { command, status: 'FAILED', durationMs, exitCode: result.status };
  return { command, status: 'OK', durationMs };
}

function validateNoDuplicateSections() {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) return ['index.html missing'];
  const html = fs.readFileSync(indexPath, 'utf8');
  const checks = [
    ['decision-brief-section', /id="decision-brief-section"/g, 1],
    ['operational-chart-section', /id="operational-chart-section"/g, 1],
    ['holdings-section', /id="holdings-section"/g, 1],
    ['opportunities-section', /id="opportunities-section"/g, 1],
    ['market-section', /id="market-section"/g, 1],
  ];
  const errors = [];
  for (const [label, regex, expected] of checks) {
    const count = (html.match(regex) || []).length;
    if (count !== expected) errors.push(`${label} count ${count}, expected ${expected}`);
  }
  const banned = [
    'Evidence-backed Market Landscape',
    'Decision Posture',
    'Strategy Posture',
    'market-regine',
    'visual regime board',
  ];
  for (const phrase of banned) {
    if (html.toLowerCase().includes(phrase.toLowerCase())) errors.push(`legacy phrase still present: ${phrase}`);
  }
  if (html.includes('[object Object]')) errors.push('homepage leaks [object Object]');
  if (!html.includes('Operational Decision Chart')) errors.push('operational decision chart missing');
  if (!html.includes('Market Decision Brief')) errors.push('market decision brief missing');
  return errors;
}

const startedAt = Date.now();
const report = { stages: [] };
console.log('Capital Radar canonical homepage build');
console.log('Policy: render-operating-brain creates a disposable baseline shell; render-capital-radar-home is the final homepage authority.');

for (const stage of stages) {
  console.log(`\n=== home stage: ${stage.name} ===`);
  const stageStartedAt = Date.now();
  const commands = [];
  for (const command of stage.commands) {
    console.log(`\n$ ${command}`);
    const commandResult = run(command);
    commands.push(commandResult);
    if (commandResult.status !== 'OK') fail(`${stage.name}: ${command} failed`, { stages: report.stages.concat([{ name: stage.name, commands }]) });
  }
  report.stages.push({ name: stage.name, durationMs: Date.now() - stageStartedAt, commands });
}

const structuralErrors = validateNoDuplicateSections();
if (structuralErrors.length) fail(`structural validation failed: ${structuralErrors.join('; ')}`, report);

fs.mkdirSync(outputsDir, { recursive: true });
const finalReport = {
  generatedAt: new Date().toISOString(),
  status: 'OK',
  totalMs: Date.now() - startedAt,
  policy: 'canonical Capital Radar homepage render path',
  sections: ['decision-brief-section', 'operational-chart-section', 'holdings-section', 'opportunities-section', 'market-section'],
  stages: report.stages,
};
fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
console.log(`\nCapital Radar homepage build passed in ${(finalReport.totalMs / 1000).toFixed(1)}s`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
