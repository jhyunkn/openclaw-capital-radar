const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const manifestPath = path.join(root, 'config', 'homepage-sections.json');
const reportPath = path.join(outputsDir, 'capital-radar-home-build-report.json');
const bannedActiveCommands = [
  'node scripts/enhance-decision-chart-v2.cjs',
  'node scripts/patch-decision-chart-price-scale.cjs',
];

function loadManifest() {
  if (!fs.existsSync(manifestPath)) throw new Error(`homepage manifest missing: ${path.relative(root, manifestPath)}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.sections)) throw new Error('homepage manifest missing sections[]');
  return manifest;
}

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

function runGroup(name, commands, report) {
  console.log(`\n=== home stage: ${name} ===`);
  const stageStartedAt = Date.now();
  const results = [];
  for (const command of commands || []) {
    console.log(`\n$ ${command}`);
    const commandResult = run(command);
    results.push(commandResult);
    if (commandResult.status !== 'OK') fail(`${name}: ${command} failed`, { stages: report.stages.concat([{ name, commands: results }]) });
  }
  report.stages.push({ name, durationMs: Date.now() - stageStartedAt, commands: results });
}

function validateManifest(manifest) {
  const errors = [];
  const activeCommands = [];
  for (const section of manifest.sections || []) {
    if (section.enabled === false) continue;
    for (const command of section.commands || []) activeCommands.push(command);
  }
  for (const command of manifest.baseline?.commands || []) activeCommands.push(command);
  for (const command of manifest.cleanup?.commands || []) activeCommands.push(command);
  for (const banned of bannedActiveCommands) {
    if (activeCommands.includes(banned)) errors.push(`banned active command still present: ${banned}`);
  }
  return errors;
}

function validateHomepage(manifest) {
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(indexPath)) return ['index.html missing'];
  const html = fs.readFileSync(indexPath, 'utf8');
  const errors = [];
  for (const section of manifest.sections.filter(s => s.enabled !== false && s.required !== false)) {
    const id = section.id;
    const count = (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;
    if (count !== 1) errors.push(`${id} count ${count}, expected 1`);
  }
  for (const id of manifest.cleanup?.legacySectionIds || []) {
    const count = (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;
    if (count > 0) errors.push(`legacy section still present: ${id}`);
  }
  for (const phrase of manifest.cleanup?.bannedPhrases || []) {
    if (html.toLowerCase().includes(String(phrase).toLowerCase())) errors.push(`legacy phrase still present: ${phrase}`);
  }
  if (html.includes('[object Object]')) errors.push('homepage leaks [object Object]');
  if (!html.includes('Operational Decision Chart')) errors.push('operational decision chart missing');
  if (!html.includes('Market Decision Brief')) errors.push('market decision brief missing');
  const chartContainerCount = (html.match(/id=["']opclaw-operational-lwc["']/g) || []).length;
  if (chartContainerCount !== 1) errors.push(`operational chart container count ${chartContainerCount}, expected 1`);
  const chartRuntimeCount = (html.match(/const payload=\{"series":/g) || []).length;
  if (chartRuntimeCount !== 1) errors.push(`operational chart runtime count ${chartRuntimeCount}, expected 1`);
  if (!html.includes('decision-chart-rail')) errors.push('operational chart decision rail missing');
  if (!html.includes('decision-chart-confirmation-strip')) errors.push('operational chart confirmation strip missing');
  if (!html.includes('actionable_spx_levels_only')) errors.push('operational chart autoscale policy missing');
  if (html.includes('scenario path lines removed from main price pane')) errors.push('legacy price-scale patch residue present');
  return errors;
}

const startedAt = Date.now();
const report = { stages: [] };
let manifest;
try { manifest = loadManifest(); } catch (error) { fail(error.message, report); }

const manifestErrors = validateManifest(manifest);
if (manifestErrors.length) fail(`manifest validation failed: ${manifestErrors.join('; ')}`, report);

console.log('Capital Radar canonical homepage build');
console.log(`Manifest: ${path.relative(root, manifestPath)} v${manifest.version || 'unknown'}`);
console.log(manifest.policy || 'Policy: manifest-driven operational homepage assembly.');

runGroup('baseline-home-shell', manifest.baseline?.commands || [], report);
for (const section of manifest.sections) {
  if (section.enabled === false) {
    report.stages.push({ name: section.name || section.id, skipped: true, reason: 'disabled in homepage-sections.json' });
    continue;
  }
  runGroup(section.name || section.id, section.commands || [], report);
}
runGroup('cleanup-legacy-home-sections', manifest.cleanup?.commands || [], report);

const structuralErrors = validateHomepage(manifest);
if (structuralErrors.length) fail(`structural validation failed: ${structuralErrors.join('; ')}`, report);

fs.mkdirSync(outputsDir, { recursive: true });
const finalReport = {
  generatedAt: new Date().toISOString(),
  status: 'OK',
  totalMs: Date.now() - startedAt,
  policy: 'manifest-driven Capital Radar homepage render path',
  manifest: path.relative(root, manifestPath),
  sections: manifest.sections.filter(s => s.enabled !== false).map(s => s.id),
  stages: report.stages,
};
fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
console.log(`\nCapital Radar homepage build passed in ${(finalReport.totalMs / 1000).toFixed(1)}s`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
