'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'outputs', 'mandate-state.json');

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return fallback; }
}
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function ageMinutes(timestamp) {
  const parsed = Date.parse(timestamp || '');
  return Number.isFinite(parsed) ? (Date.now() - parsed) / 60000 : null;
}
function dependency(id, label, timestamp, maxMinutes, options = {}) {
  const age = ageMinutes(timestamp);
  let status = 'OK';
  let reason = null;
  if (options.available === false || age == null) {
    status = 'MISSING';
    reason = options.missingReason || `${label} is unavailable.`;
  } else if (age < -15) {
    status = 'INVALID';
    reason = `${label} has a future timestamp.`;
  } else if (age > maxMinutes) {
    status = 'STALE';
    reason = `${label} is ${Math.round(age)} minutes old; maximum is ${maxMinutes}.`;
  } else if (options.valid === false) {
    status = 'INVALID';
    reason = options.invalidReason || `${label} failed its source validation.`;
  }
  return {
    id,
    label,
    required: options.required !== false,
    status,
    asOf: timestamp || null,
    ageMinutes: age == null ? null : Number(age.toFixed(1)),
    maxMinutes,
    source: options.source || null,
    reason
  };
}
function oldestTimestamp(values) {
  const valid = values.map(value => Date.parse(value || '')).filter(Number.isFinite);
  return valid.length ? new Date(Math.min(...valid)).toISOString() : null;
}
function summarizeDependencies(dependencies) {
  const blockers = dependencies.filter(item => item.required && item.status !== 'OK');
  return {
    ready: blockers.length === 0,
    blockers: blockers.map(item => ({ id: item.id, status: item.status, reason: item.reason }))
  };
}

const config = readJson('config/mandates.json', { mandates: [] });
const portfolio = readJson('outputs/portfolio-live-state.json', null);
const account = readJson('outputs/agentic-account-state.json', null);
const dataHealth = readJson('outputs/data-health.json', null);
const calendar = readJson('data/market-events.json', null);
const playbook = readJson('data/active-playbook.json', null);
const observations = readJson('data/playbook-observations.json', { observations: [] });

const calendarTimestamp = calendar?.generatedAt || calendar?.updatedAt || calendar?.asOf || null;
const observationById = new Map((observations.observations || []).map(row => [row.conditionId, row]));

