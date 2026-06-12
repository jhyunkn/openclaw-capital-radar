const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const outPath = path.join(outputs, 'robinhood-execution-bridge-state.json');

function readJson(rel, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch {
    return fallback;
  }
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

function tickerWeightMap(exposure) {
  const map = new Map();
  for (const bucket of arr(exposure?.buckets)) {
    for (const member of arr(bucket.members)) {
      if (!member?.ticker) continue;
      map.set(member.ticker, {
        weightPct: round(member.weight),
        bucket: bucket.label,
        bucketPressure: bucket.pressure,
        bucketCapPct: bucket.capPct,
      });
    }
  }
  return map;
}

function ticketStatus(zone, action) {
  if (zone?.loss_minimization_required) return 'loss-control review';
  if (zone?.capital_allowed || /ADD REVIEW ALLOWED|TRIM REVIEW|EXIT REVIEW/i.test(action?.authority?.decision || '')) return 'proposal allowed';
  return 'blocked';
}

function recommendationFor(zone, action, exposure) {
  const decision = action?.authority?.decision || zone?.execution_permission || 'VERIFY FIRST';
  if (/TRIM/i.test(decision)) return 'Generate trim-review ticket only after live broker exposure is reconciled.';
  if (/EXIT/i.test(decision) || zone?.loss_minimization_required) return 'Generate loss-control ticket; minimize damage with human approval.';
  if (zone?.capital_allowed) return 'Prepare limit-buy review ticket; exact order still requires Jun approval.';
  if (exposure?.bucketPressure === 'over-cap') return 'Do not add; exposure bucket is already above review cap.';
  return 'Do not send order; Capital Radar requires verification before exposure changes.';
}

function makeTickets(zones, actions, exposureMap) {
  const actionByTicker = new Map(arr(actions?.actionStates).map(item => [item.ticker, item]));
  return arr(zones?.zones)
    .map(zone => {
      const action = actionByTicker.get(zone.ticker) || {};
      const exposure = exposureMap.get(zone.ticker) || {};
      const status = ticketStatus(zone, action);
      const blocker = status === 'blocked'
        ? zone.permission_blocker || action?.authority?.reason || 'Capital Radar has not granted execution permission.'
        : null;
      return {
        ticker: zone.ticker,
        status,
        recommendation: recommendationFor(zone, action, exposure),
        current_price: round(zone.current_price),
        entry_zone: {
          low: round(zone.buy_zone_low),
          high: round(zone.buy_zone_high),
          mid: round(zone.buy_zone_mid),
        },
        trim_zone: {
          low: round(zone.trim_zone_low),
          high: round(zone.trim_zone_high),
          mid: round(zone.trim_zone_mid),
        },
        stop_review: round(zone.stop_review),
        hard_exit_review: round(zone.hard_exit_review),
        distance_to_entry_mid_pct: round(zone.distance_to_buy_mid_pct),
        execution_permission: zone.execution_permission || action?.authority?.decision || 'VERIFY FIRST',
        max_position_size_pct: exposure.bucketPressure === 'over-cap' ? 0 : 4,
        current_weight_pct: exposure.weightPct ?? null,
        exposure_bucket: exposure.bucket || null,
        blocker,
        next_step: status === 'proposal allowed'
          ? 'Draft exact limit order ticket and request Jun approval.'
          : 'Wait for broker sync, macro permission, and exact approval gate.',
      };
    })
    .sort((a, b) => {
      const rank = status => status === 'proposal allowed' ? 0 : status === 'loss-control review' ? 1 : 2;
      return rank(a.status) - rank(b.status) || Math.abs(a.distance_to_entry_mid_pct ?? 999) - Math.abs(b.distance_to_entry_mid_pct ?? 999);
    });
}

const zones = readJson('outputs/holding-zone-state.json', {});
const actions = readJson('outputs/authoritative-action-state.json', {});
const exposure = readJson('outputs/portfolio-exposure-map.json', {});
const brief = readJson('outputs/market-decision-brief-state.json', {});
const exposureMap = tickerWeightMap(exposure);
const tickets = makeTickets(zones, actions, exposureMap);
const blockedCount = tickets.filter(t => t.status === 'blocked').length;
const allowedCount = tickets.filter(t => t.status === 'proposal allowed').length;

const state = {
  generatedAt: new Date().toISOString(),
  artifact: 'robinhood-execution-bridge-state',
  mode: 'proposal_only',
  sync: {
    provider: 'Robinhood Agentic Trading MCP',
    mcp_url: 'https://agent.robinhood.com/mcp/trading',
    connected: false,
    status: 'not_connected',
    detail: 'No Robinhood MCP session is authenticated in this build; use proposal mode until broker account data is explicitly synced.',
    allowed_reads_when_connected: ['agentic account cash', 'buying power', 'positions', 'balances', 'order history'],
    allowed_writes_when_connected: ['approved long-equity limit orders only'],
  },
  capital_radar: {
    status: 'active',
    detail: 'Tickets are generated from live Capital Radar macro, holding zone, action permission, and exposure outputs.',
    macro_permission: brief.portfolio_action || null,
    risk_rule: brief.risk_rule || null,
    source_artifacts: [
      'outputs/market-decision-brief-state.json',
      'outputs/authoritative-action-state.json',
      'outputs/holding-zone-state.json',
      'outputs/portfolio-exposure-map.json',
    ],
  },
  policy: {
    execution_mode: 'proposal_only',
    execution_mode_label: 'Proposal only',
    execution_policy: 'No order placement without an exact trade ticket approved by Jun. The bridge may read broker data after connection, but Capital Radar remains the decision system.',
    forbidden: ['autonomous trading', 'options by default', 'margin', 'market orders by default', 'averaging down without approval', 'orders during FOMC/CPI/earnings without special gate'],
  },
  readiness: {
    status: allowedCount ? 'proposal review available' : 'blocked',
    summary: `${allowedCount} proposal-ready ticket(s), ${blockedCount} blocked ticket(s). Broker sync is not connected, so execution remains disabled.`,
  },
  gates: [
    { label: 'Capital Radar live state', status: 'ready', detail: 'Macro, holdings, zones, and exposure artifacts are present.' },
    { label: 'Robinhood MCP sync', status: 'not connected', detail: 'Connect and authenticate the Agentic account before account-level reconciliation.' },
    { label: 'Human approval', status: 'required', detail: 'Every order needs exact approval from Jun before placement.' },
    { label: 'Post-trade journal', status: 'required', detail: 'Approved, rejected, and filled tickets must be logged with source snapshot.' },
  ],
  hard_rules: [
    { label: 'No autonomous orders', status: 'blocked', detail: 'The system can propose tickets, not trade freely.' },
    { label: 'No options by default', status: 'blocked', detail: 'Options require a separate explicit approval policy.' },
    { label: 'No market orders by default', status: 'blocked', detail: 'Limit order ticket must specify ticker, side, price, size, expiry, and invalidation.' },
    { label: 'No margin', status: 'blocked', detail: 'Agentic account should only use prefunded cash budget.' },
    { label: 'Macro/event gate', status: 'required', detail: 'FOMC, CPI, earnings, and large gap moves require a separate confirmation check.' },
  ],
  tickets,
};

fs.mkdirSync(outputs, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`wrote ${path.relative(root, outPath)}: ${allowedCount} proposal-ready, ${blockedCount} blocked`);
