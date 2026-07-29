const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const triggerPath = path.join(root, '.github', 'deploy-trigger', 'vercel-prebuilt-production.txt');
const metadataPath = path.join(root, 'outputs', 'metadata-scan-state.json');
const buildPath = path.join(root, 'outputs', 'build-pipeline-last-run.json');
const truthPath = path.join(root, 'outputs', 'data-truth-state.json');

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const payload = {
  generatedAt: new Date().toISOString(),
  reason: 'daily-capital-radar-refresh',
  policy: 'Trigger Vercel production deploy after daily Capital Radar data, holdings, diagrams, metadata scan state, pages, and public output are rebuilt and committed.',
  metadataScan: readJsonIfExists(metadataPath)?.status || 'missing',
  buildStatus: readJsonIfExists(buildPath)?.status || readJsonIfExists(buildPath)?.result || 'unknown',
  homepageSafeToRender: readJsonIfExists(truthPath)?.homepageSafeToRender ?? null
};

fs.mkdirSync(path.dirname(triggerPath), { recursive: true });
fs.writeFileSync(triggerPath, JSON.stringify(payload, null, 2) + '\n');
console.log(`touched ${path.relative(root, triggerPath)}`);
