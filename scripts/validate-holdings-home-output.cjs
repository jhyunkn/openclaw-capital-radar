const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const zoneStatePath = path.join(root, 'outputs', 'holding-zone-state.json');
const outputsDir = path.join(root, 'outputs');
const reportPath = path.join(outputsDir, 'holdings-home-output-validation-report.json');

function writeReport(report) {
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

if (!fs.existsSync(indexPath)) {
  writeReport({
    generatedAt: new Date().toISOString(),
    status: 'FAILED',
    error: 'index.html missing',
  });
  throw new Error('index.html missing');
}

const html = fs.readFileSync(indexPath, 'utf8');
const legacyRoleMethodRows = (html.match(/<div class="mini-row"><span>Role<\/span><b>[\s\S]*?<\/div><\/article>/g) || []).length;
const holdingsSectionCount = (html.match(/id=["']holdings-section["']/g) || []).length;
const legacyZoneCardCount = (html.match(/class=["'][^"']*zone-card/g) || []).length;
const modularHoldingCardCount = (html.match(/class=["'][^"']*mu-holding-card/g) || []).length;
const zoneCardCount = modularHoldingCardCount || legacyZoneCardCount;
const permissionRowCount = (html.match(/class=["'][^"']*(?:mu-)?permission-row/g) || []).length;
const hasSignalPermissionExplainer = html.includes('Terms stay familiar: Buy means a buy-zone signal. Permission shows whether capital is actually allowed');
const zoneState = fs.existsSync(zoneStatePath) ? JSON.parse(fs.readFileSync(zoneStatePath, 'utf8')) : { zones: [] };
const zones = Array.isArray(zoneState.zones) ? zoneState.zones : [];

const warnings = [];
if (holdingsSectionCount !== 1) warnings.push(`holdings_section_count=${holdingsSectionCount}`);
if (legacyRoleMethodRows > 0) warnings.push(`legacy_role_method_rows=${legacyRoleMethodRows}`);
if (zoneCardCount < 1) warnings.push('zone_card_count_below_1');
if (permissionRowCount !== zoneCardCount) warnings.push(`permission_row_count=${permissionRowCount}; expected=${zoneCardCount}`);
if (!hasSignalPermissionExplainer) warnings.push('missing_signal_vs_permission_explainer');
for (const z of zones) {
  const ticker = String(z.ticker || 'UNKNOWN').toUpperCase();
  const permission = String(z.execution_permission || z.route_permission || '');
  if (!permission) warnings.push(`${ticker}: missing execution_permission`);
  if (z.route_permission === 'ADD_REVIEW' && z.capital_allowed !== true) warnings.push(`${ticker}: ADD_REVIEW without capital_allowed=true`);
  if (z.capital_allowed === true && z.route_permission !== 'ADD_REVIEW') warnings.push(`${ticker}: capital_allowed=true without ADD_REVIEW`);
  if (/EXIT|TRIM/.test(permission) && z.loss_minimization_required !== true) warnings.push(`${ticker}: ${permission} without loss_minimization_required=true`);
  if (/VERIFY|BLOCKED|NO_ADD|HOLD_ONLY|WAIT/.test(permission) && z.capital_allowed === true) warnings.push(`${ticker}: blocked/verify permission has capital_allowed=true`);
  if (/near_buy_zone|buy/i.test(String(z.zone_status || '')) && !z.execution_permission) warnings.push(`${ticker}: buy-zone signal missing execution permission`);
}

const report = {
  generatedAt: new Date().toISOString(),
  status: warnings.length ? 'FAILED' : 'OK',
  holdings_section_count: holdingsSectionCount,
  zone_card_count: zoneCardCount,
  modular_holding_card_count: modularHoldingCardCount,
  legacy_zone_card_count: legacyZoneCardCount,
  permission_row_count: permissionRowCount,
  legacy_role_method_rows: legacyRoleMethodRows,
  checked_zone_permissions: zones.length,
  warnings,
};

writeReport(report);

if (report.status !== 'OK') {
  throw new Error(`Holdings home output validation failed: ${warnings.join(', ')}`);
}

console.log(`Holdings home output validation OK: ${zoneCardCount} zone cards; no legacy Role/Method rows`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