const mandates = (config.mandates || []).map(mandate => {
  if (mandate.id === 'core') {
    const quoteTimestamp = oldestTimestamp((portfolio?.positions || []).map(position => position.priceAsOf || portfolio?.fetchedAt));
    const dependencies = [
      dependency('positions', 'Positions', portfolio?.fetchedAt, mandate.freshness.positionsMaxMinutes, {
        available: Boolean(portfolio), source: 'portfolio-live-state'
      }),
      dependency('quotes', 'Holding prices', quoteTimestamp, mandate.freshness.quotesMaxMinutes, {
        available: Boolean(portfolio?.positions?.length && quoteTimestamp), source: 'portfolio-live-state.positions'
      }),
      dependency('data_health', 'Data health', dataHealth?.generatedAt, mandate.freshness.dataHealthMaxMinutes, {
        available: Boolean(dataHealth), valid: dataHealth?.status === 'OK', source: 'data-health',
        invalidReason: `Data health reports ${dataHealth?.status || 'UNKNOWN'}.`
      }),
      dependency('calendar', 'Market calendar', calendarTimestamp, mandate.freshness.calendarMaxMinutes, {
        available: Boolean(calendarTimestamp), source: 'market-events'
      })
    ];
    const summary = summarizeDependencies(dependencies);
    return {
      id: mandate.id,
      label: mandate.label,
      description: mandate.description,
      state: summary.ready ? 'READY_REVIEW' : 'PAUSED_STALE',
      actionAllowed: false,
      permission: summary.ready ? 'HUMAN_REVIEW_REQUIRED' : 'NO_ACTION',
      reason: summary.ready ? 'Evidence is current enough for human review; Capital Radar does not authorize execution.' : `${summary.blockers.length} required dependency blocker(s).`,
      dependencies,
      blockers: summary.blockers,
      portfolio: portfolio ? {
        totalValue: number(portfolio.portfolio?.totalValue),
        buyingPower: number(portfolio.portfolio?.buyingPower),
        positionCount: number(portfolio.portfolio?.positionCount),
        dayChange: number(portfolio.summary?.totalDayChange)
      } : null
    };
  }

  const gateTimestamp = observations.observedAt || oldestTimestamp((observations.observations || []).map(row => row.observedAt));
  const dependencies = [
    dependency('account', 'Agentic account snapshot', account?.generatedAt || account?.fetchedAt, mandate.freshness.accountMaxMinutes, {
      available: Boolean(account), source: 'agentic-account-state', missingReason: 'No fresh Agentic account snapshot is available.'
    }),
    dependency('positions', 'Agentic positions', account?.positionsAsOf || account?.generatedAt || account?.fetchedAt, mandate.freshness.accountMaxMinutes, {
      available: Array.isArray(account?.positions), source: 'agentic-account-state.positions', missingReason: 'Agentic positions are unavailable.'
    }),
    dependency('orders', 'Open orders and protection', account?.ordersAsOf || account?.generatedAt || account?.fetchedAt, mandate.freshness.ordersMaxMinutes, {
      available: Array.isArray(account?.orders), source: 'agentic-account-state.orders', missingReason: 'Agentic open orders and protective-stop status are unavailable.'
    }),
    dependency('buying_power', 'Buying power', account?.buyingPowerAsOf || account?.generatedAt || account?.fetchedAt, mandate.freshness.accountMaxMinutes, {
      available: number(account?.buyingPower) != null, source: 'agentic-account-state.buyingPower', missingReason: 'Agentic buying power is unavailable.'
    }),
    dependency('gate_observations', 'Playbook observations', gateTimestamp, mandate.freshness.gateObservationsMaxMinutes, {
      available: Boolean(gateTimestamp), source: 'playbook-observations', missingReason: 'No timestamped gate observation set is available.'
    }),
    dependency('calendar', 'Market calendar', calendarTimestamp, mandate.freshness.calendarMaxMinutes, {
      available: Boolean(calendarTimestamp), source: 'market-events'
    })
  ];

  const conditions = (playbook?.conditions || []).map(condition => {
    const observation = observationById.get(condition.id) || {};
    const observationFresh = dependency(
      condition.id,
      condition.label,
      observation.observedAt,
      mandate.freshness.gateObservationsMaxMinutes,
      { available: Boolean(observation.observedAt), source: observation.source || condition.source, required: condition.required }
    );
    const rawStatus = String(observation.status || 'UNKNOWN').toUpperCase();
    const status = observationFresh.status === 'OK' && ['PASS', 'FAIL'].includes(rawStatus) ? rawStatus : 'UNKNOWN';
    return {
      id: condition.id,
      label: condition.label,
      rule: condition.rule,
      required: condition.required !== false,
      source: observation.source || condition.source,
      observedAt: observation.observedAt || null,
      status
    };
  });

  const dependencySummary = summarizeDependencies(dependencies);
  const expiresAt = Date.parse(playbook?.expiresAt || '');
  const blackoutAt = Date.parse(playbook?.eventBlackout?.startsAt || '');
  const expired = Number.isFinite(expiresAt) && Date.now() > expiresAt;
  const blackout = Number.isFinite(blackoutAt) && Date.now() >= blackoutAt;
  const allConditionsPass = conditions.length > 0 && conditions.filter(row => row.required).every(row => row.status === 'PASS');
  const occupied = Array.isArray(account?.positions) && account.positions.length > 0;
  let state = 'WAIT';
  let reason = 'Required playbook conditions are not all confirmed.';
  if (expired || blackout) {
    state = 'BLACKOUT';
    reason = expired ? 'The active playbook expired.' : `Event blackout is active for ${playbook?.eventBlackout?.label || 'scheduled catalyst'}.`;
  } else if (!dependencySummary.ready) {
    state = 'PAUSED_STALE';
    reason = `${dependencySummary.blockers.length} required dependency blocker(s).`;
  } else if (occupied) {
    state = 'IN_POSITION';
    reason = 'An Agentic position is already open; manage risk instead of opening another slot.';
  } else if (allConditionsPass) {
    state = 'ARMED';
    reason = 'All monitored conditions pass. Exact order still requires separate human authorization.';
  }

  return {
    id: mandate.id,
    label: mandate.label,
    description: mandate.description,
    state,
    actionAllowed: false,
    permission: state === 'ARMED' ? 'AWAIT_EXACT_ORDER_AUTHORIZATION' : 'NO_ACTION',
    reason,
    dependencies,
    blockers: dependencySummary.blockers,
    riskPolicy: mandate.riskPolicy,
    account: account ? {
      buyingPower: number(account.buyingPower),
      positionCount: Array.isArray(account.positions) ? account.positions.length : null,
      openOrderCount: Array.isArray(account.orders) ? account.orders.length : null
    } : null,
    playbook: playbook ? {
      name: playbook.name,
      symbol: playbook.symbol,
      status: playbook.status,
      expiresAt: playbook.expiresAt,
      eventBlackout: playbook.eventBlackout,
      ticket: playbook.ticket,
      conditions
    } : null
  };
});

const state = {
  generatedAt: new Date().toISOString(),
  policy: config.policy,
  defaultMandate: config.defaultMandate || mandates[0]?.id || null,
  mandates,
  summary: {
    readyForReview: mandates.filter(row => row.state === 'READY_REVIEW').length,
    armed: mandates.filter(row => row.state === 'ARMED').length,
    paused: mandates.filter(row => row.state === 'PAUSED_STALE').length,
    executionAuthorized: 0
  }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`generated mandate state: ${mandates.map(row => `${row.id}=${row.state}`).join(', ')}`);
