'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const target = path.join(root, 'public', 'index.html');
const errors = [];
const html = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
if (!html) errors.push('public/index.html missing');
for (const token of ['id="mandate-command"', 'data-mandate-tab="core"', 'data-mandate-tab="agentic"', 'assets/mandate-command.css', 'assets/mandate-command.js']) {
  if (!html.includes(token)) errors.push(`missing ${token}`);
}
if ((html.match(/id="mandate-command"/g) || []).length !== 1) errors.push('mandate-command must appear exactly once');
if (!html.includes('Monitoring only')) errors.push('Agentic execution disclaimer missing');
if (!html.includes('PAUSED STALE') && !html.includes('READY REVIEW')) errors.push('No explicit mandate state rendered');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('mandate command homepage validation passed');
