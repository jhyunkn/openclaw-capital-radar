const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const memoPath = path.join(root, 'outputs', 'ic-decision-memos.json');
const pagesDir = path.join(root, 'pages');
function fail(msg){ console.error(`IC MEMO VALIDATION FAILED: ${msg}`); process.exit(1); }
if (!fs.existsSync(memoPath)) fail('outputs/ic-decision-memos.json missing');
const data = JSON.parse(fs.readFileSync(memoPath, 'utf8'));
if (data.layer !== 'ic-decision-memos') fail('wrong layer');
if (!Array.isArray(data.memos) || !data.memos.length) fail('no memos generated');
const allowed = new Set(['EXIT REVIEW','TRIM REVIEW','DO NOT ADD','CAPITAL BLOCKED','ADD REVIEW ALLOWED','RESEARCH FIRST','HOLD / MONITOR']);
let checked = 0;
for (const m of data.memos) {
  const ticker = String(m.ticker || '').toUpperCase();
  if (!ticker) fail('memo missing ticker');
  if (!allowed.has(m.decision)) fail(`${ticker}: unsupported decision ${m.decision}`);
  for (const key of ['reason','allowedAction','forbiddenAction','coverageState','actionPermission']) {
    if (!String(m[key] || '').trim()) fail(`${ticker}: missing ${key}`);
  }
  if (typeof m.thesisCoverageScore !== 'number') fail(`${ticker}: missing numeric thesisCoverageScore`);
  const file = path.join(pagesDir, `${ticker.toLowerCase()}.html`);
  if (!fs.existsSync(file)) fail(`${ticker}: ticker page missing`);
  const html = fs.readFileSync(file, 'utf8');
  const ic = html.indexOf('id="ic-decision-memo"');
  const coverage = html.indexOf('id="thesis-coverage-workbench"');
  const interpreter = html.indexOf('id="strategy-interpreter"');
  if (ic < 0) fail(`${ticker}: IC memo not injected`);
  if (!(ic < coverage && coverage < interpreter)) fail(`${ticker}: IC memo must appear before coverage and interpreter`);
  if ((html.match(/id="ic-decision-memo"/g) || []).length !== 1) fail(`${ticker}: duplicate IC memo`);
  checked += 1;
}
if (!data.summary || data.summary.total !== data.memos.length) fail('summary total mismatch');
console.log(`IC decision memos validated: ${checked} ticker pages`);
