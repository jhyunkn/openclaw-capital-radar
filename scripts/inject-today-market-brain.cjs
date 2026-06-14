const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const outputsDir = path.join(root, 'outputs');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function readJson(relativePath, fallback = {}) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _readError: error.message };
  }
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function pickLens(state, symbol) {
  return arr(state.lenses || state.items || state.assets || state.signals).find(item => {
    const key = String(item.symbol || item.ticker || item.key || '').toUpperCase();
    return key === symbol;
  }) || null;
}

function lensState(item, fallback = 'unknown') {
  return String(item?.status || item?.state || item?.signal || item?.regime || item?.verdict || fallback).replace(/_/g, ' ');
}

function tone(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('support') || text.includes('confirm') || text.includes('contained') || text.includes('allowed')) return 'good';
  if (text.includes('defensive') || text.includes('block') || text.includes('risk') || text.includes('deterior')) return 'bad';
  return 'warn';
}

function short(value, fallback = '—') {
  const text = String(value || '').trim();
  return text || fallback;
}

function renderTile(label, value, note, className = '') {
  return `<article class="brain-tile ${className}"><span>${esc(label)}</span><b>${esc(value)}</b>${note ? `<small>${esc(note)}</small>` : ''}</article>`;
}

function renderList(title, items, className = '') {
  const rows = arr(items).filter(Boolean).slice(0, 4);
  return `<article class="brain-list ${className}"><span>${esc(title)}</span><ul>${rows.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`;
}

function buildBrain() {
  const brief = readJson('outputs/market-decision-brief-state.json');
  const lens = readJson('outputs/market-lens-state.json');
  const route = readJson('outputs/strategy-routing-state.json');
  const chart = readJson('outputs/operational-chart-state.json');
  const holdings = readJson('outputs/holding-zone-state.json');
  const opportunities = readJson('outputs/opportunity-asymmetry-state.json');

  const spx = pickLens(lens, 'SPX');
  const qqq = pickLens(lens, 'QQQ');
  const tlt = pickLens(lens, 'TLT');
  const btc = pickLens(lens, 'BTC');
  const vix = pickLens(lens, 'VIX');

  const routeName = short(route.route || route.active_route || route.name || route.regime || 'risk-on but extended');
  const riskBudget = short(route.risk_budget || route.riskBudget || route.risk_budget_status || 'active but disciplined');
  const addPermission = short(route.add_permission || route.addPermission || route.add || 'pullback only');
  const opportunityPermission = short(route.opportunity_permission || route.opportunityPromotion || route.opportunity_promotion || 'near miss only');

  const posture = short(brief.portfolio_action || chart.action || 'Hold core; selective adds only at ruled zones.');
  const mainRead = short(brief.brief || brief.market_read || 'Market posture is available, but the daily brief did not render a complete sentence.');
  const changeRule = short(brief.change_rule || chart.change_rule || chart.changeLine || 'Wait for a ruled pullback or confirmation change.');
  const riskRule = short(brief.risk_rule || chart.risk_rule || chart.riskLine || 'Shift defensive if price loses the risk line with volatility expansion.');

  const allowed = [
    `Hold core exposure while route remains ${routeName}.`,
    `Add only under ${addPermission} permission.`,
    'Use ruled buy zones, not emotional entries.',
  ];
  const blocked = [
    'Do not chase broad beta after extension.',
    `Do not promote speculative ideas beyond ${opportunityPermission}.`,
    'Do not ignore rate pressure when sizing long-duration growth.',
  ];
  const changed = [
    `SPX: ${lensState(spx, 'not available')}`,
    `QQQ / growth: ${lensState(qqq, 'not available')}`,
    `TLT / rates: ${lensState(tlt, 'not available')}`,
    `BTC / speculative liquidity: ${lensState(btc, 'not available')}`,
    `VIX / stress: ${lensState(vix, 'not available')}`,
  ];

  const buyCount = holdings.summary?.buy_zone ?? holdings.counts?.buy_zone ?? holdings.buy_zone_count ?? '—';
  const holdCount = holdings.summary?.hold_zone ?? holdings.counts?.hold_zone ?? holdings.hold_zone_count ?? '—';
  const trimCount = holdings.summary?.trim_zone ?? holdings.counts?.trim_zone ?? holdings.trim_zone_count ?? '—';
  const nearMissCount = opportunities.summary?.near_miss ?? opportunities.counts?.near_miss ?? opportunities.near_miss_count ?? '—';

  return `<section id="today-market-brain-section" class="panel today-market-brain">
    <div class="section-head"><div><p class="eyebrow">Today’s Market Brain</p><h2>Macro landscape → permission → action</h2><p class="brain-sub">A daily operating read that converts market movement into what you are allowed to do, what is blocked, and what would change the decision.</p></div><a class="button" href="outputs/market-decision-brief-state.json">Open source state</a></div>
    <div class="brain-hero-grid">
      <article class="brain-primary"><span>Operating read</span><b>${esc(routeName)}</b><p>${esc(mainRead)}</p></article>
      <aside class="brain-actions">
        ${renderTile('Permission', posture, `Risk budget: ${riskBudget}`, 'good')}
        ${renderTile('Next trigger', changeRule, '', 'warn')}
        ${renderTile('Invalidation', riskRule, '', 'bad')}
      </aside>
    </div>
    <div class="brain-signal-grid">
      ${renderTile('SPX / broad market', lensState(spx, 'not available'), 'core regime signal', tone(lensState(spx)))}
      ${renderTile('QQQ / growth leadership', lensState(qqq, 'not available'), 'chase-risk signal', tone(lensState(qqq)))}
      ${renderTile('TLT / rates', lensState(tlt, 'not available'), 'valuation-pressure signal', tone(lensState(tlt)))}
      ${renderTile('BTC / liquidity beta', lensState(btc, 'not available'), 'speculative-risk signal', tone(lensState(btc)))}
      ${renderTile('VIX / stress', lensState(vix, 'not available'), 'risk-control signal', tone(lensState(vix)))}
    </div>
    <div class="brain-decision-grid">
      ${renderList('What changed / matters', changed, 'watch')}
      ${renderList('Allowed today', allowed, 'good')}
      ${renderList('Blocked today', blocked, 'bad')}
      <article class="brain-list evidence"><span>Trust check</span><ul><li>REAL prices and market levels are allowed as facts.</li><li>DERIVED/EST signals are decision aids, not certainty.</li><li>Missing or stale values must not become zero.</li><li>Use invalidation before increasing risk.</li></ul></article>
    </div>
    <div class="brain-footer-strip">
      ${renderTile('Holdings state', `${buyCount} buy · ${holdCount} hold · ${trimCount} trim`, 'translate into position actions')}
      ${renderTile('Opportunity state', `${nearMissCount} near-miss ideas`, 'watchlist, not automatic buy list')}
      ${renderTile('Operating rule', 'Signal → meaning → permission → action → invalidation', 'every section should answer “so what?”')}
    </div>
  </section>`;
}

