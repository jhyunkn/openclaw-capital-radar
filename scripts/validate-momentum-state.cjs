'use strict';

/*
 * validate-momentum-state.cjs
 *
 * Validates the Phase 1 momentum engine's committed artifacts:
 *   outputs/momentum/momentum-state.json
 *   outputs/momentum/momentum-top-decile.json
 *   outputs/momentum/momentum-gate.json
 *   outputs/momentum/momentum-rebalance.json
 *   outputs/momentum/momentum-rebalance-snapshot.json
 *
 * Enforces the display-only contracts: every table row carries an
 * entryQuality read (GOOD/FAIR/POOR + reasons, earningsTiming always
 * 'unknown' — never guessed), and the rebalance artifact carries
 * rebalance-anchored NEW IN / NEW OUT / rank changes.
 */

const fs = require('fs');
const path = require('path');
const gateV2 = require('./momentum-gate-v2.cjs'); // verify hysteresis with the shared implementation

const root = path.join(__dirname, '..');
const dir = path.join(root, 'outputs', 'momentum');
const errors = [];
const warnings = [];

const EXPOSURE_BY_TIER = [1.0, 0.6, 0.25];
const TIER_LABELS = ['FULL', 'REDUCED', 'DEFENSIVE'];

function tierOk(tier, label, exposure) {
  return Number.isInteger(tier) && tier >= 0 && tier <= 2 &&
    TIER_LABELS[tier] === label && exposure === EXPOSURE_BY_TIER[tier];
}

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
      // Display-only entry-quality contract: rating + reasons + unknown-not-guessed earnings.
      const eq = row.entryQuality;
      if (!eq || !['GOOD', 'FAIR', 'POOR'].includes(eq.rating)) errors.push(`momentum-state entryQuality.rating invalid for ${row.symbol}`);
      if (!eq || !Array.isArray(eq.reasons) || !eq.reasons.length || !eq.reasons.every(r => typeof r === 'string' && r.length)) errors.push(`momentum-state entryQuality.reasons invalid for ${row.symbol}`);
      if (!eq || eq.earningsTiming !== 'unknown') errors.push(`momentum-state entryQuality.earningsTiming must be 'unknown' for ${row.symbol} (never guessed)`);
      for (const k of ['ret20d', 'distSMA20', 'distSMA50', 'off20dHigh']) {
        if (!finiteNum(eq?.inputs?.[k])) errors.push(`momentum-state entryQuality.inputs.${k} non-finite for ${row.symbol}`);
      }
      if (typeof eq?.inputs?.above50 !== 'boolean') errors.push(`momentum-state entryQuality.inputs.above50 not boolean for ${row.symbol}`);
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
  if (!/display-only/i.test(meth)) warnings.push('momentum-state methodology does not state entryQuality is display-only');
  noNonFinite(state, 'momentum-state');
}

