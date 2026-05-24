const path = require('path');

const root = path.join(__dirname, '..');

function fromRoot(relativePath) {
  return path.join(root, relativePath);
}

function readJson(fs, relativePath, fallback = null) {
  const filePath = fromRoot(relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function state(relativePath, options = {}) {
  return {
    key: options.key || path.basename(relativePath, '.json'),
    path: relativePath,
    required: options.required !== false,
    fallback: options.fallback ?? null,
  };
}

function renderer(relativePath, sectionExport, styleExport = null) {
  return {
    path: relativePath,
    sectionExport,
    styleExport,
  };
}

const registry = [
  {
    id: 'system-health-section',
    manifestId: 'system-health-section',
    navLabel: 'Health',
    previewOrder: 5,
    states: [state('outputs/capital-radar-health-report.json', { key: 'state', required: false, fallback: {
      status: 'DEGRADED',
      verdict: 'Health report has not been generated yet.',
      registryPreview: { status: 'PENDING_FIRST_RENDER' },
      production: {},
      checks: { legacyCleanupActive: true },
      counts: {}
    } })],
    renderer: renderer('components/radar/system-health/render.cjs', 'renderSystemHealthSection', 'renderSystemHealthStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'kostolany-egg-section',
    manifestId: 'kostolany-egg-section',
    navLabel: 'Egg',
    previewOrder: 10,
    cssLinks: [
      'assets/kostolany-egg-v3.css',
      'assets/kostolany-egg-v4.css',
      'assets/page-tight-overflow.css',
      'assets/egg-board-final.css',
      'assets/egg-svg-refine.css',
    ],
    states: [state('outputs/kostolany-egg-state.json', { key: 'state', fallback: 'data/mock/kostolany-egg-state.mock.json' })],
    renderer: renderer('components/radar/kostolany-egg/render-modular.cjs', 'renderKostolanyEggSection'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'decision-brief-section',
    manifestId: 'decision-brief-section',
    navLabel: 'Brief',
    previewOrder: 20,
    states: [state('outputs/market-decision-brief-state.json', { key: 'state' })],
    renderer: renderer('components/radar/decision-brief/render.cjs', 'renderDecisionBriefSection', 'renderDecisionBriefStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'operational-chart-section',
    manifestId: 'operational-chart-section',
    navLabel: 'Decision Chart',
    previewOrder: 30,
    states: [
      state('outputs/operational-chart-state.json', { key: 'state' }),
      state('outputs/decision-chart-annotation-state.json', { key: 'annotationState', required: false }),
    ],
    renderer: renderer('components/radar/operational-chart/render.cjs', 'renderOperationalChartSection', 'renderOperationalChartStyle'),
    buildArgs({ states }) {
      const annotationState = states.annotationState && states.annotationState.render_permission !== false ? states.annotationState : null;
      return [states.state, annotationState];
    },
  },
  {
    id: 'market-lens-section',
    manifestId: 'market-lens-section',
    navLabel: 'Lens',
    previewOrder: 40,
    states: [state('outputs/market-lens-state.json', { key: 'state' })],
    renderer: renderer('components/radar/market-lens/render.cjs', 'renderMarketLensSection', 'renderMarketLensStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'strategy-routing-section',
    manifestId: 'strategy-routing-section',
    navLabel: 'Route',
    previewOrder: 50,
    states: [state('outputs/strategy-routing-state.json', { key: 'state' })],
    renderer: renderer('components/radar/strategy-routing/render.cjs', 'renderStrategyRoutingSection', 'renderStrategyRoutingStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'holdings-section',
    manifestId: 'holdings-section',
    navLabel: 'Holdings',
    previewOrder: 60,
    states: [
      state('outputs/holding-zone-state.json', { key: 'zoneState' }),
      state('outputs/portfolio-translation-state.json', { key: 'translation', required: false, fallback: { holdings: [] } }),
      state('outputs/portfolio-decision-state.json', { key: 'decision', required: false, fallback: [] }),
    ],
    renderer: renderer('components/radar/holdings/render.cjs', 'renderHoldingsSection', 'renderHoldingsStyle'),
    buildArgs({ states }) {
      return [{ zoneState: states.zoneState, translation: states.translation || { holdings: [] }, decision: states.decision || [] }];
    },
  },
  {
    id: 'opportunities-section',
    manifestId: 'opportunities-section',
    navLabel: 'Opportunity',
    previewOrder: 70,
    states: [state('outputs/opportunity-asymmetry-state.json', { key: 'state' })],
    renderer: renderer('components/radar/opportunities/render.cjs', 'renderOpportunitiesSection', 'renderOpportunitiesStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
  {
    id: 'market-section',
    manifestId: 'market-section',
    navLabel: 'Market Tape',
    previewOrder: 80,
    states: [state('outputs/market-tape-state.json', { key: 'state' })],
    renderer: renderer('components/radar/market-tape/render.cjs', 'renderMarketTapeSection', 'renderMarketTapeStyle'),
    buildArgs({ states }) {
      return [states.state];
    },
  },
];

function getHomepageSectionRegistry() {
  return registry.map(entry => ({ ...entry }));
}

module.exports = {
  root,
  getHomepageSectionRegistry,
  readJson,
};