function style() {
  return `<style id="today-market-brain-style">.today-market-brain{position:relative;background:#ffffff);border-top:1px solid rgba(36,35,31,.18)}.today-market-brain:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(36,35,31,.34),transparent)}.brain-sub{max-width:780px;color:var(--muted);font-size:14px;line-height:1.45;margin:8px 0 0}.brain-hero-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:12px;margin:14px 0}.brain-primary,.brain-actions article,.brain-tile,.brain-list{border:1px solid var(--rule);border-radius:18px;background:#ffffff;padding:14px;min-width:0}.brain-primary{padding:20px}.brain-primary span,.brain-tile span,.brain-list span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.095em}.brain-primary b{display:block;font-size:clamp(30px,4vw,54px);line-height:.96;letter-spacing:-.055em;margin-top:10px}.brain-primary p{font-size:17px;line-height:1.42;max-width:960px;margin:18px 0 0;color:rgba(36,35,31,.78)}.brain-actions{display:grid;gap:8px}.brain-tile b{display:block;font-size:18px;line-height:1.2;margin-top:7px;font-weight:560}.brain-tile small{display:block;color:var(--muted);font-size:11px;line-height:1.32;margin-top:7px}.brain-tile.good{border-color:rgba(47,111,78,.38)}.brain-tile.warn{border-color:rgba(174,124,44,.42)}.brain-tile.bad{border-color:rgba(159,63,53,.44)}.brain-signal-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}.brain-decision-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.brain-list ul{margin:8px 0 0;padding-left:17px;color:rgba(36,35,31,.76);font-size:12px;line-height:1.45}.brain-list.good{border-color:rgba(47,111,78,.34)}.brain-list.bad{border-color:rgba(159,63,53,.38)}.brain-list.watch{border-color:rgba(174,124,44,.36)}.brain-list.evidence{background:rgba(36,35,31,.035)}.brain-footer-strip{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px;margin-top:10px}@media(max-width:1100px){.brain-hero-grid,.brain-footer-strip{grid-template-columns:1fr}.brain-signal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.brain-decision-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.brain-signal-grid,.brain-decision-grid{grid-template-columns:1fr}.brain-primary{padding:16px}.brain-primary b{font-size:34px}.brain-primary p{font-size:15px}}</style>`;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="today-market-brain-style">[\s\S]*?<\/style>/, '');
html = html.replace(/<section id="today-market-brain-section"[\s\S]*?(?=<section id="|<footer|<\/main>)/, '');

const section = buildBrain();
const styleTag = style();
html = html.replace('</head>', `${styleTag}</head>`);

const heroEnd = html.indexOf('</header>');
if (heroEnd < 0) throw new Error('hero header closing tag not found');
const insertAt = heroEnd + '</header>'.length;
html = `${html.slice(0, insertAt)}${section}${html.slice(insertAt)}`;

fs.writeFileSync(indexPath, html);
fs.mkdirSync(outputsDir, { recursive: true });
fs.writeFileSync(path.join(outputsDir, 'today-market-brain-report.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: 'OK',
  section: 'today-market-brain-section',
  policy: 'daily market operating brain: macro landscape to decision permission',
}, null, 2));
console.log('injected today market brain section');