if (gate) {
  for (const f of ['generatedAt', 'gateVersion', 'score', 'legs', 'legsAvailable', 'targetTier', 'targetTierLabel', 'targetExposure', 'tier', 'tierLabel', 'exposure', 'reason', 'thresholds', 'inputs', 'checks', 'scoreHistory', 'activeCount']) {
    if (gate[f] === undefined || gate[f] === null) errors.push(`momentum-gate.json missing field ${f}`);
  }
  if (gate.gateVersion !== 'v2') errors.push(`momentum-gate.json gateVersion ${gate.gateVersion} != 'v2'`);
  // score <-> legs consistency
  if (gate.legs) {
    const legKeys = ['spxBelow200d', 'hyOasStress', 'vixStress'];
    for (const k of legKeys) {
      if (!(gate.legs[k] === true || gate.legs[k] === false || gate.legs[k] === null)) {
        errors.push(`momentum-gate.json legs.${k} must be boolean|null`);
      }
    }
    const availCount = legKeys.filter(k => gate.legs[k] !== null).length;
    if (gate.legsAvailable !== availCount) errors.push(`momentum-gate.json legsAvailable ${gate.legsAvailable} != non-null leg count ${availCount}`);
    const trueCount = legKeys.filter(k => gate.legs[k] === true).length;
    if (gate.score !== trueCount) errors.push(`momentum-gate.json score ${gate.score} != true-leg count ${trueCount}`);
  }
  if (!Number.isInteger(gate.score) || gate.score < 0 || gate.score > 3) errors.push(`momentum-gate.json invalid score ${gate.score}`);
  if (Number.isInteger(gate.score) && Number.isInteger(gate.legsAvailable) && gate.score > gate.legsAvailable) {
    errors.push(`momentum-gate.json score ${gate.score} > legsAvailable ${gate.legsAvailable}`);
  }
  // target tier from score (no hysteresis)
  if (Number.isInteger(gate.score)) {
    const t = gateV2.tierFromScore(gate.score);
    if (gate.targetTier !== t.tier || gate.targetTierLabel !== t.tierLabel || gate.targetExposure !== t.exposure) {
      errors.push(`momentum-gate.json target tier/exposure inconsistent with score ${gate.score} (expected tier ${t.tier}/${t.tierLabel}/${t.exposure})`);
    }
  }
  if (!tierOk(gate.tier, gate.tierLabel, gate.exposure)) {
    errors.push(`momentum-gate.json tier/tierLabel/exposure inconsistent (tier=${gate.tier}, label=${gate.tierLabel}, exposure=${gate.exposure})`);
  }
  // score history sanity + hysteresis verification via the shared module
  if (Array.isArray(gate.scoreHistory)) {
    if (!gate.scoreHistory.length) errors.push('momentum-gate.json scoreHistory empty');
    let prevDate = '';
    for (const h of gate.scoreHistory) {
      if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date || '')) { errors.push('momentum-gate.json scoreHistory entry missing/invalid date'); break; }
      if (h.date <= prevDate) { errors.push('momentum-gate.json scoreHistory dates not strictly ascending'); break; }
      prevDate = h.date;
      if (!Number.isInteger(h.score) || h.score < 0 || h.score > 3) { errors.push(`momentum-gate.json scoreHistory invalid score at ${h.date}`); break; }
    }
    const lastH = gate.scoreHistory[gate.scoreHistory.length - 1];
    if (lastH && lastH.score !== gate.score) errors.push(`momentum-gate.json scoreHistory last score ${lastH.score} != current score ${gate.score}`);
    if (gate.generatedAt && lastH) {
      const ageD = Math.abs(new Date(gate.generatedAt).getTime() - new Date(lastH.date + 'T12:00:00Z').getTime()) / 86400000;
      if (!(ageD <= 2)) errors.push(`momentum-gate.json scoreHistory last entry ${lastH.date} not within 2d of generatedAt`);
    }
    // independent hysteresis replay: final effective tier/exposure must match
    const replay = gateV2.applyHysteresis(gate.scoreHistory.map(h => ({ date: h.date, score: h.score })), { fast: false });
    const fin = replay[replay.length - 1];
    if (fin && (fin.tier !== gate.tier || fin.exposure !== gate.exposure)) {
      errors.push(`momentum-gate.json hysteresis replay gives tier ${fin.tier}/${fin.exposure} != recorded ${gate.tier}/${gate.exposure}`);
    }
  } else {
    errors.push('momentum-gate.json scoreHistory must be an array');
  }
  if (!gate.inputs?.spxVs200d || !gate.inputs?.hyOas || !gate.inputs?.vix) errors.push('momentum-gate.json inputs must include spxVs200d, hyOas, vix');
  if (!Array.isArray(gate.checks) || !gate.checks.length) errors.push('momentum-gate.json checks must be non-empty');
  const checkNames = (gate.checks || []).map(c => c.name);
  for (const n of ['spx_below_200d', 'hy_oas_ge_4', 'vix_ge_30']) {
    if (!checkNames.includes(n)) errors.push(`momentum-gate.json checks missing ${n}`);
  }
  if (!gate.reason || !String(gate.reason).trim()) errors.push('momentum-gate.json reason empty');
  const rule = String(gate.thresholds?.rule || '');
  if (!/never 0|floor/i.test(rule)) warnings.push('momentum-gate.json thresholds.rule does not state the never-0% floor');
  noNonFinite(gate, 'momentum-gate');
}

