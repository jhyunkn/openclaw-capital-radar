const fs = require('fs');
const path = require('path');
const { findZeroSuspicions, countTruthTier } = require('./data-truth-contract.cjs');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const publicOutputsDir = path.join(root, 'public', 'outputs');
const outName = 'capital-radar-health-report.json';

function readJson(relativePath, fallback = null) {
  const candidates = [
    path.join(root, relativePath),
    path.join(outputsDir, relativePath),
    path.join(publicOutputsDir, relativePath),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      return { status: 'UNREADABLE', error: error.message, path: path.relative(root, filePath) };
    }
  }
  return fallback;
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function artifactAgeHours(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return Number(((Date.now() - stat.mtimeMs) / 36e5).toFixed(2));
}

function htmlCount(html, pattern) {
  return (String(html || '').match(pattern) || []).length;
}

function loadText(relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function statusFromCounts(counts, checks, registryStatus) {
  if (registryStatus === 'FAILED') return 'BLOCKED';
  if (counts.bannedPhraseLeakCount > 0 || counts.objectObjectLeakCount > 0 || counts.brokenOutputLinkCount > 0) return 'BLOCKED';
  if (counts.missingDataCount > 0 || counts.staleDataCount > 0 || counts.zeroValueSuspicionCount > 0 || checks.legacyCleanupActive) return 'DEGRADED';
  if (registryStatus && registryStatus !== 'OK') return 'DEGRADED';
  return 'OK';
}

function main() {
  const generatedAt = new Date().toISOString();
  const manifest = readJson('config/homepage-sections.json', { sections: [], cleanup: { commands: [] } });
  const pkg = readJson('package.json', {});
  const previewReport = readJson('homepage-registry-preview-report.json', null);
  const homeBuildReport = readJson('capital-radar-home-build-report.json', null);
  const indexHtml = loadText('index.html');

  const artifactNames = [
    'market-decision-brief-state.json',
    'operational-chart-state.json',
    'market-lens-state.json',
    'strategy-routing-state.json',
    'holding-zone-state.json',
    'opportunity-asymmetry-state.json',
    'market-tape-state.json',
    'kostolany-egg-state.json',
  ];

  const artifacts = artifactNames.map(name => {
    const relative = `outputs/${name}`;
    const value = readJson(name, null);
    return {
      name,
      path: relative,
      exists: exists(relative),
      ageHours: artifactAgeHours(relative),
      renderPermission: value && typeof value === 'object' ? value.render_permission : null,
      status: value?.status || value?.artifact || (value ? 'PRESENT' : 'MISSING'),
      zeroSuspicions: value ? findZeroSuspicions(value).slice(0, 10) : [],
      missingTierCount: value ? countTruthTier(value, 'MISSING') : 0,
      staleTierCount: value ? countTruthTier(value, 'STALE') : 0,
    };
  });

  const counts = {
    missingDataCount: artifacts.reduce((sum, item) => sum + (item.exists ? item.missingTierCount : 1), 0),
    staleDataCount: artifacts.reduce((sum, item) => sum + item.staleTierCount, 0),
    zeroValueSuspicionCount: artifacts.reduce((sum, item) => sum + item.zeroSuspicions.length, 0),
    missingArtifactCount: artifacts.filter(item => !item.exists).length,
    staleArtifactCount: artifacts.filter(item => Number.isFinite(item.ageHours) && item.ageHours > 24).length,
    bannedPhraseLeakCount: (manifest.cleanup?.bannedPhrases || []).filter(phrase => indexHtml.toLowerCase().includes(String(phrase).toLowerCase())).length,
    legacySectionLeakCount: (manifest.cleanup?.legacySectionIds || []).filter(id => htmlCount(indexHtml, new RegExp(`id=["']${escapeRegExp(id)}["']`, 'g')) > 0).length,
    objectObjectLeakCount: indexHtml.includes('[object Object]') ? 1 : 0,
    brokenOutputLinkCount: htmlCount(indexHtml, /\b(?:href|src)=["']outputs\//g),
  };

  const checks = {
    packageScriptsPresent: Boolean(pkg.scripts?.['preview:homepage-registry:strict'] && pkg.scripts?.['migrate:homepage-registry:strict']),
    legacyCleanupActive: Boolean((manifest.cleanup?.commands || []).length),
    productionIndexWrittenByPreview: previewReport?.productionIndexWritten === true,
    allRequiredSectionsPresent: (manifest.sections || [])
      .filter(section => section.enabled !== false && section.required !== false)
      .every(section => htmlCount(indexHtml, new RegExp(`id=["']${escapeRegExp(section.id)}["']`, 'g')) === 1),
  };

  const registryStatus = previewReport?.status || 'PENDING_FIRST_RENDER';
  const status = statusFromCounts(counts, checks, registryStatus);
  const verdict = status === 'OK'
    ? 'Radar is edit-ready: registry preview, data truth, and homepage integrity checks are clean.'
    : status === 'DEGRADED'
      ? 'Radar is usable, but visual/data-display edits should respect degraded health signals.'
      : 'Radar is blocked: resolve structural or data integrity failures before visual editing.';

  const report = {
    generatedAt,
    status,
    verdict,
    policy: 'Capital Radar health report is a deployment/edit-readiness gate. Missing source values must not render as zero.',
    truthTiers: ['REAL', 'DERIVED', 'EST', 'PROJ', 'MISSING', 'STALE'],
    production: {
      buildCommit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
      source: process.env.VERCEL ? 'vercel' : process.env.GITHUB_ACTIONS ? 'github-actions' : 'local-or-unknown',
      homeBuildStatus: homeBuildReport?.status || null,
    },
    registryPreview: {
      status: registryStatus,
      report: 'outputs/homepage-registry-preview-report.json',
      productionIndexWritten: previewReport?.productionIndexWritten === true,
    },
    checks,
    counts,
    artifacts,
    editReadiness: {
      visualLayer: status !== 'BLOCKED',
      dataDisplayLayer: status !== 'BLOCKED',
      aggressiveVisualRefactor: status === 'OK' && checks.legacyCleanupActive === false,
    },
  };

  for (const dir of [outputsDir, publicOutputsDir]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, outName), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`capital-radar-health-report: ${status}`);
}

main();
