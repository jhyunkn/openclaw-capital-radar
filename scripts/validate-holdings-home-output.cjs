const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
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
const zoneCardCount = (html.match(/class=["'][^"']*zone-card/g) || []).length;

const warnings = [];
if (holdingsSectionCount !== 1) warnings.push(`holdings_section_count=${holdingsSectionCount}`);
if (legacyRoleMethodRows > 0) warnings.push(`legacy_role_method_rows=${legacyRoleMethodRows}`);
if (zoneCardCount < 1) warnings.push('zone_card_count_below_1');

const report = {
  generatedAt: new Date().toISOString(),
  status: warnings.length ? 'FAILED' : 'OK',
  holdings_section_count: holdingsSectionCount,
  zone_card_count: zoneCardCount,
  legacy_role_method_rows: legacyRoleMethodRows,
  warnings,
};

writeReport(report);

if (report.status !== 'OK') {
  throw new Error(`Holdings home output validation failed: ${warnings.join(', ')}`);
}

console.log(`Holdings home output validation OK: ${zoneCardCount} zone cards; no legacy Role/Method rows`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
