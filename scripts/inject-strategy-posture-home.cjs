require('./generate-artifact-status-state.cjs');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const strategyPath = path.join(root, 'outputs', 'strategy-state.json');

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function list(value) { return Array.isArray(value) ? value : []; }
function fmt(value) { return String(value || '').replace(/_/g, ' '); }

if (!fs.existsSync(indexPath)) throw new Error('index.html missing; run render-operating-brain-home.cjs first');
if (!fs.existsSync(strategyPath)) throw new Error('strategy-state.json missing; run generate-strategy-state.cjs first');

const strategy = JSON.parse(fs.readFileSync(strategyPath, 'utf8'));
let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('id="strategy-section"')) { console.log('strategy posture already present; skipping injection'); process.exit(0); }

const themes = list(strategy.highest_conviction_themes).slice(0, 4);
const blocked = list(strategy.blocked_actions).slice(0, 4);
const questions = list(strategy.next_best_questions).slice(0, 4);
const exposure = strategy.exposure_guidance || {};

const section = `<section id="strategy-section" class="panel"><div class="section-head"><div><p class="eyebrow">Strategy Posture</p><h2>Decision posture</h2></div><a class="button" href="outputs/strategy-state.json">Open artifact</a></div><p class="judgment">${esc(fmt(strategy.overall_posture))}: ${esc(fmt(strategy.capital_action))}</p><div class="trust-strip"><article><span>Overall posture</span><b>${esc(fmt(strategy.overall_posture))}</b></article><article><span>Capital action</span><b>${esc(fmt(strategy.capital_action))}</b></article><article><span>Data truth</span><b>${esc(strategy.decision_summary?.data_truth || 'unknown')}</b></article><article><span>Changed</span><b>${strategy.changed_since_last_cycle ? 'Yes' : 'No'}</b></article></div><div class="translation-strip"><article><span>Exposure guidance</span><b>Cash: ${esc(exposure.cash || 'pending')} · Core equity: ${esc(exposure.core_equity || 'pending')} · Spec growth: ${esc(exposure.speculative_growth || 'pending')}</b></article><article><span>AI / crypto guidance</span><b>AI infrastructure: ${esc(exposure.ai_infrastructure || 'pending')} · Crypto beta: ${esc(exposure.crypto_beta || 'pending')}</b></article></div><div class="artifact-grid">${themes.map(theme => `<article class="artifact-card"><span class="pill ${theme.confidence >= 0.7 ? 'good' : 'warn'}">conviction theme</span><h3>${esc(theme.theme)}</h3><div class="artifact-list"><div><span>Confidence</span><b>${esc(theme.confidence)}</b></div><div><span>Evidence ids</span><b>${esc(list(theme.evidence_ids).join(', '))}</b></div></div></article>`).join('')}</div><div class="translation-strip"><article><span>Blocked actions</span><b>${esc(blocked.map(item => `${item.action}: ${item.reason}`).join(' · '))}</b></article><article><span>Next best questions</span><b>${esc(questions.join(' · '))}</b></article></div></section>`;

html = html.replace(/<nav class="nav">/, '<nav class="nav"><a href="#strategy-section">Strategy</a>');
html = html.replace(/(<\/header>)/, `$1${section}`);
html = html.replace(/<span>Market landscape<\/span>/, '<span>Strategy state</span><span>Market landscape</span>');
html = html.replace(/<a class="button" href="outputs\/institutional-evidence-map.json">Open evidence map<\/a>/, '<a class="button" href="outputs/strategy-state.json">Open strategy state</a><a class="button" href="outputs/institutional-evidence-map.json">Open evidence map</a>');
fs.writeFileSync(indexPath, html);
console.log(`injected strategy posture without artifact status section: ${strategy.overall_posture}`);
