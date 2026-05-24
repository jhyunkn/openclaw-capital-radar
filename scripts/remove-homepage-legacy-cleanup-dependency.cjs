const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const manifestPath = path.join(root, 'config', 'homepage-sections.json');
const commandsToRemove = new Set([
  'node scripts/strip-legacy-brief-strategy-home.cjs',
  'node scripts/normalize-homepage-sections.cjs',
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const gate = spawnSync(process.execPath, [path.join(root, 'scripts', 'assert-homepage-registry-preview-ok.cjs')], {
  cwd: root,
  stdio: 'inherit',
});

if (gate.status !== 0) {
  fail('homepage legacy cleanup dependency removal blocked: registry preview gate did not pass');
}

if (!fs.existsSync(manifestPath)) {
  fail('homepage legacy cleanup dependency removal blocked: missing config/homepage-sections.json');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cleanup = manifest.cleanup || {};
const currentCommands = Array.isArray(cleanup.commands) ? cleanup.commands : [];
const nextCommands = currentCommands.filter(command => !commandsToRemove.has(command));
const removed = currentCommands.filter(command => commandsToRemove.has(command));

if (!removed.length) {
  console.log('homepage legacy cleanup dependency already absent');
  process.exit(0);
}

manifest.version = Number.isFinite(Number(manifest.version)) ? Number(manifest.version) + 1 : manifest.version;
manifest.cleanup = {
  ...cleanup,
  description: 'Legacy homepage cleanup commands retired after homepage registry preview gate passed. Legacy ids and banned phrases remain as validation targets.',
  commands: nextCommands,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`removed homepage legacy cleanup dependency commands: ${removed.join(', ')}`);
