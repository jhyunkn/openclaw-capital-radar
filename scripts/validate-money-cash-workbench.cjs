const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'money-cash-state.json');
const indexPath = path.join(root, 'index.html');
const reportPath = path.join(root, 'outputs', 'money-cash-workbench-validation-report.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return null; }
}

function arr(value) { return Array.isArray(value) ? value : []; }
function validRows(rows) { return arr(rows).filter(row => row && row.date && Number.isFinite(Number(row.value))); }

function fail(errors, warnings = []) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    status: 'FAILED',
    errors,
    warnings
  }, null, 2));
  console.error(`Money / Cash workbench validation failed: ${errors.join('; ')}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const state = readJson(statePath);
if (!state) errors.push('money-cash-state.json missing or unreadable');

if (state) {
  const main = state.chart_series?.money_cash_main?.series || {};
  const tbillRows = validRows(main.tbill_3m_yield);
  const cpiRows = validRows(main.cpi_yoy);
  const realRows = validRows(main.real_cash_yield);
  const supportedAnnotations = arr(state.annotation_spec?.charts?.money_cash_main);

  if (state.coverage === 'MISSING') errors.push('coverage is MISSING');
  if (tbillRows.length < 24) errors.push(`tbill_3m_yield chart rows too low: ${tbillRows.length}`);
  if (cpiRows.length < 24) errors.push(`cpi_yoy chart rows too low: ${cpiRows.length}`);
  if (realRows.length < 24) errors.push(`real_cash_yield chart rows too low: ${realRows.length}`);
  if (!Number.isFinite(Number(state.derived?.real_cash_yield?.value))) errors.push('derived real_cash_yield missing');
  if (supportedAnnotations.length < 3) warnings.push(`supported money_cash_main annotations low: ${supportedAnnotations.length}`);
}

if (!fs.existsSync(indexPath)) {
  errors.push('index.html missing');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('money-cash-workbench')) errors.push('Money / Cash workbench missing from index.html');
  if (!html.includes('money-cash-svg')) errors.push('Money / Cash SVG chart missing from index.html');
  if (html.includes('Money / Cash chart data is pending')) errors.push('Money / Cash chart rendered fallback / pending state');
  if (!html.includes('3M T-bill yield vs CPI YoY vs real cash yield')) errors.push('Money / Cash chart title missing');
}

if (errors.length) fail(errors, warnings);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: 'OK',
  warnings
}, null, 2));
console.log('Money / Cash workbench validation passed');
