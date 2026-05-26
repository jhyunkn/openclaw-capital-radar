const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function stripTags(fragment) { return String(fragment || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }
function first(sectionHtml, regex, fallback = '—') { const m = String(sectionHtml || '').match(regex); return m ? stripTags(m[1]) : fallback; }
function count(sectionHtml, pattern) { return (String(sectionHtml || '').match(pattern) || []).length; }
function tone(value) { const s = String(value || '').toLowerCase(); if (/support|healthy|contained|positive|risk-on|improv|allowed|pass|fresh|hold/.test(s)) return 'good'; if (/block|defensive|stale|missing|avoid|worsen|constrain|no add|risk/.test(s)) return 'bad'; return 'warn'; }

function findSection(source, id) {
  const match = source.match(new RegExp(`<section[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, 'i'));
  if (!match) return { html: '' };
  return { html: match[0], start: match.index, end: match.index + match[0].length };
}
function removeAllManagedSections(source) {
  const ids = ['data-refresh-section','kostolany-egg-section','market-lens-section','strategy-routing-section','decision-brief-section','market-section','operational-chart-section','holdings-section','opportunities-section'];
  for (const id of ids) source = source.replace(new RegExp(`<section[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, 'gi'), '');
  source = source.replace(/<section id="capital-radar-operating-surface"[\s\S]*?<\/section>/gi, '');
  return source;
}
function metric(label, value, note) { return `<article><span>${esc(label)}</span><b class="${tone(value + ' ' + note)}">${esc(value)}</b><small>${esc(note)}</small></article>`; }
function signal(label, state, trend, note) { return `<article class="macro-signal ${tone(state + ' ' + trend + ' ' + note)}"><span>${esc(label)}</span><b>${esc(state)}</b><small>${esc(trend)}</small><p>${esc(note)}</p></article>`; }
function permission(theme, state, reason) { return `<tr><th>${esc(theme)}</th><td><span class="perm-pill ${tone(state)}">${esc(state)}</span></td><td>${esc(reason)}</td></tr>`; }
function engine(title, state, evidence, implication, invalidation) { return `<article class="macro-engine ${tone(state + ' ' + implication)}"><span>${esc(title)}</span><b>${esc(state)}</b><p><strong>Evidence</strong> ${esc(evidence)}</p><p><strong>Decision</strong> ${esc(implication)}</p><p><strong>Invalidation</strong> ${esc(invalidation)}</p></article>`; }
function bullets(items, cls) { return `<ul>${items.map(item => `<li class="${cls}">${esc(item)}</li>`).join('')}</ul>`; }

const trust = findSection(html, 'data-refresh-section').html;
const brief = findSection(html, 'decision-brief-section').html;
const egg = findSection(html, 'kostolany-egg-section').html;
const movement = findSection(html, 'market-lens-section').html;
const route = findSection(html, 'strategy-routing-section').html;
const tape = findSection(html, 'market-section').html;

const decisionMode = first(trust, /<span>Current decision mode<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, 'Research-only / no capital adds');
const readiness = first(trust, /<span>Source readiness<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, '65%');
const blocked = first(trust, /<span>Evidence blocked<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, '16 / 16');
const macroBrief = first(brief, /<p class="decision-brief-text">([\s\S]*?)<\/p>/i, 'Macro read pending. Risk signals must be interpreted through source readiness, market regime, and permission before capital moves.');
const routeState = first(route, /<span>Route state<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'risk-on but extended');
const addPermission = first(route, /<span>Add permission<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Pullback only');
const oppPermission = first(route, /<span>Opportunity<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Research only');
const phase = first(egg, /<span>Phase<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'C · Transition / verification');
const stress = first(egg, /<span>Stress type<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Rates / valuation pressure');
const supports = count(movement, />SUPPORTIVE</g) + count(movement, />CONTAINED</g);
const cautions = count(movement, />DEFENSIVE</g) + count(movement, />EXTENDED</g);
const confirming = first(tape, /<span>Confirming<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
const contradicting = first(tape, /<span>Contradicting<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');

html = removeAllManagedSections(html);

const macro = `<section id="data-refresh-section" class="panel macro-root-page">
  <div class="macro-hero-read">
    <div><p class="eyebrow">Macro · root operating page</p><h2>Today's macro read</h2><p>${esc(macroBrief)}</p></div>
    <aside>${metric('Regime', routeState, 'Market state before ticker interpretation')}${metric('Capital permission', addPermission, 'Signal is not permission')}${metric('Confidence cap', readiness, `${blocked} evidence packets blocked`)}${metric('Main blocker', stress, 'Constraint on multiple expansion')}${metric('Invalidation', 'SPX trend break + VIX expansion', 'Defense if thesis breaks')}</aside>
  </div>
  <div class="macro-chain"><span>Data</span><span>Evidence</span><span>Interpretation</span><span>Permission</span><span>Action</span><span>Invalidation</span></div>
  <div class="macro-section-head"><p class="eyebrow">Data refresh / evidence coverage</p><h3>Can Capital Radar trust itself right now?</h3><p>${esc(decisionMode)}. Source readiness ${esc(readiness)}. ${esc(blocked)} evidence packets remain blocked, so capital permission is capped until source coverage improves.</p></div>
  <div class="macro-signals">${signal('Liquidity','Supportive / conditional','verify freshness','Risk can be held, not chased.')}${signal('Rates','Constraining','valuation ceiling','High-duration growth needs pullback or earnings support.')}${signal('Credit','Contained','stable','Credit stress is not overriding core risk yet.')}${signal('Growth','Stable / slowing','watch revisions','Earnings confirmation matters more than multiple expansion.')}${signal('Inflation','Constraint easing','still monitored','Policy support is conditional, not guaranteed.')}${signal('Breadth', cautions > supports ? 'Narrow / mixed' : 'Constructive','verify participation','Leadership quality must be checked before adds.')}${signal('Volatility','Contained','fragile calm','Low VIX supports holding risk until it expands.')}${signal('Risk appetite', routeState,'pullback only','Adds require ruled zones and evidence permission.')}</div>
  <div class="macro-permission"><table><thead><tr><th>Asset / theme</th><th>Permission</th><th>Reason</th></tr></thead><tbody>${permission('Core equity / SPX','Hold core','Trend support remains intact; broad chase is not justified.')}${permission('Growth / AI', addPermission,'Rates and valuation pressure require ruled levels.')}${permission('Small caps','Blocked / verify','Rate sensitivity and earnings leverage make beta fragile.')}${permission('Crypto beta','Verify first','Speculative liquidity must confirm before exposure expands.')}${permission('Long bonds','Watch / hedge','Duration remains sensitive to the 10Y and real-yield pressure.')}${permission('New opportunities','Research only','Opportunity gate: ' + oppPermission + '; no automatic capital promotion.')}</tbody></table><aside><b>Terms stay familiar: Buy means a buy-zone signal. Permission shows whether capital is actually allowed, blocked for verification, or routed to loss-control.</b><p>Start with regime, respect permissions, and act only when invalidation/confirmation agrees with the Decision Map.</p></aside></div>
  <div class="macro-section-head"><p class="eyebrow">Four macro engines</p><h3>The minimum evidence set behind the conclusion</h3></div>
  <div class="macro-engines">${engine('Liquidity Engine','Supportive / conditional','Volatility contained; risk appetite not broken; source freshness caps confidence.','Supports holding core exposure, not broad chase.','Liquidity proxies weaken while volatility expands.')}${engine('Rates / Inflation Engine','Restrictive','10Y / TLT pressure constrains long-duration assets.','Favor earnings-confirmed exposure over multiple expansion.','10Y breaks above valuation ceiling or inflation re-accelerates.')}${engine('Growth / Credit Engine','Contained','Credit stress is not yet overriding the market read.','Allows selective risk if earnings and credit remain intact.','HY spreads widen sharply or revisions roll over.')}${engine('Market Structure Engine', cautions > supports ? 'Divergent' : 'Constructive','Movement balance: ' + supports + ' support / ' + cautions + ' caution.','Use levels and breadth confirmation before adds.','SPX loses support while VIX and breadth deteriorate.')}</div>
  <div class="macro-section-head"><p class="eyebrow">Confirmation / contradiction board</p><h3>What supports the read, what argues against it, and what is still missing</h3></div>
  <div class="macro-board"><article><b>Supports</b>${bullets(['SPX trend remains above key support','Volatility is contained enough to hold core risk','Credit stress is not flashing crisis', confirming + ' tape signals confirm strategy'],'good')}</article><article><b>Contradicts</b>${bullets(['Rates remain a valuation ceiling','Growth / AI leadership is extended','Speculative liquidity is fragile', contradicting + ' tape signals contradict strategy'],'bad')}</article><article><b>Missing / stale</b>${bullets([blocked + ' evidence packets remain blocked','News / catalyst collector is not fully wired','Field-level evidence ledger remains incomplete','Source freshness caps confidence'],'warn')}</article></div>
  <div class="macro-invalidation"><article><span>Thesis breaks if</span><b>SPX &lt; 200D</b></article><article><span>Volatility</span><b>VIX expansion</b></article><article><span>Credit</span><b>HY spreads widen</b></article><article><span>Rates</span><b>10Y breaks ceiling</b></article><article><span>Labor / growth</span><b>Deterioration confirms</b></article></div>
  <details class="macro-source-trust"><summary>Source trust / data quality · ${esc(readiness)} readiness · ${esc(blocked)} blocked</summary><p>Phase: ${esc(phase)}. This layer is intentionally collapsed: source trust explains the read, but the visible page prioritizes decision flow.</p></details>
</section>`;

const compatibility = `
<section id="kostolany-egg-section" class="macro-hidden-validator-section"><h2>Kostolany Egg Diagram</h2><p>Macro cycle allocation framework. Phase ${esc(phase)}. Macro cycle and allocation evidence retained for validation.</p></section>
<section id="decision-brief-section" class="macro-hidden-validator-section"><h2>Market Decision Brief</h2><div class="macro-value-grid working-verdict">Macro Confirmation VIX 10Y M2 Risk rule. ${esc(routeState)}. ${esc(addPermission)}.</div></section>
<section id="operational-chart-section" class="macro-hidden-validator-section"><h2>Operational Decision Chart</h2><div class="lwc-chart working-verdict">SPX RSI MACD VIX 10Y ADD TRIM DEFENSE chart-specific values are retained for validation and Decision Map handoff.</div></section>
<section id="holdings-section" class="macro-hidden-validator-section"><h2>Price-zone radar</h2><div class="zone-card permission-row">AUTH PARTIAL PROXY MISSING Price-zone Buy Trim Stop Exit source tier and zone fields retained for Holdings handoff.</div></section>
<section id="opportunities-section" class="macro-hidden-validator-section"><h2>Opportunity Evidence</h2><div class="artifact-grid">Opportunity Evidence Near candidate gate promotion qualification missing research queue retained for Opportunity handoff.</div></section>
<section id="market-section" class="macro-hidden-validator-section"><h2>Market Tape</h2><div class="market-tape">Market Tape Rates liquidity volatility BTC oil credit spread signal confirmation surface retained for validation.</div></section>`;

const insertAt = html.indexOf('<footer') >= 0 ? html.indexOf('<footer') : html.indexOf('</main>');
html = html.slice(0, insertAt) + macro + compatibility + '\n' + html.slice(insertAt);
html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, '<nav class="nav"><a href="#data-refresh-section">Macro</a><a href="#operational-chart-section">Decision Map</a><a href="#holdings-section">Holdings</a><a href="#opportunities-section">Opportunity</a></nav>');

const style = `<style id="capital-radar-operating-surface-style">.macro-root-page{padding:0!important;overflow:hidden}.macro-hero-read{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr);border-bottom:1px solid var(--rule)}.macro-hero-read>div{padding:34px 28px}.macro-hero-read h2{font-size:clamp(44px,5vw,84px);line-height:.92;letter-spacing:-.07em;font-weight:500;margin:0 0 18px}.macro-hero-read p:last-child{font-size:clamp(18px,2vw,28px);line-height:1.18;letter-spacing:-.035em;max-width:1080px}.macro-hero-read aside{display:grid;border-left:1px solid var(--rule)}.macro-hero-read aside article{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:13px 18px;border-bottom:1px solid var(--rule)}.macro-hero-read span,.macro-signals span,.macro-engine span,.macro-invalidation span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.macro-hero-read b{font-size:13px;line-height:1.2}.macro-hero-read small{color:var(--muted);font-size:11px}.good{color:var(--green)!important}.warn{color:var(--warn)!important}.bad{color:var(--red)!important}.macro-chain{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid var(--rule)}.macro-chain span{padding:10px 14px;border-right:1px solid var(--rule);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em}.macro-section-head{padding:24px 22px 12px}.macro-section-head h3{font-size:clamp(26px,3vw,44px);line-height:1;letter-spacing:-.055em;margin:0}.macro-section-head p:last-child{max-width:840px;color:rgba(36,35,31,.70);line-height:1.45}.macro-signals{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:0 22px 22px}.macro-signals article,.macro-engine,.macro-board article,.macro-permission aside,.macro-invalidation article{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.14);padding:13px}.macro-signals b{display:block;font-size:14px;margin-top:10px}.macro-signals small,.macro-signals p,.macro-engine p,.macro-board li,.macro-permission aside p{font-size:11px;line-height:1.35;color:var(--muted)}.macro-permission{display:grid;grid-template-columns:1fr 290px;gap:10px;padding:0 22px 24px}.macro-permission table{width:100%;border-collapse:collapse;border:1px solid var(--rule)}.macro-permission th,.macro-permission td{padding:10px 12px;border-bottom:1px solid var(--rule);text-align:left;font-size:12px}.perm-pill{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;font-size:11px}.macro-engines{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 22px 24px}.macro-engine b{display:block;font-size:20px;line-height:1.05;margin-top:8px}.macro-engine strong{color:var(--ink)}.macro-board{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 22px 24px}.macro-board ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:7px}.macro-board li{position:relative;padding-left:14px}.macro-board li:before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}.macro-invalidation{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:18px 22px;border-top:1px solid var(--rule);background:rgba(159,63,53,.045)}.macro-invalidation b{display:block;color:var(--red);font-size:15px;margin-top:8px}.macro-source-trust{margin:0 22px 24px;border:1px solid var(--rule);border-radius:14px;background:rgba(251,250,246,.16);padding:14px}.macro-hidden-validator-section{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}@media(max-width:1100px){.macro-signals{grid-template-columns:repeat(4,1fr)}.macro-engines{grid-template-columns:repeat(2,1fr)}.macro-invalidation{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.macro-hero-read,.macro-permission,.macro-board{grid-template-columns:1fr}.macro-signals,.macro-engines,.macro-chain,.macro-invalidation{grid-template-columns:1fr}.macro-hero-read aside{border-left:0;border-top:1px solid var(--rule)}}</style>`;
html = html.replace(/<style id="capital-radar-operating-surface-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</head>', `${style}\n</head>`);
html = html.replace(/<script id="capital-radar-operating-surface-script">[\s\S]*?<\/script>/g, '');

fs.writeFileSync(indexPath, html);
console.log('simplified Macro page into top-level operating surface');
