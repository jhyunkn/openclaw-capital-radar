'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'outputs', 'visible-chart-freshness-report.json');

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return null; }
}

function get(obj, pathExpr) {
  return String(pathExpr).split('.').reduce((value, key) => value?.[key], obj);
}

function ageHours(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / 3_600_000;
}

function check(label, rel, pathExpr, maxHours) {
  const obj = readJson(rel);
  const timestamp = get(obj, pathExpr);
  const age = ageHours(timestamp);
  const ok = Number.isFinite(age) && age <= maxHours;
  return {
    label,
    path: rel,
    timestamp: timestamp || null,
    ageHours: Number.isFinite(age) ? Number(age.toFixed(1)) : null,
    maxHours,
    status: ok ? 'PASS' : 'FAIL',
  };
}

const indexPath = path.join(root, 'index.html');
const publicIndexPath = path.join(root, 'public/index.html');
const html = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
const indexMtime = fs.existsSync(indexPath) ? fs.statSync(indexPath).mtimeMs : 0;
const publicMtime = fs.existsSync(publicIndexPath) ? fs.statSync(publicIndexPath).mtimeMs : 0;
const publicHtml = fs.existsSync(publicIndexPath) && publicMtime >= indexMtime
  ? fs.readFileSync(publicIndexPath, 'utf8')
  : '';
const combinedHtml = html + publicHtml;

const checks = [
  check('Current market state', 'outputs/current-market-state.json', 'asOf', 24),
  check('Macro configuration', 'outputs/macro-configuration-state.json', 'generatedAt', 24),
  check('Macro historical analogs', 'outputs/macro-historical-analog-state.json', 'generatedAt', 24),
  check('Macro portfolio translation', 'outputs/macro-portfolio-translation-state.json', 'generatedAt', 24),
  check('Cross-asset market lens', 'outputs/market-lens-state.json', 'as_of', 24),
  check('Strategy routing state', 'outputs/strategy-routing-state.json', 'as_of', 24),
  check('Trust strip state', 'outputs/trust-strip-state.json', 'as_of', 24),
  check('Macro cycle state', 'outputs/macro-cycle-state.json', 'as_of', 24),
  check('Kostolany cycle diagram state', 'outputs/kostolany-egg-state.json', 'as_of', 24),
  check('Operational decision chart', 'outputs/operational-chart-state.json', 'as_of', 24),
  check('Macro price strip', 'outputs/macro-prices-state.json', 'generatedAt', 24),
  check('Holdings chart zones', 'outputs/holding-zone-state.json', 'as_of', 24),
];

if (/market-chart|chart-panel/i.test(combinedHtml)) {
  checks.push(check('Market chart panels', 'outputs/market-chart-panels.json', 'as_of', 48));
}

const staleLeakPatterns = [
  { label: 'June 2026 generated-state leak', pattern: /2026-06-\d\dT/i },
  { label: 'May 2026 generated-state leak', pattern: /2026-05-\d\dT/i },
  { label: 'Hardcoded June 13 portfolio leak', pattern: /4:30 AM\s*·\s*Jun 13/i },
  { label: 'Hardcoded June 26 cycle-position current marker', pattern: /YOU ARE HERE\s*\\xb7\s*Jun '26|YOU ARE HERE\s*·\s*Jun '26|Oct '23\s*→\s*Jun '26|Jun '26\s*▸|through Jun '26/i },
];

for (const leak of staleLeakPatterns) {
  checks.push({
    label: leak.label,
    path: 'index.html/public/index.html',
    timestamp: null,
    ageHours: null,
    maxHours: null,
    status: leak.pattern.test(combinedHtml) ? 'FAIL' : 'PASS',
  });
}

const failed = checks.filter(item => item.status !== 'PASS');
const report = {
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'FAIL' : 'PASS',
  summary: failed.length ? `${failed.length} visible chart freshness checks failed.` : 'Visible chart and diagram source states are fresh.',
  checks,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
fs.mkdirSync(path.join(root, 'public', 'outputs'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'outputs', 'visible-chart-freshness-report.json'), JSON.stringify(report, null, 2) + '\n');

console.log(JSON.stringify({ status: report.status, summary: report.summary, checks: checks.map(item => `${item.status}: ${item.label}`) }, null, 2));
if (failed.length) process.exit(1);
