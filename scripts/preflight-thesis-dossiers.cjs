const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const requiredFiles = [
  'data/report-state.sample.json',
  'scripts/generate-thesis-dossiers.cjs'
];
const optionalFiles = [
  'data/report-state.live.json',
  'outputs/strategy-interpretations.json',
  'outputs/portfolio-exposure-map.json',
  'outputs/research-candidate-map.json'
];
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }

for (const file of requiredFiles) check(`required file: ${file}`, exists(file), exists(file) ? 'found' : 'missing');
for (const file of optionalFiles) check(`optional file: ${file}`, true, exists(file) ? 'found' : 'not found; generator should fallback');
check('agent-notes/tickers directory', exists('agent-notes/tickers'), exists('agent-notes/tickers') ? 'found' : 'missing; generator should tolerate missing notes');

try {
  const state = exists('data/report-state.live.json') ? readJson('data/report-state.live.json') : readJson('data/report-state.sample.json');
  check('state JSON parses', true, 'parsed successfully');
  check('state.holdings exists', Array.isArray(state.holdings), Array.isArray(state.holdings) ? `${state.holdings.length} holdings` : 'missing or not array');
  check('state has at least one holding', Array.isArray(state.holdings) && state.holdings.length > 0, Array.isArray(state.holdings) ? `${state.holdings.length} holdings` : 'no holdings');
} catch (error) {
  check('state JSON parses', false, error.message);
}

const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate-thesis-dossiers.cjs')], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, THESIS_PREFLIGHT: '1' }
});
check('generate-thesis-dossiers.cjs exits 0', result.status === 0, result.stderr || result.stdout || `exit ${result.status}`);

const outRel = 'outputs/thesis-dossiers.json';
check('outputs/thesis-dossiers.json created', exists(outRel), exists(outRel) ? 'found' : 'missing');
if (exists(outRel)) {
  try {
    const out = readJson(outRel);
    check('thesis output parses', true, 'parsed successfully');
    check('thesis output holdings array', Array.isArray(out.holdings), Array.isArray(out.holdings) ? `${out.holdings.length} holdings` : 'missing or not array');
    check('thesis output all array', Array.isArray(out.all), Array.isArray(out.all) ? `${out.all.length} total dossiers` : 'missing or not array');
    const thin = (out.all || []).filter(d => !d.ticker || !d.businessModel || !d.cases || !d.valuationQuestion || !d.technicalQuestion);
    check('required dossier fields present', thin.length === 0, thin.length ? `${thin.length} dossiers missing required fields` : 'all dossiers have required fields');
  } catch (error) {
    check('thesis output parses', false, error.message);
  }
}

const failed = checks.filter(c => !c.pass);
const report = {
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'fail' : 'pass',
  failedCount: failed.length,
  checks,
  stdout: result.stdout,
  stderr: result.stderr,
  exitStatus: result.status
};
fs.mkdirSync(path.join(root, 'outputs'), { recursive: true });
fs.writeFileSync(path.join(root, 'outputs/thesis-preflight-report.json'), JSON.stringify(report, null, 2) + '\n');

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
console.log(`wrote outputs/thesis-preflight-report.json`);
if (failed.length) process.exit(1);