if (top) {
  for (const f of ['generatedAt', 'gateVersion', 'tier', 'tierLabel', 'score', 'exposure', 'reason', 'activeCount', 'list']) {
    if (top[f] === undefined || top[f] === null) errors.push(`momentum-top-decile.json missing field ${f}`);
  }
  if (!Array.isArray(top.list)) errors.push('momentum-top-decile.json list must be an array');
  if (top.gateVersion !== 'v2') errors.push(`momentum-top-decile.json gateVersion ${top.gateVersion} != 'v2'`);
  // cross-file consistency with the gate
  if (gate) {
    if (top.tier !== gate.tier) errors.push(`momentum-top-decile tier ${top.tier} != momentum-gate ${gate.tier}`);
    if (top.tierLabel !== gate.tierLabel) errors.push(`momentum-top-decile tierLabel ${top.tierLabel} != momentum-gate ${gate.tierLabel}`);
    if (top.score !== gate.score) errors.push(`momentum-top-decile score ${top.score} != momentum-gate ${gate.score}`);
    if (top.exposure !== gate.exposure) errors.push(`momentum-top-decile exposure ${top.exposure} != momentum-gate ${gate.exposure}`);
    if (top.activeCount !== gate.activeCount) errors.push(`momentum-top-decile activeCount ${top.activeCount} != momentum-gate ${gate.activeCount}`);
  }
  if (!tierOk(top.tier, top.tierLabel, top.exposure)) {
    errors.push(`momentum-top-decile.json tier/tierLabel/exposure inconsistent (tier=${top.tier}, label=${top.tierLabel}, exposure=${top.exposure})`);
  }
  if (top.list && top.activeCount !== top.list.length) errors.push(`momentum-top-decile activeCount ${top.activeCount} != list length ${top.list.length}`);

  if (state && Array.isArray(state.table)) {
    const n = state.table.length;
    const rankOf = new Map(state.table.map(r => [r.symbol, r.rank]));
    // v2: the target list is ALWAYS the full top decile (scaled by exposure, never emptied).
    const cut = Math.ceil(n / 10);
    if (top.list.length !== cut) errors.push(`v2 gate but list length ${top.list.length} != top-decile cut ${cut}`);
    const ranks = top.list.map(e => e.rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    if (ranks.some((r, i) => r !== sorted[i])) errors.push('momentum-top-decile list not sorted by rank ascending');
    for (const e of top.list) {
      if (rankOf.get(e.symbol) !== e.rank) errors.push(`top-decile ${e.symbol} rank ${e.rank} not in state table`);
      if (!finiteNum(e.composite) || !finiteNum(e.price)) errors.push(`top-decile ${e.symbol} non-finite composite/price`);
    }
  }
  noNonFinite(top, 'momentum-top-decile');
}

if (reb) {
  for (const f of ['generatedAt', 'lastRebalanceDate', 'nextRebalanceDate', 'tradingDaysRemaining', 'turnover', 'frequency', 'rule']) {
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
  // Rebalance-anchored change contract: NEW IN / NEW OUT / rank changes vs
  // the previous monthly rebalance (not vs the last twice-daily run).
  const ch = reb.changes;
  if (!ch || typeof ch !== 'object') {
    errors.push('momentum-rebalance.json missing changes (rebalance-anchored NEW IN/OUT/rank changes)');
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ch.vsRebalanceDate || '')) errors.push('momentum-rebalance changes.vsRebalanceDate invalid');
    for (const k of ['newIn', 'newOut']) {
      if (!Array.isArray(ch[k]) || !ch[k].every(s => typeof s === 'string')) errors.push(`momentum-rebalance changes.${k} must be a string array`);
    }
    if (!Array.isArray(ch.rankChanges)) errors.push('momentum-rebalance changes.rankChanges must be an array');
    else for (const r of ch.rankChanges) {
      if (!r || typeof r.symbol !== 'string') { errors.push('momentum-rebalance rankChanges entry missing symbol'); continue; }
      if (!Number.isInteger(r.change) || r.change === 0) errors.push(`momentum-rebalance rankChanges invalid change for ${r.symbol}`);
      if (!Number.isInteger(r.prevRank) || !Number.isInteger(r.rank)) errors.push(`momentum-rebalance rankChanges invalid ranks for ${r.symbol}`);
    }
    if (ch.newInCount !== (ch.newIn || []).length || ch.newOutCount !== (ch.newOut || []).length) {
      errors.push('momentum-rebalance changes newInCount/newOutCount inconsistent with array lengths');
    }
  }
  noNonFinite(reb, 'momentum-rebalance');
}

const snap = readJson('momentum-rebalance-snapshot.json');
if (snap) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snap.rebalanceDate || '')) errors.push('momentum-rebalance-snapshot.json invalid rebalanceDate');
  if (!snap.seedSource) errors.push('momentum-rebalance-snapshot.json missing seedSource (baseline must be documented)');
  if (!Array.isArray(snap.list) || !snap.list.length) {
    errors.push('momentum-rebalance-snapshot.json list empty/missing');
  } else {
    const seen = new Set();
    snap.list.forEach((e, i) => {
      if (!e || !e.symbol || seen.has(e.symbol)) errors.push(`momentum-rebalance-snapshot duplicate/missing symbol at index ${i}`);
      seen.add(e && e.symbol);
      if (e && e.rank !== i + 1) errors.push(`momentum-rebalance-snapshot rank ${e && e.rank} != position ${i + 1} for ${e && e.symbol}`);
    });
  }
  noNonFinite(snap, 'momentum-rebalance-snapshot');
}

for (const w of warnings) console.log(`WARN: ${w}`);
if (errors.length) {
  console.error('validate-momentum-state FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('validate-momentum-state PASS');
