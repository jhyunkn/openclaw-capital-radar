const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeDataHealthFromFile } = require('../lib/data-health.cjs');
const root = path.join(__dirname, '..');
const out = path.join(root, 'public');
const copyEntries = ['index.html', 'assets', 'data', 'outputs', 'pages'];

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) copy(path.join(src, child), path.join(dest, child));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function extractMarkdownSubsection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('^###\\s+' + escaped + '\\s*$', 'mi');
  const match = markdown.match(pattern);
  if (!match || match.index == null) return '';
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^###\s+|^##\s+/m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function parseMarkdownTable(block) {
  const lines = block.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'));
  if (lines.length < 2) return [];
  const header = lines[0].split('|').slice(1, -1).map(cell => cell.trim());
  return lines.slice(2).map(line => {
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  }).filter(row => Object.values(row).some(Boolean));
}

function parseNumericMetric(raw) {
  if (raw == null) return null;
  const match = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function metricSource(holding, fieldName, value) {
  if (value == null) return { source: null, sourceAsOf: null, confidence: 'missing' };
  const hasFinviz = holding?.finviz && JSON.stringify(holding.finviz).includes(String(value));
  return {
    source: hasFinviz ? 'finviz-derived holding metadata' : 'holding JSON field',
    sourceAsOf: holding?.finviz?.asOf || holding?.priceAsOf || holding?.asOf || null,
    confidence: hasFinviz ? 'medium' : 'low'
  };
}

function holdingDataContract(holding) {
  const metrics = holding?.finviz?.metrics || {};
  const forwardPE = parseNumericMetric(firstValue(
    holding.forwardPE,
    holding.forwardPe,
    metrics['Forward P/E'],
    metrics['Forward PE']
  ));
  const directFcfYield = parseNumericMetric(firstValue(
    holding.fcfYield,
    holding.freeCashFlowYield,
    metrics['FCF Yield'],
    metrics['Free Cash Flow Yield']
  ));
  const pfcf = parseNumericMetric(metrics['P/FCF']);
  const fcfYield = Number.isFinite(directFcfYield)
    ? directFcfYield
    : Number.isFinite(pfcf) && pfcf > 0 ? 100 / pfcf : null;
  const nextEarningsDate = normalizeDate(firstValue(
    holding.nextEarningsDate,
    holding.earningsDate,
    metrics.Earnings,
    metrics['Earnings Date']
  ));

  return {
    requiredFields: ['forwardPE', 'fcfYield', 'nextEarningsDate', 'source', 'sourceAsOf', 'confidence'],
    forwardPE,
    fcfYield,
    nextEarningsDate,
    source: {
      forwardPE: metricSource(holding, 'forwardPE', forwardPE).source,
      fcfYield: metricSource(holding, 'fcfYield', fcfYield).source,
      nextEarningsDate: nextEarningsDate ? 'earnings metadata field' : null
    },
    sourceAsOf: {
      forwardPE: metricSource(holding, 'forwardPE', forwardPE).sourceAsOf,
      fcfYield: metricSource(holding, 'fcfYield', fcfYield).sourceAsOf,
      nextEarningsDate: nextEarningsDate ? (holding?.finviz?.asOf || holding?.priceAsOf || holding?.asOf || null) : null
    },
    confidence: {
      forwardPE: metricSource(holding, 'forwardPE', forwardPE).confidence,
      fcfYield: metricSource(holding, 'fcfYield', fcfYield).confidence,
      nextEarningsDate: nextEarningsDate ? 'low' : 'missing'
    },
    normalizedAtBuild: true
  };
}

function archiveLiveReport() {
  const mdPath = path.join(root, 'outputs', 'live-capital-radar.md');
  if (!fs.existsSync(mdPath)) return;
  const markdown = fs.readFileSync(mdPath, 'utf8');
  const dateMatch = markdown.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  const archiveDir = path.join(root, 'outputs', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const archiveFile = path.join(archiveDir, `${date}-capital-radar.md`);
  fs.writeFileSync(archiveFile, markdown);

  const files = fs.readdirSync(archiveDir)
    .filter(file => /^\d{4}-\d{2}-\d{2}-capital-radar\.md$/.test(file))
    .sort()
    .reverse();
  const links = files.map(file => `- [${file.replace('-capital-radar.md', '')}](./${file})`).join('\n');
  fs.writeFileSync(path.join(archiveDir, 'index.md'), `# OpenClaw Capital Radar Archive\n\n${links}\n`);
  fs.writeFileSync(path.join(archiveDir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capital Radar Archive</title><link rel="stylesheet" href="../../assets/capital-radar.css"></head><body><main class="shell"><section class="panel"><div class="section-head"><div><p class="eyebrow">Archive</p><h1>Capital Radar Archive</h1></div><a class="button" href="../live-capital-radar.md">Live report</a></div><div class="source-grid">${files.map(file => `<article class="source"><h3>${file.replace('-capital-radar.md', '')}</h3><p class="muted">Daily archived markdown report.</p><a class="detail-link" href="./${file}">Open report →</a></article>`).join('') || '<p class="muted">No archived reports yet.</p>'}</div></section></main></body></html>`);
}

function normalizeLiveState() {
  const statePath = path.join(root, 'data', 'report-state.live.json');
  const mdPath = path.join(root, 'outputs', 'live-capital-radar.md');
  if (!fs.existsSync(statePath)) return;
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const hasRates = Array.isArray(state.liveRatesCredit) && state.liveRatesCredit.length;
  if (!hasRates && fs.existsSync(mdPath)) {
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const rows = parseMarkdownTable(extractMarkdownSubsection(markdown, 'Rates / credit / liquidity'));
    state.liveRatesCredit = rows.map(row => ({
      id: row.Series,
      name: row.Name,
      value: Number.isFinite(Number(row.Value)) ? Number(row.Value) : row.Value,
      latestDate: row['Latest date'],
      source: 'outputs/live-capital-radar.md Evidence Appendix',
      normalizedAtBuild: true
    })).filter(row => row.id);
  }
  const hasMarket = Array.isArray(state.liveMarket) && state.liveMarket.length;
  if (!hasMarket && fs.existsSync(mdPath)) {
    const markdown = fs.readFileSync(mdPath, 'utf8');
    const rows = parseMarkdownTable(extractMarkdownSubsection(markdown, 'Market tape'));
    state.liveMarket = rows.map(row => ({
      symbol: row.Symbol,
      price: Number(row.Price),
      changePct: Number(row['Day %']),
      perf5dPct: Number(row['5D %']),
      perf1mPct: Number(row['1M %']),
      perf3mPct: Number(row['3M %']),
      asOf: row['As of'],
      source: 'outputs/live-capital-radar.md Evidence Appendix',
      normalizedAtBuild: true
    })).filter(row => row.symbol);
  }
  state.holdings = Array.isArray(state.holdings) ? state.holdings.map(holding => ({
    ...holding,
    dataContract: holdingDataContract(holding)
  })) : state.holdings;
  state.meta = state.meta || {};
  state.meta.holdingDataContract = {
    requiredFields: ['forwardPE', 'fcfYield', 'nextEarningsDate', 'source', 'sourceAsOf', 'confidence'],
    normalizedAtBuild: new Date().toISOString(),
    policy: 'Missing values are explicit nulls with confidence=missing; no synthetic fundamentals or earnings dates are invented.'
  };
  state.meta.normalizedAtBuild = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  writeDataHealthFromFile(statePath, path.join(root, 'outputs', 'data-health.json'));
}

function runFinalInjector(scriptName, errorMessage, args = []) {
  const script = path.join(root, 'scripts', scriptName);
  if (!fs.existsSync(script)) return;
  const command = `node scripts/${scriptName}${args.length ? ' ' + args.map(arg => JSON.stringify(arg)).join(' ') : ''}`;
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(errorMessage);
}

function verifyFinalOutput() {
  const htmlPath = path.join(out, 'index.html');
  if (!fs.existsSync(htmlPath)) throw new Error('public/index.html missing after Vercel build');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const requiredIds = [
    'market-diagnosis-board',
    'macro-configuration-board',
    'relationship-intelligence',
    'macro-historical-board',
    'macro-portfolio-board',
    'macro-design-language-style'
  ];
  const missing = requiredIds.filter(id => !html.includes(`id="${id}"`));
  if (missing.length) throw new Error(`Macro integration chain missing from final public/index.html: ${missing.join(', ')}`);
}

archiveLiveReport();
normalizeLiveState();
runFinalInjector('inject-duration-evidence-banner.cjs', 'Duration evidence receipt injection failed before Vercel copy');
runFinalInjector('inject-market-diagnosis-board.cjs', 'Market Diagnosis Board injection failed before Vercel copy');
runFinalInjector('inject-macro-configuration-board.cjs', 'Macro Configuration Board injection failed before Vercel copy');
runFinalInjector('inject-relationship-intelligence-layer.cjs', 'Relationship Intelligence layer injection failed before Vercel copy');
runFinalInjector('inject-macro-historical-analog-board.cjs', 'Macro Historical Memory Board injection failed before Vercel copy');
runFinalInjector('inject-macro-portfolio-translation-board.cjs', 'Macro Portfolio Translation Board injection failed before Vercel copy');
runFinalInjector('inject-evidence-annotation-layer.cjs', 'Evidence Annotation layer injection failed before Vercel copy');
runFinalInjector('inject-macro-design-language.cjs', 'Macro design language injection failed before Vercel copy');
rm(out);
fs.mkdirSync(out, { recursive: true });
for (const entry of copyEntries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copy(src, path.join(out, entry));
}
runFinalInjector('inject-market-diagnosis-board.cjs', 'Market Diagnosis Board injection failed after Vercel copy', ['public/index.html']);
runFinalInjector('inject-macro-configuration-board.cjs', 'Macro Configuration Board injection failed after Vercel copy', ['public/index.html']);
runFinalInjector('inject-relationship-intelligence-layer.cjs', 'Relationship Intelligence layer injection failed after Vercel copy', ['public/index.html']);
runFinalInjector('inject-macro-historical-analog-board.cjs', 'Macro Historical Memory Board injection failed after Vercel copy', ['public/index.html']);
runFinalInjector('inject-macro-portfolio-translation-board.cjs', 'Macro Portfolio Translation Board injection failed after Vercel copy', ['public/index.html']);
runFinalInjector('inject-macro-design-language.cjs', 'Macro design language injection failed after Vercel copy', ['public/index.html']);
verifyFinalOutput();
fs.writeFileSync(path.join(out, 'health.json'), JSON.stringify({ ok: true, builtAt: new Date().toISOString() }, null, 2));
console.log(`Prepared Vercel static output at ${out}`);
