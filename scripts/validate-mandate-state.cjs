'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'mandate-state.json');
const reportPath = path.join(root, 'outputs', 'mandate-state-validation.json');
const errors = [];
let state = null;
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (error) { errors.push(`mandate-state unreadable: ${error.message}`); }
const mandates = state?.mandates || [];
for (const id of ['core', 'agentic']) if (!mandates.some(row => row.id === id)) errors.push(`missing mandate: ${id}`);
for (const mandate of mandates) {
  if (!Array.isArray(mandate.dependencies) || !mandate.dependencies.length) errors.push(`${mandate.id}: dependencies missing`);
  if (!['READY_REVIEW', 'PAUSED_STALE', 'WAIT', 'ARMED', 'IN_POSITION', 'BLACKOUT'].includes(mandate.state)) errors.push(`${mandate.id}: invalid state ${mandate.state}`);
  if (mandate.state === 'ARMED' && mandate.dependencies.some(row => row.required && row.status !== 'OK')) errors.push(`${mandate.id}: ARMED with blocked dependency`);
  if (mandate.actionAllowed) errors.push(`${mandate.id}: dashboard must not self-authorize execution`);
}
const agentic = mandates.find(row => row.id === 'agentic');
if (agentic?.state === 'ARMED' && !agentic.playbook?.conditions?.every(row => !row.required || row.status === 'PASS')) errors.push('agentic: ARMED without all required conditions passing');
if (agentic?.state === 'ARMED') {
  const ticket = agentic.playbook?.ticket || {};
  const risk = agentic.riskPolicy || {};
  for (const field of ['quantity', 'referenceEntry', 'stopReference', 'minimumObjective', 'plannedDeployment', 'plannedRisk']) {
    if (!Number.isFinite(Number(ticket[field]))) errors.push(`agentic: ARMED with invalid ticket field ${field}`);
  }
  if (Number(ticket.plannedDeployment) > Number(risk.maxDeployment)) errors.push('agentic: ARMED above deployment limit');
  if (Number(ticket.plannedRisk) > Number(risk.maxPlannedRisk)) errors.push('agentic: ARMED above planned-risk limit');
  if (ticket.authorization !== 'not_authorized') errors.push('agentic: dashboard ticket must remain not_authorized');
}
const report = { checkedAt: new Date().toISOString(), ok: errors.length === 0, errors, states: Object.fromEntries(mandates.map(row => [row.id, row.state])) };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`mandate state valid: ${JSON.stringify(report.states)}`);
