const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const evidencePath = path.join(root, 'outputs', 'research-evidence-packets.json');
const pagesDir = path.join(root, 'pages');
function fail(message){ console.error(`RESEARCH EVIDENCE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(evidencePath), 'outputs/research-evidence-packets.json missing');
const data = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert(Array.isArray(data.holdings), 'holdings evidence array missing');
assert(Array.isArray(data.all), 'all evidence array missing');
assert(data.holdings.length > 0, 'no holding evidence packets generated');
const required = ['ticker','type','generatedAt','freshness','evidenceSummary','sourceList','valuationSnapshot','earningsCatalystCalendar','macroSensitivity','dataConfidence','unresolvedQuestions'];
for (const p of data.all) {
  for (const key of required) assert(p[key] !== undefined && p[key] !== null, `${p.ticker || 'unknown'} missing ${key}`);
  assert(String(p.evidenceSummary).length >= 80, `${p.ticker} evidenceSummary too thin`);
  assert(Array.isArray(p.sourceList) && p.sourceList.length >= 3, `${p.ticker} sourceList too thin`);
  for (const s of p.sourceList) {
    assert(s.label, `${p.ticker} source missing label`);
    assert(s.type, `${p.ticker} source missing type`);
    assert(s.confidence, `${p.ticker} source missing confidence`);
    assert(Array.isArray(s.fields), `${p.ticker} source fields missing`);
  }
  assert(p.freshness && p.freshness.label, `${p.ticker} freshness label missing`);
  assert(p.valuationSnapshot && p.valuationSnapshot.relevance, `${p.ticker} valuation relevance missing`);
  assert(Array.isArray(p.earningsCatalystCalendar) && p.earningsCatalystCalendar.length >= 1, `${p.ticker} catalyst calendar missing`);
  assert(Array.isArray(p.macroSensitivity) && p.macroSensitivity.length >= 1, `${p.ticker} macroSensitivity missing`);
  assert(p.dataConfidence && typeof p.dataConfidence.score === 'number', `${p.ticker} dataConfidence score missing`);
  assert(Array.isArray(p.unresolvedQuestions) && p.unresolvedQuestions.length >= 1, `${p.ticker} unresolvedQuestions missing`);
  const page = path.join(pagesDir, `${String(p.ticker).toLowerCase()}.html`);
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8');
    assert(html.includes('Research Evidence Engine'), `${p.ticker} page missing Research Evidence Engine section`);
    assert(html.includes(`${p.ticker} evidence packet`), `${p.ticker} page missing evidence packet heading`);
  }
}
console.log(`research evidence packets validated: ${data.holdings.length} holdings / ${(data.candidates || []).length} candidates`);
