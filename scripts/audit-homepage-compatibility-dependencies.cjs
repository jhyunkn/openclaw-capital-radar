const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const scriptsDir = path.join(root, 'scripts');
const outputsDir = path.join(root, 'outputs');
const publicOutputsDir = path.join(root, 'public', 'outputs');

const compatibilityCommands = [
  'scripts/finalize-homepage-composition.cjs',
  'scripts/compose-compressed-homepage.cjs',
  'scripts/inject-market-orientation-homepage.cjs',
  'scripts/inject-decision-trust-layer.cjs',
  'scripts/inject-proportion-tuning.cjs',
];

const legacyMarkers = [
  'data-homepage-constitution',
  'brief-holdings-opportunity-market-tape',
  'id="brief"',
  'id="holdings"',
  'id="opportunity"',
  'id="market-tape"',
  'homepage-constitution.json',
  'proportion-tuning.css',
  'assets/proportion-tuning.css',
  'finalize-homepage-composition',
  'compose-compressed-homepage',
  'inject-market-orientation-homepage',
  'inject-decision-trust-layer',
  'inject-proportion-tuning',
];

const operationalMarkers = [
  'decision-brief-section',
  'operational-chart-section',
  'holdings-section',
  'opportunities-section',
  'market-section',
  'homepage-sections.json',
  'render-capital-radar-home',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.(cjs|js|json|md|html|css)$/.test(entry.name)) return [];
    return [full];
  });
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

const files = [
  ...walk(scriptsDir),
  path.join(root, 'config', 'build-pipeline.json'),
  path.join(root, 'config', 'homepage-sections.json'),
  path.join(root, 'docs', 'HOMEPAGE_BUILD.md'),
].filter(f => fs.existsSync(f));

const dependencies = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const text = read(file);
  const legacyHits = legacyMarkers.filter(marker => text.includes(marker));
  const operationalHits = operationalMarkers.filter(marker => text.includes(marker));
  const referencesCompatibilityCommand = compatibilityCommands.filter(cmd => text.includes(cmd) || text.includes(path.basename(cmd)));
  if (legacyHits.length || referencesCompatibilityCommand.length) {
    const isValidator = /^scripts\/validate-/.test(rel);
    const isGenerator = /^scripts\/generate-/.test(rel);
    const isInjector = /^scripts\/inject-/.test(rel) || /^scripts\/compose-/.test(rel) || /^scripts\/finalize-/.test(rel);
    const removalRisk = isValidator && legacyHits.some(h => ['id="brief"','id="holdings"','id="opportunity"','id="market-tape"','data-homepage-constitution','brief-holdings-opportunity-market-tape'].includes(h))
      ? 'BLOCKS_REMOVAL_UNTIL_MIGRATED'
      : referencesCompatibilityCommand.length
        ? 'REFERENCES_COMPATIBILITY_COMMAND'
        : 'LOW_OR_INDIRECT';
    dependencies.push({
      file: rel,
      role: isValidator ? 'validator' : isGenerator ? 'generator' : isInjector ? 'injector' : 'other',
      removalRisk,
      legacyHits,
      operationalHits,
      referencesCompatibilityCommand,
    });
  }
}

const blockers = dependencies.filter(d => d.removalRisk === 'BLOCKS_REMOVAL_UNTIL_MIGRATED');
const report = {
  generatedAt: new Date().toISOString(),
  artifact: 'homepage-compatibility-dependency-audit',
  status: blockers.length ? 'NEEDS_MIGRATION' : 'NO_BLOCKING_LEGACY_VALIDATORS_FOUND',
  compatibilityCommands,
  summary: {
    filesScanned: files.length,
    dependencyCount: dependencies.length,
    blockerCount: blockers.length,
    validatorCount: dependencies.filter(d => d.role === 'validator').length,
    injectorCount: dependencies.filter(d => d.role === 'injector').length,
  },
  blockers,
  dependencies,
  migrationPlan: [
    'Migrate BLOCKS_REMOVAL validators to accept operational manifest sections.',
    'Move homepage validators after render-capital-radar-home in ship stage.',
    'Remove one compatibility command at a time only after audit blocker count reaches zero.',
    'Keep compatibility-artifact-prep non-authoritative until all dependents are migrated.',
  ],
  render_permission: true,
};

for (const dir of [outputsDir, publicOutputsDir]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'homepage-compatibility-dependency-audit.json'), JSON.stringify(report, null, 2) + '\n');
}

console.log(JSON.stringify({ status: report.status, summary: report.summary, blockers: blockers.map(b => b.file) }, null, 2));
// Non-blocking by design. The audit reports blockers but does not fail production.
