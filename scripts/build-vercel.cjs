const fs = require('fs');
const path = require('path');
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
  state.meta = state.meta || {};
  state.meta.normalizedAtBuild = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

archiveLiveReport();
normalizeLiveState();
rm(out);
fs.mkdirSync(out, { recursive: true });
for (const entry of copyEntries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copy(src, path.join(out, entry));
}
fs.writeFileSync(path.join(out, 'health.json'), JSON.stringify({ ok: true, builtAt: new Date().toISOString() }, null, 2));
console.log(`Prepared Vercel static output at ${out}`);