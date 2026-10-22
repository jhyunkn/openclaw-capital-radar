const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const read = (name, fb = {}) => {
  for (const dir of ['outputs', 'public/outputs']) {
    const f = path.join(root, dir, name);
    if (fs.existsSync(f)) {
      try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* fall through to fallback */ }
    }
  }
  return fb;
};

const write = (name, data) => {
  for (const dir of ['outputs', 'public/outputs']) {
    const f = path.join(root, dir, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  }
};

const arr = v => (Array.isArray(v) ? v : []);

const holdings = read('holding-zone-state.json', { zones: [] });
const opp = read('opportunity-asymmetry-state.json', { opportunity_clusters: [] });

function authority(z) {
  const a = String(z.source_authority || z.zone_source_tier || z.source_quality || z.zone_method || '').toUpperCase();
  if (/AUTH|AUTHORITATIVE/.test(a)) return 'AUTH';
  if (/PARTIAL|INSTITUTIONAL/.test(a)) return 'PARTIAL';
  if (/PROXY/.test(a)) return 'PROXY';
  return 'MISSING';
}

function risk(auth, field) {
  if (auth === 'AUTH') return 'Low action-risk from source authority; still validate recency.';
  if (auth === 'PARTIAL') return 'Moderate action-risk: evidence exists but price level is incomplete.';
  if (auth === 'PROXY') return `High action-risk: ${field} is model-derived and should not drive adds alone.`;
  return `Unusable action-risk: ${field} has no reliable source.`;
}

function nextEvidence(auth, kind) {
  if (kind === 'holdings') {
    if (auth === 'AUTH') return 'refresh source and price recency';
    if (auth === 'PARTIAL') return 'confirm explicit technical/action level from primary or market-structure source';
    if (auth === 'PROXY') return 'replace proxy with institutional/technical/company-verified evidence';
    return 'do not render as actionable until sourced';
  }
  if (auth === 'AUTH') return 'refresh evidence trail';
  if (auth === 'PARTIAL') return 'complete missing evidence packet and comparables';
  if (auth === 'PROXY') return 'collect source-backed valuation, institutional, and catalyst evidence';
  return 'hold as research-only';
}

const rows = [];

const HOLDING_FIELDS = z => ({
  current_price: z.current_price,
  buy_zone_low: z.buy_zone_low,
  buy_zone_high: z.buy_zone_high,
  trim_zone_low: z.trim_zone_low,
  trim_zone_high: z.trim_zone_high,
  target_resistance: z.target_resistance,
  stop_review: z.stop_review,
  hard_exit_review: z.hard_exit_review
});

for (const z of arr(holdings.zones)) {
  const ticker = z.ticker;
  const auth = authority(z);
  for (const [field, value] of Object.entries(HOLDING_FIELDS(z))) {
    rows.push({
      ticker,
      section: 'holdings',
      field_name: field,
      value,
      source_authority: auth,
      source_artifact: 'holding-zone-state.json',
      source_url_or_file: null,
      evidence_note: z.zone_source_label || z.source_authority_label || z.zone_method || z.source_quality || 'source tier pending',
      action_risk_if_wrong: risk(auth, field),
      required_next_evidence: nextEvidence(auth, 'holdings')
    });
  }
}

for (const cluster of arr(opp.opportunity_clusters)) {
  for (const c of arr(cluster.candidate_tickers)) {
    const raw = String(c.source_authority || c.source_quality || c.band_method || 'proxy').toUpperCase();
    const quality = String(c.source_quality || c.band_method || '').toUpperCase();
    const auth = raw.includes('AUTH') ? 'AUTH'
      : quality.includes('INSTITUTIONAL') ? 'PARTIAL'
      : quality.includes('PROXY') ? 'PROXY'
      : 'MISSING';
    const fields = {
      evidence_completeness_pct: c.evidence_completeness_pct,
      asymmetry_score: c.asymmetry_score,
      downside_control_score: c.downside_control_score,
      undervaluation_score: c.undervaluation_score,
      route_promotion_status: c.route_promotion_status
    };
    for (const [field, value] of Object.entries(fields)) {
      rows.push({
        ticker: c.ticker,
        section: 'opportunity',
        field_name: field,
        value,
        source_authority: auth,
        source_artifact: 'opportunity-asymmetry-state.json',
        source_url_or_file: null,
        evidence_note: c.primary_blocker || c.next_gate || cluster.macro_theme || 'opportunity evidence pending',
        action_risk_if_wrong: risk(auth, field),
        required_next_evidence: nextEvidence(auth, 'opportunity')
      });
    }
  }
}

const counts = rows.reduce((a, r) => { a[r.source_authority] = (a[r.source_authority] || 0) + 1; return a; }, {});
const unsafe = rows.filter(r => r.source_authority === 'PROXY' || r.source_authority === 'MISSING').length;
const state = {
  as_of: new Date().toISOString(),
  artifact: 'zone-authority-audit',
  status: unsafe ? 'WARNING' : 'PASS',
  summary: { rows: rows.length, counts, unsafe_fields: unsafe },
  rows,
  render_permission: true
};
write('zone-authority-audit.json', state);
console.log(`zone-authority-audit: ${state.status} rows=${rows.length} unsafe=${unsafe}`);
