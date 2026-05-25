const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'outputs');

function readJson(rel, fallback = null) {
  const file = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function arr(v) { return Array.isArray(v) ? v : []; }
function pct(n) { return `${Math.round(Number(n) || 0)}%`; }
function has(obj, keys) {
  return keys.some(k => {
    const parts = k.split('.');
    let cur = obj;
    for (const p of parts) cur = cur && cur[p];
    if (Array.isArray(cur)) return cur.length > 0;
    return cur !== undefined && cur !== null && cur !== '';
  });
}

const taxonomy = readJson('config/investment-evidence-taxonomy.json', { evidence_clusters: [] });
const homepage = readJson('config/homepage-sections.json', { sections: [] });
const opportunity = readJson('outputs/opportunity-asymmetry-state.json', {});
const holdings = readJson('outputs/holding-zone-state.json', {});
const route = readJson('outputs/strategy-routing-state.json', {});
const lens = readJson('outputs/market-lens-state.json', {});
const chart = readJson('outputs/operational-chart-state.json', {});
const landscape = readJson('outputs/market-landscape-state.json', {});
const evidenceMap = readJson('outputs/institutional-evidence-map.json', { evidence: [] });
const sourceLedger = readJson('outputs/source-reliability-ledger.json', {});

const artifacts = {
  macro_reading: [
    'outputs/market-landscape-state.json',
    'outputs/market-lens-state.json',
    'outputs/strategy-routing-state.json',
    'outputs/institutional-evidence-map.json'
  ],
  market_execution_map: [
    'outputs/operational-chart-state.json',
    'outputs/sp500-decision-map-state.json',
    'outputs/market-lens-state.json',
    'outputs/strategy-routing-state.json'
  ],
  price_zone_radar: [
    'outputs/holding-zone-state.json',
    'outputs/portfolio-exposure-map.json',
    'outputs/portfolio-thesis-coverage-map.json',
    'outputs/ticker-gate-audit.json'
  ],
  opportunity_research: [
    'outputs/opportunity-asymmetry-state.json',
    'outputs/opportunity-evidence-packets.json',
    'outputs/opportunity-dossiers.json',
    'outputs/sec-company-evidence-collection.json'
  ],
  evidence_trust_engine: [
    'outputs/source-reliability-ledger.json',
    'outputs/institutional-evidence-map.json',
    'outputs/native-source-registry.json',
    'outputs/data-health.json'
  ]
};

const layers = [
  {
    id: 'macro_reading',
    label: 'Macro Reading',
    role: 'Integrate Egg, Command Center, and confirmation signals into one regime read.',
    status: 'integrate',
    visual_authority: 'one integrated macro read; Egg remains as framework graphic',
    evidence_checks: [
      ['market lens exists', lens, ['lenses']],
      ['strategy route exists', route, ['route', 'active_route', 'regime']],
      ['market landscape exists', landscape, ['directional_thesis', 'market_focus']],
      ['institutional evidence map exists', evidenceMap, ['evidence']]
    ]
  },
  {
    id: 'market_execution_map',
    label: 'Market Execution Map',
    role: 'Keep the current Decision Map; enrich it with evidence and scenario justification.',
    status: 'keep_and_refine',
    visual_authority: 'current Decision Map remains primary market execution graphic',
    evidence_checks: [
      ['operational chart exists', chart, ['current_price', 'decision', 'levels', 'series']],
      ['market lens exists', lens, ['lenses']],
      ['strategy route exists', route, ['route', 'active_route', 'regime']]
    ]
  },
  {
    id: 'price_zone_radar',
    label: 'Portfolio / Price Zone Radar',
    role: 'Keep the current holdings zone system; add fundamentals, valuation, catalysts, and sizing logic.',
    status: 'keep_and_enrich',
    visual_authority: 'current holding zone cards remain primary portfolio action surface',
    evidence_checks: [
      ['holding zones exist', holdings, ['zones', 'holdings', 'summary']],
      ['ticker gate audit exists', readJson('outputs/ticker-gate-audit.json', {}), ['tickers', 'records', 'audit']],
      ['portfolio exposure exists', readJson('outputs/portfolio-exposure-map.json', {}), ['positions', 'exposures', 'summary']]
    ]
  },
  {
    id: 'opportunity_research',
    label: 'Opportunity Research Engine',
    role: 'Rebuild Opportunity from ranking table into evidence-backed research dossiers.',
    status: 'rebuild',
    visual_authority: 'opportunity cards should show evidence gates, thesis, blockers, and upgrade/reject logic',
    evidence_checks: [
      ['opportunity asymmetry state exists', opportunity, ['opportunity_clusters']],
      ['opportunity evidence packets exist', readJson('outputs/opportunity-evidence-packets.json', {}), ['packets', 'priorityQueue']],
      ['opportunity dossiers exist', readJson('outputs/opportunity-dossiers.json', {}), ['dossiers', 'records']],
      ['SEC/company evidence exists', readJson('outputs/sec-company-evidence-collection.json', {}), ['records']]
    ]
  },
  {
    id: 'evidence_trust_engine',
    label: 'Evidence / Source / Trust Engine',
    role: 'Validate source quality, freshness, and support level behind strategy claims.',
    status: 'underlay_everything',
    visual_authority: 'quiet audit layer; not a dominant homepage section unless needed for trust',
    evidence_checks: [
      ['source ledger exists', sourceLedger, ['sources', 'records', 'ledger']],
      ['native source registry exists', readJson('outputs/native-source-registry.json', {}), ['sources', 'records']],
      ['data health exists', readJson('outputs/data-health.json', {}), ['status', 'checks']]
    ]
  }
];

function auditLayer(layer) {
  const checks = layer.evidence_checks.map(([label, obj, keys]) => ({ label, passed: has(obj || {}, keys), keys }));
  const artifactRows = (artifacts[layer.id] || []).map(file => ({ file, exists: exists(file) }));
  const passed = checks.filter(c => c.passed).length;
  const coverage = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  const missing = checks.filter(c => !c.passed).map(c => c.label);
  return { ...layer, coverage_pct: coverage, checks, artifacts: artifactRows, missing_evidence: missing };
}

const auditedLayers = layers.map(auditLayer);
const taxonomyCoverage = arr(taxonomy.evidence_clusters).map(cluster => {
  const id = cluster.id;
  const mapped = {
    macro_regime: ['macro_reading'],
    liquidity_credit: ['macro_reading', 'market_execution_map'],
    market_structure: ['macro_reading', 'market_execution_map'],
    sector_theme: ['macro_reading', 'opportunity_research', 'price_zone_radar'],
    ticker_fundamentals: ['price_zone_radar', 'opportunity_research'],
    valuation_expectations: ['price_zone_radar', 'opportunity_research'],
    ticker_catalyst: ['price_zone_radar', 'opportunity_research'],
    technical_entry: ['market_execution_map', 'price_zone_radar', 'opportunity_research'],
    portfolio_context: ['price_zone_radar']
  }[id] || [];
  return { id, label: cluster.label, supports_layers: mapped, required_fields: arr(cluster.required_fields), decision_questions: arr(cluster.decision_questions) };
});

const recommendations = [
  'Integrate Egg, Command Center, and confirmation signals into Macro Reading instead of rendering them as separate authority sources.',
  'Keep Decision Map and Price Zone Radar as primary graphics; add evidence support rather than replacing them.',
  'Rebuild Opportunity around evidence packets, valuation/fundamental fields, and upgrade/reject gates.',
  'Make OpenClaw collect or validate missing ticker fundamentals, valuation, capex, catalyst, and source-reliability fields.',
  'Use the homepage as a daily operating note; keep deeper evidence in linked dossiers and audit artifacts.'
];

const output = {
  generatedAt: new Date().toISOString(),
  status: 'OK',
  purpose: 'Holistic Capital Radar architecture and evidence coverage audit.',
  homepage_sections: arr(homepage.sections).map(s => ({ id: s.id, name: s.name, enabled: s.enabled !== false })),
  layers: auditedLayers,
  taxonomy_coverage: taxonomyCoverage,
  recommendations,
  next_openclaw_tasks: auditedLayers.flatMap(layer => layer.missing_evidence.map(m => ({ layer: layer.id, missing: m, task: `Collect or validate evidence for ${layer.label}: ${m}.` })))
};

function md() {
  const lines = [];
  lines.push('# Capital Radar Architecture Audit');
  lines.push('');
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push('');
  lines.push('## Layer Coverage');
  lines.push('');
  for (const layer of output.layers) {
    lines.push(`### ${layer.label}`);
    lines.push('');
    lines.push(`- Status: ${layer.status}`);
    lines.push(`- Coverage: ${pct(layer.coverage_pct)}`);
    lines.push(`- Role: ${layer.role}`);
    lines.push(`- Visual authority: ${layer.visual_authority}`);
    lines.push(`- Missing evidence: ${layer.missing_evidence.length ? layer.missing_evidence.join('; ') : 'none detected by this audit'}`);
    lines.push('');
  }
  lines.push('## Recommendations');
  lines.push('');
  output.recommendations.forEach(r => lines.push(`- ${r}`));
  lines.push('');
  lines.push('## OpenClaw Tasks');
  lines.push('');
  if (!output.next_openclaw_tasks.length) lines.push('- No missing evidence tasks detected by this audit.');
  output.next_openclaw_tasks.forEach(t => lines.push(`- ${t.task}`));
  lines.push('');
  return lines.join('\n');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'capital-radar-architecture-audit.json'), JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'capital-radar-architecture-audit.md'), md());
fs.mkdirSync(path.join(root, 'public', 'outputs'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'outputs', 'capital-radar-architecture-audit.json'), JSON.stringify(output, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'public', 'outputs', 'capital-radar-architecture-audit.md'), md());
console.log(`generated Capital Radar architecture audit: ${auditedLayers.map(l => `${l.id}=${l.coverage_pct}%`).join(', ')}`);
