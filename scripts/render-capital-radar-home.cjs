const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const manifestPath = path.join(root, 'config', 'homepage-sections.json');
const reportPath = path.join(outputsDir, 'capital-radar-home-build-report.json');
const chartReportPath = path.join(outputsDir, 'operational-chart-validation-report.json');
const bannedActiveCommands = [
  'node scripts/enhance-decision-chart-v2.cjs',
  'node scripts/patch-decision-chart-price-scale.cjs',
];
const bannedLegacySelectors = [
  'id="regime-section"',
  "id='regime-section'",
  'class="panel visual-regime"',
  "class='panel visual-regime'",
  '.visual-regime',
  'href="#regime-section"',
  "href='#regime-section'",
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

function buildOperationalChartReport(html) {
  const warnings = [];
  const chartContainerCount = (html.match(/id=["']opclaw-operational-lwc["']/g) || []).length;
  const runtimeCount = (html.match(/const payload=\{"series":/g) || []).length;
  const annotationLayerPresent = html.includes('decision-chart-v2-shell');
  const decisionRailPresent = html.includes('decision-chart-rail');
  const confirmationStripPresent = html.includes('decision-chart-confirmation-strip');
  const autoscalePolicyPresent = html.includes('actionable_spx_levels_only');
  const legacyPatchResiduePresent = html.includes('scenario path lines removed from main price pane');
  if (chartContainerCount !== 1) warnings.push(`chart_container_count=${chartContainerCount}`);
  if (runtimeCount !== 1) warnings.push(`runtime_count=${runtimeCount}`);
  if (!annotationLayerPresent) warnings.push('annotation_layer_missing');
  if (!decisionRailPresent) warnings.push('decision_rail_missing');
  if (!confirmationStripPresent) warnings.push('confirmation_strip_missing');
  if (!autoscalePolicyPresent) warnings.push('autoscale_policy_missing');
  if (legacyPatchResiduePresent) warnings.push('legacy_price_scale_patch_residue_present');
  return {
    generatedAt: new Date().toISOString(),
    status: warnings.length ? 'FAILED' : 'OK',
    chart_container_count: chartContainerCount,
    runtime_count: runtimeCount,
    annotation_layer_present: annotationLayerPresent,
    decision_rail_present: decisionRailPresent,
    confirmation_strip_present: confirmationStripPresent,
    autoscale_policy_present: autoscalePolicyPresent,
    legacy_patch_residue_present: legacyPatchResiduePresent,
    scale_affecting_items: ['candles', 'moving_averages', 'add_zone', 'trim_zone', 'hold_above', 'defense_below', 'hard_risk', 'target', 'current_price'],
    scale_neutral_items: ['volume', 'scenario_paths', 'projection_paths', 'annotation_markers', 'decision_rail', 'confirmation_strip'],
    warnings,
  };
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
  for (const selector of bannedLegacySelectors) {
    if (html.includes(selector)) errors.push(`legacy visual regime selector still present: ${selector}`);
  }
  if (html.includes('[object Object]')) errors.push('homepage leaks [object Object]');
  if (!html.includes('Operational Decision Chart')) errors.push('operational decision chart missing');
  if (!html.includes('Market Decision Brief')) errors.push('market decision brief missing');

  fs.mkdirSync(outputsDir, { recursive: true });
  const chartReport = buildOperationalChartReport(html);
  fs.writeFileSync(chartReportPath, JSON.stringify(chartReport, null, 2));
  if (chartReport.status !== 'OK') errors.push(`operational chart validation failed: ${chartReport.warnings.join(', ')}`);
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
  reports: {
    homepage: path.relative(root, reportPath),
    operational_chart: path.relative(root, chartReportPath),
  },
  stages: report.stages,
};
fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
console.log(`\nCapital Radar homepage build passed in ${(finalReport.totalMs / 1000).toFixed(1)}s`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
console.log(`Wrote ${path.relative(root, chartReportPath)}`);
