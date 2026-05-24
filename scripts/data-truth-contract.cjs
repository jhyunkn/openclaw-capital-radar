const DEFAULT_ZERO_SUSPICION_KEYS = new Set([
  'dgs10',
  'dff',
  'm2',
  'hy_oas',
  'ten_year',
  'tenYear',
  'fed_funds',
  'effective_fed_funds',
  'treasury_10y',
]);

const TRUTH_TIERS = new Set(['REAL', 'DERIVED', 'EST', 'PROJ', 'MISSING', 'STALE']);

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMissingValue(value) {
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value));
}

function normalizeTier(value) {
  const tier = String(value || '').trim().toUpperCase();
  if (tier === 'REALTIME') return 'REAL';
  if (tier === 'CALCULATED') return 'DERIVED';
  if (tier === 'PROJECTED') return 'PROJ';
  if (TRUTH_TIERS.has(tier)) return tier;
  return '';
}

function ageHours(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return (now.getTime() - date.getTime()) / 36e5;
}

function isSuspiciousZero(key, value, options = {}) {
  const n = finiteNumber(value);
  if (n !== 0) return false;
  if (options.allowZero === true) return false;
  const keys = options.suspiciousZeroKeys || DEFAULT_ZERO_SUSPICION_KEYS;
  const k = String(key || '').trim();
  if (keys instanceof Set && keys.has(k)) return true;
  if (Array.isArray(keys) && keys.includes(k)) return true;
  return /(^|_)(dgs10|dff|m2|hy_oas|ten_?year|treasury|fed_?funds)($|_)/i.test(k);
}

function normalizeDataPoint(point = {}, options = {}) {
  const key = point.key || options.key || '';
  const sourceTime = point.as_of || point.date || point.timestamp || point.updatedAt || point.generatedAt || null;
  const maxAgeHours = Number.isFinite(Number(point.maxAgeHours)) ? Number(point.maxAgeHours) : options.maxAgeHours;
  let truthTier = normalizeTier(point.truthTier || point.tier || point.type || point.status);

  if (!truthTier) {
    if (isMissingValue(point.value)) truthTier = 'MISSING';
    else truthTier = 'REAL';
  }

  if (isMissingValue(point.value)) truthTier = 'MISSING';
  if (isSuspiciousZero(key, point.value, { ...options, allowZero: point.allowZero === true || options.allowZero === true })) truthTier = 'MISSING';

  const hours = ageHours(sourceTime, options.now || new Date());
  if (truthTier !== 'MISSING' && Number.isFinite(maxAgeHours) && hours !== null && hours > maxAgeHours) {
    truthTier = 'STALE';
  }

  return {
    ...point,
    key,
    truthTier,
    type: truthTier,
    sourceTime,
    sourceAgeHours: hours === null ? null : Number(hours.toFixed(2)),
    displaySafe: truthTier !== 'MISSING',
  };
}

function formatDataPoint(point = {}, digits = 2, options = {}) {
  const normalized = normalizeDataPoint(point, options);
  if (normalized.truthTier === 'MISSING') return 'MISSING';
  if (normalized.truthTier === 'STALE') return 'STALE';
  const n = finiteNumber(normalized.value);
  if (n === null) return 'MISSING';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function walk(value, visitor, path = []) {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, path.concat(index)));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, visitor, path.concat(key));
  }
}

function findZeroSuspicions(root, options = {}) {
  const findings = [];
  walk(root, (value, path) => {
    if (typeof value !== 'number') return;
    const key = String(path.at(-1) || '');
    if (!isSuspiciousZero(key, value, options)) return;
    findings.push({ path: path.join('.'), key, value });
  });
  return findings;
}

function countTruthTier(root, tier) {
  let count = 0;
  walk(root, value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const normalized = normalizeTier(value.truthTier || value.tier || value.type || value.status);
    if (normalized === tier) count += 1;
  });
  return count;
}

module.exports = {
  TRUTH_TIERS,
  DEFAULT_ZERO_SUSPICION_KEYS,
  finiteNumber,
  isMissingValue,
  normalizeTier,
  ageHours,
  isSuspiciousZero,
  normalizeDataPoint,
  formatDataPoint,
  findZeroSuspicions,
  countTruthTier,
};
