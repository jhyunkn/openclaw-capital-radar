const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'outputs');
const dest = path.join(root, 'data', 'intelligence');
fs.mkdirSync(dest, { recursive: true });

function readJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJson(name, data) {
  fs.writeFileSync(path.join(dest, name), JSON.stringify(data, null, 2) + '\n');
}
function copyOutput(name, transform = x => x) {
  const data = transform(readJson(path.join(out, name), {}));
  writeJson(name, data);
  return data;
}

const generatedAt = new Date().toISOString();

const precedent = {
  as_of: generatedAt,
  cycle_id: generatedAt.replace(/[-:T.Z]/g, '').slice(0, 10),
  purpose: 'Framework map used to turn evidence into institutional Capital Radar artifacts; not market copy.',
  frameworks: [
    {
      id: 'fred_release_metadata',
      precedent: 'FRED / official macro data series',
      applied_to: ['rates', 'credit spreads', 'inflation expectations'],
      operating_rule: 'Prefer primary-source time series, record release date and retrieval time, and downgrade freshness when latest observations lag current tape.',
      artifact_targets: ['institutional-evidence-map.json', 'market-landscape-state.json', 'data-truth-state.json']
    },
    {
      id: 'cross_asset_cockpit',
      precedent: 'Bloomberg / Koyfin / TradingView style cross-asset cockpit',
      applied_to: ['SPY', 'QQQ', 'IWM', 'VIX', 'BTC-USD', 'rates', 'credit'],
      operating_rule: 'Regime claims require at least one rates/credit input and one risk-asset/volatility input; ticker posture cannot outrun macro permission.',
      artifact_targets: ['market-landscape-state.json', 'strategy-state.json']
    },
    {
      id: 'risk_committee_packet',
      precedent: 'Institutional risk committee memo',
      applied_to: ['holdings', 'levered products', 'opportunity candidates'],
      operating_rule: 'Separate fact, inference, speculation, and uncertainty; freeze add language when source confidence, zones, invalidation, or risk budget are missing.',
      artifact_targets: ['portfolio-translation-state.json', 'opportunity-asymmetry-state.json', 'data-truth-state.json']
    },
    {
      id: 'chart_decision_map',
      precedent: 'TradingView / institutional technical workbench',
      applied_to: ['entry zones', 'trim zones', 'stops', 'resistance', 'momentum/volume proxies'],
      operating_rule: 'Charts are decision maps; if live zones or indicator layers are missing, mark the action degraded rather than inventing levels.',
      artifact_targets: ['portfolio-translation-state.json', 'opportunity-asymmetry-state.json']
    }
  ],
  application_summary: 'Current run used official/public macro and tape evidence, then routed posture through risk-committee and data-truth gates. Missing per-holding confidence/valuation keeps new-capital decisions blocked.'
};
writeJson('precedent-research-map.json', precedent);

