'use strict';

/*
 * validate-momentum-state.cjs
 *
 * Validates the Phase 1 momentum engine's committed artifacts:
 *   outputs/momentum/momentum-state.json
 *   outputs/momentum/momentum-top-decile.json
 *   outputs/momentum/momentum-gate.json
 *   outputs/momentum/momentum-rebalance.json
 *
 * Exit non-zero with a clear message on any failure.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'outputs', 'momentum');
const errors = [];
const warnings = [];

function readJson(name) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) { errors.push(`${name} missing`); return null; }
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (/\bNaN\b|\bInfinity\b|-Infinity/.test(raw)) errors.push(`${name} contains NaN/Infinity literal`);
    return JSON.parse(raw);
  } catch (e) { errors.push(`${name} invalid JSON: ${e.message}`); return null; }
}

function finiteNum(v) { return typeof v === 'number' && Number.isFinite(v); }

function noNonFinite(obj, label) {
  // walk the object; any non-finite number or null inside a numeric field is a failure
  const stack = [[obj, label]];
  while (stack.length) {
    const [node, p] = stack.pop();
    if (typeof node === 'number') {
      if (!Number.isFinite(node)) errors.push(`non-finite number at ${p}`);
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => stack.push([v, `${p}[${i}]`]));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) stack.push([v, `${p}.${k}`]);
    }
  }
}

const state = readJson('momentum-state.json');
const top = readJson('momentum-top-decile.json');
const gate = readJson('momentum-gate.json');
const reb = readJson('momentum-rebalance.json');

if (state) {
  for (const f of ['generatedAt', 'universe', 'universeCount', 'coverageCount', 'dataHealth', 'table', 'methodology']) {
    if (state[f] === undefined || state[f] === null) errors.push(`momentum-state.json missing field ${f}`);
  }
  if (state.generatedAt) {
    const ageH = (Date.now() - new Date(state.generatedAt).getTime()) / 3600000;
    if (!(ageH >= 0) || ageH > 36) errors.push(`momentum-state.json generatedAt not within 36h (age ${ageH.toFixed(1)}h)`);
  }
  if (Array.isArray(state.table)) {
    const n = state.table.length;
    const seen = new Set();
    const syms = new Set();
    for (const row of state.table) {
      if (!row.symbol || syms.has(row.symbol)) errors.push(`momentum-state duplicate/missing symbol ${row.symbol}`);
      syms.add(row.symbol);
      if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > n) errors.push(`momentum-state invalid rank ${row.rank} for ${row.symbol}`);
      else seen.add(row.rank);
      if (!finiteNum(row.composite) || row.composite < 0 || row.composite > 1) errors.push(`momentum-state invalid composite for ${row.symbol}`);
      if (!finiteNum(row.price) || row.price <= 0) errors.push(`momentum-state invalid price for ${row.symbol}`);
      if (!row.asOf) errors.push(`momentum-state missing asOf for ${row.symbol}`);
      for (const s of ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled']) {
        if (!finiteNum(row.signals?.[s])) errors.push(`momentum-state missing/non-finite signal ${s} for ${row.symbol}`);
      }
      for (const p of ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled']) {
        if (!finiteNum(row.percentiles?.[p]) || row.percentiles[p] <= 0 || row.percentiles[p] > 1) errors.push(`momentum-state invalid percentile ${p} for ${row.symbol}`);
      }
      if (typeof row.inTopDecile !== 'boolean') errors.push(`momentum-state inTopDecile not boolean for ${row.symbol}`);
    }
    if (seen.size !== n) errors.push(`momentum-state ranks are not a clean 1..${n} permutation (got ${seen.size} distinct)`);
    const cut = Math.ceil(n / 10);
    const flagged = state.table.filter(r => r.inTopDecile).length;
    if (flagged !== cut) errors.push(`momentum-state inTopDecile count ${flagged} != ceil(${n}/10)=${cut}`);
    state.table.filter(r => r.inTopDecile).forEach(r => {
      if (r.rank > cut) errors.push(`momentum-state ${r.symbol} flagged inTopDecile but rank ${r.rank} > ${cut}`);
    });
    if (state.includedCount !== undefined && state.includedCount !== n) errors.push(`momentum-state includedCount ${state.includedCount} != table length ${n}`);
  } else {
    errors.push('momentum-state.json table must be an array');
  }
  if (state.dataHealth === 'FULL' && state.universeCount > 0) {
    if (state.coverageCount / state.universeCount < 0.9) errors.push('momentum-state dataHealth FULL but coverage < 90%');
  }
  if (state.dataHealth === 'PARTIAL' && !(state.coverageCount > 0)) errors.push('momentum-state PARTIAL but no coverageCount');
  const meth = String(JSON.stringify(state.methodology || ''));
  if (!/survivorship/i.test(meth)) warnings.push('momentum-state methodology does not disclose survivorship bias');
  noNonFinite(state, 'momentum-state');
}

if (gate) {
  for (const f of ['generatedAt', 'gate', 'reason', 'thresholds', 'inputs', 'checks', 'activeCount']) {
    if (gate[f] === undefined || gate[f] === null) errors.push(`momentum-gate.json missing field ${f}`);
  }
  if (!['GREEN', 'YELLOW', 'RED'].includes(gate.gate)) errors.push(`momentum-gate.json invalid gate ${gate.gate}`);
  if (!gate.inputs?.spxVs200d || !gate.inputs?.hyOas || !gate.inputs?.vix) errors.push('momentum-gate.json inputs must include spxVs200d, hyOas, vix');
  if (!Array.isArray(gate.checks) || !gate.checks.length) errors.push('momentum-gate.json checks must be non-empty');
  if (!gate.reason || !String(gate.reason).trim()) errors.push('momentum-gate.json reason empty');
  noNonFinite(gate, 'momentum-gate');
}

if (top) {
  for (const f of ['generatedAt', 'gate', 'gateReason', 'activeCount', 'list']) {
    if (top[f] === undefined || top[f] === null) errors.push(`momentum-top-decile.json missing field ${f}`);
  }
  if (!Array.isArray(top.list)) errors.push('momentum-top-decile.json list must be an array');
  if (gate && top.gate !== gate.gate) errors.push(`momentum-top-decile gate ${top.gate} != momentum-gate ${gate.gate}`);
  if (top.list && top.activeCount !== top.list.length) errors.push(`momentum-top-decile activeCount ${top.activeCount} != list length ${top.list.length}`);

  if (state && Array.isArray(state.table)) {
    const n = state.table.length;
    const rankOf = new Map(state.table.map(r => [r.symbol, r.rank]));
    if (top.gate === 'RED') {
      if (top.list.length !== 0) errors.push('gate RED but top-decile list non-empty');
      if (!top.reasonEmpty) errors.push('gate RED but reasonEmpty missing');
    } else if (top.gate === 'GREEN') {
      const cut = Math.ceil(n / 10);
      if (top.list.length !== cut) errors.push(`gate GREEN but list length ${top.list.length} != top-decile cut ${cut}`);
    } else if (top.gate === 'YELLOW') {
      const cut = Math.ceil(n / 20);
      if (top.list.length !== cut) errors.push(`gate YELLOW but list length ${top.list.length} != top-5% cut ${cut}`);
    }
    if (top.gate !== 'RED') {
      const ranks = top.list.map(e => e.rank);
      const sorted = [...ranks].sort((a, b) => a - b);
      if (ranks.some((r, i) => r !== sorted[i])) errors.push('momentum-top-decile list not sorted by rank ascending');
      for (const e of top.list) {
        if (rankOf.get(e.symbol) !== e.rank) errors.push(`top-decile ${e.symbol} rank ${e.rank} not in state table`);
        if (!finiteNum(e.composite) || !finiteNum(e.price)) errors.push(`top-decile ${e.symbol} non-finite composite/price`);
      }
    }
  }
  noNonFinite(top, 'momentum-top-decile');
}

if (reb) {
  for (const f of ['lastRebalanceDate', 'nextRebalanceDate', 'tradingDaysRemaining', 'turnover', 'frequency', 'rule']) {
    if (reb[f] === undefined || reb[f] === null) errors.push(`momentum-rebalance.json missing field ${f}`);
  }
  if (reb.lastRebalanceDate && reb.nextRebalanceDate && reb.nextRebalanceDate <= reb.lastRebalanceDate) {
    errors.push('momentum-rebalance nextRebalanceDate must be after lastRebalanceDate');
  }
  if (reb.turnover && reb.turnover.entries && reb.turnover.entries.length + reb.turnover.exits.length > 0) {
    const t = reb.turnover;
    if (t.estimatedChurnCostBps !== (t.entries.length + t.exits.length) * 10) {
      errors.push('momentum-rebalance churn cost inconsistent with 10 bps per side');
    }
  }
  noNonFinite(reb, 'momentum-rebalance');
}

for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length) {
  console.error('validate-momentum-state FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('validate-momentum-state PASS');
