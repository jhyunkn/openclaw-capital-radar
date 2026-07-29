const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const outPath = path.join(outputsDir, 'metadata-scan-state.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
}

function findLatestLocalSource() {
  const explicit = process.env.CAPITAL_RADAR_METADATA_SCAN_SOURCE;
  if (explicit) {
    const resolved = path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
    if (fs.existsSync(resolved)) return resolved;
  }

  const candidates = [
    path.join(root, 'data', 'metadata-scan-state.json'),
    path.join(root, 'data', 'research', 'metadata-scan-state.json'),
    path.join(root, 'outputs', 'metadata-scan-input.json'),
  ];

  const inRepo = candidates.find(file => fs.existsSync(file));
  if (inRepo) return inRepo;

  const workspaceRoot = path.resolve(root, '..', '..');
  if (fs.existsSync(workspaceRoot)) {
    const workspaceCandidates = fs.readdirSync(workspaceRoot)
      .filter(file => /^tmp-capital-radar-metadata-\d{4}-\d{2}-\d{2}\.jsonl?$/.test(file))
      .map(file => path.join(workspaceRoot, file))
      .filter(file => fs.statSync(file).isFile())
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (workspaceCandidates[0]) return workspaceCandidates[0];
  }

  return null;
}

function summarizeRecords(records, sourcePath) {
  const ids = new Set();
  const tickers = new Set();
  const sourceTypes = new Map();
  let claimLike = 0;
  let transcriptLike = 0;

  for (const record of records) {
    const id = record.videoId || record.id || record.url || record.title || record.raw;
    if (id) ids.add(String(id));
    const tickerValues = []
      .concat(record.tickers || [])
      .concat(record.symbols || [])
      .concat(record.ticker ? [record.ticker] : []);
    for (const ticker of tickerValues) {
      const normalized = String(ticker).toUpperCase().replace(/[^A-Z0-9.-]/g, '');
      if (normalized) tickers.add(normalized);
    }
    const type = record.sourceType || record.type || record.platform || 'unknown';
    sourceTypes.set(type, (sourceTypes.get(type) || 0) + 1);
    if (record.claim || record.thesis || record.summary || record.signal) claimLike += 1;
    if (record.transcript || record.caption || record.transcriptWords || record.wordCount) transcriptLike += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    status: records.length ? 'IMPORTED' : 'EMPTY',
    source: path.relative(root, sourcePath),
    policy: 'Metadata/video/community scans are hypothesis and source-discovery input. They must feed claim/evidence/thesis ledgers before changing Capital Radar posture.',
    coverage: {
      rawRecords: records.length,
      uniqueIds: ids.size,
      detectedTickers: [...tickers].sort(),
      sourceTypes: Object.fromEntries([...sourceTypes.entries()].sort()),
      claimLikeRecords: claimLike,
      transcriptLikeRecords: transcriptLike
    },
    gates: {
      broadIntakePresent: records.length >= 25,
      uniqueSourceFloorMet: ids.size >= 25,
      requiresHardDataVerification: true,
      actionPromotionAllowedFromMetadataAlone: false
    },
    integration: {
      capitalRadarSurface: true,
      githubCommittedArtifact: 'outputs/metadata-scan-state.json',
      vercelPublicArtifact: 'public/outputs/metadata-scan-state.json',
      dailyDeployExpectation: 'Daily workflow commits metadata, holdings, price data, generated diagrams/pages, public output, and deploy trigger when build passes.'
    }
  };
}

function fallbackState(reason) {
  return {
    generatedAt: new Date().toISOString(),
    status: 'DEGRADED',
    reason,
    policy: 'No metadata scan source was available during this build. Capital Radar may still render live market/holdings data, but metadata-derived thesis changes are frozen.',
    coverage: {
      rawRecords: 0,
      uniqueIds: 0,
      detectedTickers: [],
      sourceTypes: {},
      claimLikeRecords: 0,
      transcriptLikeRecords: 0
    },
    gates: {
      broadIntakePresent: false,
      uniqueSourceFloorMet: false,
      requiresHardDataVerification: true,
      actionPromotionAllowedFromMetadataAlone: false
    },
    integration: {
      capitalRadarSurface: true,
      githubCommittedArtifact: 'outputs/metadata-scan-state.json',
      vercelPublicArtifact: 'public/outputs/metadata-scan-state.json',
      dailyDeployExpectation: 'Daily workflow commits metadata, holdings, price data, generated diagrams/pages, public output, and deploy trigger when build passes.'
    }
  };
}

fs.mkdirSync(outputsDir, { recursive: true });
const source = findLatestLocalSource();
let state;

if (!source) {
  state = fallbackState('metadata_scan_source_missing');
} else if (source.endsWith('.jsonl')) {
  state = summarizeRecords(readJsonl(source), source);
} else {
  const payload = readJson(source);
  if (Array.isArray(payload)) state = summarizeRecords(payload, source);
  else if (Array.isArray(payload.records)) state = { ...payload, ...summarizeRecords(payload.records, source) };
  else if (Array.isArray(payload.candidates)) state = { ...payload, ...summarizeRecords(payload.candidates, source) };
  else state = { ...fallbackState('metadata_scan_source_not_record_array'), source: path.relative(root, source), rawKeys: Object.keys(payload || {}) };
}

fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`metadata scan state ${state.status}: wrote ${path.relative(root, outPath)}`);