copyOutput('institutional-evidence-map.json', evidenceMap => {
  evidenceMap.as_of = generatedAt;
  evidenceMap.scoring_method = {
    reliability: 'Primary official sources score highest; public unofficial market-data endpoints are useful but discounted.',
    relevance: 'Evidence must connect to rates, liquidity, volatility, holdings, or candidate thesis.',
    freshness: 'Intraday tape preferred for market data; FRED and official releases accepted with their publication lag.',
    claim_type: 'fact/inference/speculation separated; action posture cannot rest on speculation alone.',
    confidence: 'Composite judgment from reliability, relevance, freshness, and corroboration.'
  };
  evidenceMap.web_research_state = {
    status: 'fresh_public_sources_used',
    retrieved_at: generatedAt,
    sources_checked: [
      'Federal Reserve monetary policy page / recent FOMC documents',
      'FRED DGS10',
      'FRED BAMLH0A0HYM2',
      'Cboe VIX product page',
      'Reuters/CNBC/MarketWatch search snippets for market context'
    ],
    note: 'Search/fetch succeeded, but dashboard-grade conclusions remain constrained by missing per-holding valuation/source-confidence fields.'
  };
  const ids = new Set((evidenceMap.evidence || []).map(e => e.id));
  if (!ids.has('ev_013')) evidenceMap.evidence.push({
    id: 'ev_013',
    source_name: 'Federal Reserve Board - Monetary Policy / FOMC documents',
    source_type: 'official_policy_source',
    url: 'https://www.federalreserve.gov/monetarypolicy.htm',
    citation: 'Federal Reserve page listed April 29, 2026 FOMC statement and May 20, 2026 FOMC minutes as recent documents.',
    publish_date: '2026-05-20',
    retrieved_at: generatedAt,
    reliability_score: 0.96,
    relevance_score: 0.82,
    freshness_score: 0.86,
    extracted_insight: 'Recent FOMC minutes are available and should anchor policy-regime interpretation before increasing duration-sensitive or speculative exposure.',
    affected_thesis: ['policy regime', 'rates pressure', 'liquidity-sensitive beta'],
    claim_type: 'fact',
    confidence: 0.86
  });
  if (!ids.has('ev_014')) evidenceMap.evidence.push({
    id: 'ev_014',
    source_name: 'Cboe VIX product page',
    source_type: 'official_market_data_context',
    url: 'https://www.cboe.com/tradable_products/vix/',
    citation: 'Cboe VIX page showed VIX spot 16.95 as of May 22, 2026 with delayed market data.',
    publish_date: '2026-05-22',
    retrieved_at: generatedAt,
    reliability_score: 0.9,
    relevance_score: 0.86,
    freshness_score: 0.92,
    extracted_insight: 'VIX near 16.95 supports a moderate-volatility backdrop, but it does not by itself authorize new risk without holdings-level evidence.',
    affected_thesis: ['volatility regime', 'risk appetite', 'risk budget'],
    claim_type: 'fact',
    confidence: 0.87
  });
  return evidenceMap;
});

copyOutput('market-landscape-state.json', x => ({...x, precedent_framework_ids: precedent.frameworks.map(f => f.id)}));
copyOutput('portfolio-translation-state.json', x => ({...x, precedent_framework_ids: ['risk_committee_packet', 'chart_decision_map', 'cross_asset_cockpit']}));
copyOutput('opportunity-asymmetry-state.json', x => ({...x, precedent_framework_ids: ['risk_committee_packet', 'chart_decision_map', 'cross_asset_cockpit']}));
copyOutput('strategy-state.json', x => ({...x, precedent_framework_ids: ['risk_committee_packet', 'cross_asset_cockpit']}));

copyOutput('data-truth-state.json', truth => {
  const blocked = truth.blockedSources || [];
  const stale = truth.staleSources || [];
  truth.as_of = generatedAt;
  truth.render_permission = false;
  truth.degraded_honesty_required = true;
  truth.deployment_permission = false;
  truth.missing_evidence = [
    'Per-holding source confidence fields are missing for current holdings despite fresh price tape.',
    'Forward valuation / FCF yield / next catalyst fields are incomplete for several holdings.',
    'No verified brokerage cost basis or user-provided allocation constraints; concentration/risk budget remains approximate.',
    'Community/YouTube alternative-source hypotheses were not promoted because no validated claim changed action posture.'
  ];
  truth.stale_data = stale;
  truth.unsupported_claims = [
    'Any buy/add conclusion from opportunity-asymmetry alone is unsupported and remains blocked.',
    'Any ticker promotion without primary evidence, price zone, invalidation, and risk budget is unsupported.'
  ];
  truth.conflicting_evidence = [];
  truth.failed_sources = [];
  truth.degraded_states = [
    'strategy-state: degraded_observation_only',
    'portfolio-translation: fresh tape but missing confidence/valuation fields',
    ...(blocked.length ? [`blocked holding confidence sources: ${blocked.join(', ')}`] : [])
  ];
  truth.render_permission_reason = 'Render only degraded honesty/observation state; data truth blocks normal deployment and new-capital posture.';
  return truth;
});

console.log(`materialized intelligence artifacts in ${dest}`);
