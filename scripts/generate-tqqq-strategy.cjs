'use strict';

// generate-tqqq-strategy.cjs
//
// Renders the TQQQ strategy blueprint from data/tqqq-strategy.json:
//   - recomputes the LIVE block from data/market-candles/QQQ.json + TQQQ.json
//     (latest closes, monthly grade, 200-day / TQQQ Labs line, distances)
//   - writes the updated live block back into data/tqqq-strategy.json
//     (system, evidence, rule and verdict are NEVER rewritten here —
//     they change only by Jun's explicit approval with a new backtest)
//   - renders pages/tqqq-strategy.html from the spec
//
// Fail-closed: missing candle files throw. A recomputed 10-month MA that
// disagrees with a stored verified grade by more than 0.5% does NOT
// overwrite the grade — it sets live.verification.drift and keeps the
// stored value, so a data-vintage change can never silently rewrite history.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const specPath = path.join(root, 'data', 'tqqq-strategy.json');
const qqqPath = path.join(root, 'data', 'market-candles', 'QQQ.json');
const tqqqPath = path.join(root, 'data', 'market-candles', 'TQQQ.json');
const outPath = path.join(root, 'pages', 'tqqq-strategy.html');

function fail(msg) { throw new Error(`generate-tqqq-strategy: ${msg}`); }
function readJson(p) {
  if (!fs.existsSync(p)) fail(`missing file: ${path.relative(root, p)}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const round2 = n => Math.round(n * 100) / 100;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => typeof n === 'number' ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'n/a';
const pct = (n, digits = 2) => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%` : 'n/a';

const spec = readJson(specPath);
const qqq = readJson(qqqPath);
const tqqq = readJson(tqqqPath);

const qqqCandles = (qqq.candles || []).filter(c => c && typeof c.close === 'number' && c.time);
const tqqqCandles = (tqqq.candles || []).filter(c => c && typeof c.close === 'number' && c.time);
if (qqqCandles.length < 220) fail(`QQQ candles too short (${qqqCandles.length}); need 220+ for the 200-day average`);
if (tqqqCandles.length === 0) fail('TQQQ candles empty');

const lastQqq = qqqCandles[qqqCandles.length - 1];
const lastTqqq = tqqqCandles[tqqqCandles.length - 1];

// Monthly closes: last close of each calendar month (YYYY-MM).
const monthly = new Map();
for (const c of qqqCandles) {
  monthly.set(String(c.time).slice(0, 7), { close: c.close, date: c.time });
}
const months = [...monthly.keys()].sort();
const latestMonth = months[months.length - 1];
const latestMonthClose = monthly.get(latestMonth).close;

// Grade the latest completed month against the 10 months before it.
const idx = months.indexOf(latestMonth);
if (idx < 10) fail(`not enough monthly history to grade ${latestMonth}`);
const maInputs = months.slice(idx - 10, idx).map(m => monthly.get(m).close);
const ma = maInputs.reduce((a, b) => a + b, 0) / maInputs.length;
const closeVsMa = (latestMonthClose / ma - 1) * 100;
const exitLine = ma * 0.95;
const gate = closeVsMa >= -5 ? 'ON' : 'OFF';

const stored = spec.live && spec.live.monthly_grade;
let drift = false;
let driftNote = '';
if (stored && stored.month === latestMonth) {
  const diffPct = Math.abs(ma - stored.ma_10mo) / stored.ma_10mo * 100;
  if (diffPct > 0.5) {
    drift = true;
    driftNote = `Recomputed 10-month MA ${money(round2(ma))} differs from stored verified MA ${money(stored.ma_10mo)} by ${diffPct.toFixed(2)}% — stored grade kept, flag for Jun.`;
  }
}

// 200-day average from daily closes -> TQQQ Labs line (200-day + 0.67%).
const closes200 = qqqCandles.slice(-200).map(c => c.close);
const ma200 = closes200.reduce((a, b) => a + b, 0) / closes200.length;
const labsLine = ma200 * 1.0067;

// Distances from the current QQQ close.
const qqqClose = lastQqq.close;
const distExitPct = (qqqClose / exitLine - 1) * 100;
const distLabsPct = (qqqClose / labsLine - 1) * 100;
const qqqDayPct = qqqCandles.length > 1 ? (lastQqq.close / qqqCandles[qqqCandles.length - 2].close - 1) * 100 : null;
const tqqqDayPct = tqqqCandles.length > 1 ? (lastTqqq.close / tqqqCandles[tqqqCandles.length - 2].close - 1) * 100 : null;

const now = new Date().toISOString();
const live = spec.live || {};
live.asOf = lastQqq.time;
live.source = 'Yahoo Finance (monthly closes verified 2026-11-01 from the QQQ history page; daily closes from data/market-candles)';
live.qqq = { close: round2(qqqClose), date: lastQqq.time, change_day_pct: qqqDayPct == null ? null : round2(qqqDayPct) };
live.tqqq = { close: round2(lastTqqq.close), date: lastTqqq.time, change_day_pct: tqqqDayPct == null ? null : round2(tqqqDayPct) };
live.labs = {
  qqq_200day: round2(ma200),
  sell_line: round2(labsLine),
  qqq_close_vs_sell_line_pct: round2(distLabsPct),
  read: distLabsPct >= 0
    ? `QQQ ${money(round2(qqqClose))} sits ${pct(distLabsPct)} above the Labs sell line — no trigger.`
    : `QQQ ${money(round2(qqqClose))} sits ${pct(distLabsPct)} below the Labs sell line — a close below it is the host's sell trigger, NOT Jun's rule.`,
};
live.distances = {
  qqq_close_vs_exit_line_pct: round2(distExitPct),
  qqq_close_vs_exit_line_dollars: round2(qqqClose - exitLine),
};
if (!drift) {
  live.monthly_grade = {
    month: latestMonth,
    month_close: round2(latestMonthClose),
    ma_10mo: round2(ma),
    ma_inputs: maInputs.map(round2),
    ma_input_months: months.slice(idx - 10, idx),
    close_vs_ma_pct: round2(closeVsMa),
    gate,
    exit_line: round2(exitLine),
    exit_line_distance_dollars: round2(latestMonthClose - exitLine),
    exit_line_distance_pct: round2((latestMonthClose / exitLine - 1) * 100),
    position: gate === 'ON' ? '100% TQQQ, NO TRIM' : '70% TQQQ / 30% bills',
    verified: now.slice(0, 10),
    note: stored && stored.month === latestMonth && stored.note ? stored.note : '',
  };
}
live.verification = { drift, note: driftNote };
live.next_grade = 'Next month-end close. The MA for that test is the 10 completed months through the just-closed month — recompute then; the stored MA does NOT carry forward.';
spec.live = live;
spec.updatedAt = now;
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');

// ---- Render pages/tqqq-strategy.html ----
const s = spec.system;
const ev = spec.evidence;
const g = live.monthly_grade;
const rows = ev.table_profit_pct_of_buy_and_hold.rows.map(r => {
  const v = r.values;
  return `<tr><td>${esc(r.system)}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td><td>${v[3]}</td><td>${r.max_drawdown_pct != null ? r.max_drawdown_pct + '%' : '—'}</td></tr>`;
}).join('');
const related = Object.entries(spec.related_systems).map(([key, r]) => {
  const title = { agentic_watcher: 'Agentic TQQQ watcher (live monitor)', agentic_survival_grid: 'Agentic survival grid (backtest)', inflow_study: '$30k/year inflow study' }[key] || key;
  const extra = key === 'agentic_watcher'
    ? `<p><a href="/outputs/tqqq-watcher-state.json">Watcher state JSON</a> · live status: ${esc(r.live_status || '')}</p>` : '';
  return `<article><h3>${esc(title)}</h3><p>${esc(r.what || '')}</p><p><small>${esc(r.status || r.result || '')}</small></p>${extra}</article>`;
}).join('');
const research = spec.open_research.map(r => `<li><b>${esc(r.question)}</b><p>${esc(r.status)}</p></li>`).join('');
const falsifiers = spec.falsifiers.map(f => `<li>${esc(f)}</li>`).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TQQQ Strategy Blueprint · Capital Radar</title><style>:root{--bg:#f3f2ed;--paper:#fbfaf6;--ink:#24231f;--muted:#747168;--rule:#dedbd2;--green:#2f6f4e;--red:#9f3f35;--blue:#405f9f;--warn:#8a6a2c}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}.top{position:sticky;top:0;z-index:30;display:flex;justify-content:space-between;gap:18px;align-items:center;padding:16px clamp(18px,4vw,56px);border-bottom:1px solid var(--rule);background:rgba(255,255,255,.9);backdrop-filter:blur(18px);font-size:14px}.top a{text-decoration:none}.top a:hover{text-decoration:underline}.wrap{max-width:1060px;margin:0 auto;padding:56px clamp(18px,4vw,56px) 64px}.kicker{font-size:14px;color:var(--muted);margin:0 0 18px}.kicker a{text-decoration:none}h1{font-size:clamp(44px,7vw,84px);line-height:.95;letter-spacing:-.05em;margin:0 0 16px;font-weight:500}.lede{font-size:19px;line-height:1.5;max-width:720px;margin:0 0 12px}.badge{display:inline-block;border:1px solid var(--warn);color:var(--warn);border-radius:999px;padding:6px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:18px 0}.badge.live{border-color:var(--green);color:var(--green)}h2{font-size:clamp(26px,3.4vw,40px);letter-spacing:-.04em;margin:56px 0 14px;font-weight:500}h3{font-size:19px;letter-spacing:-.02em;margin:0 0 8px;font-weight:600}p{font-size:16px;line-height:1.55;margin:0 0 12px}small{color:var(--muted);font-size:13px;line-height:1.45}section{border-top:1px solid var(--rule);padding-top:8px}.ai-box{background:#fff;border:1px solid var(--rule);padding:20px 22px;margin:28px 0}.ai-box h2{margin-top:0}.rule-box{background:#fff;border:1px solid var(--rule);padding:22px;margin:20px 0}.rule-box p{font-size:18px}.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin:18px 0}.kv div{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px;background:#fff}.kv span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.kv b{font-size:22px;letter-spacing:-.03em;font-weight:500}.kv small{display:block;margin-top:4px}table{width:100%;border-collapse:collapse;background:#fff;font-size:14px;line-height:1.4;margin:16px 0}th,td{border:1px solid var(--rule);padding:10px 12px;text-align:left;vertical-align:top}th{background:var(--bg);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}td small{color:var(--muted)}.verdict{background:rgba(47,111,78,.06);border:1px solid rgba(47,111,78,.36);padding:18px 20px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.grid article{background:#fff;border:1px solid var(--rule);padding:18px}.grid h3{margin-bottom:6px}ul{margin:8px 0 12px;padding-left:20px}li{font-size:15px;line-height:1.5;margin:7px 0}li p{font-size:14px;color:var(--muted);margin:4px 0 0}.foot{border-top:1px solid var(--rule);margin-top:56px;padding-top:16px;color:var(--muted);font-size:13px;line-height:1.5}.foot a{color:var(--muted)}@media(max-width:700px){.kv{grid-template-columns:1fr 1fr}}</style></head><body><header class="top"><a href="/">← Capital Radar</a><span>TQQQ Strategy Blueprint · updated ${esc(now.slice(0, 10))}</span></header><main class="wrap"><p class="kicker"><a href="/">Capital Radar</a> · Systematic engines · TQQQ</p><h1>TQQQ Strategy Blueprint</h1><p class="lede">${esc(spec.objective)}</p><span class="badge">${esc(spec.status === 'specified_not_live' ? 'Specified — not live' : spec.status)}</span><p><small>${esc(spec.statusNote)}</small></p><section class="ai-box"><h2>For AI readers</h2><p>This page is the human-readable render of <a href="/data/tqqq-strategy.json">/data/tqqq-strategy.json</a> — the single machine-readable blueprint. Any AI reading it should be able to state the rule, grade the current month, and update the live block without changing the system.</p><p><small>${esc(spec.for_ai.how_to_read.join(' '))}</small></p><p><small>Update rules: ${esc(spec.for_ai.how_to_update.join(' '))}</small></p></section><section><h2>The system — ${esc(s.name)}</h2><div class="rule-box"><p>${esc(s.rule_plain)}</p></div><div class="kv"><div><span>Signal</span><b>QQQ vs 10-mo MA</b><small>${esc(s.rule_formal.signal)}</small></div><div><span>Trim threshold</span><b>−${esc(s.rule_formal.trim_threshold_pct)}%</b><small>monthly close below the average</small></div><div><span>Trim size</span><b>${esc(Math.round(s.rule_formal.trim_fraction * 100))}% to bills</b><small>hold ${esc('70% TQQQ / 30% bills')} when off</small></div><div><span>Re-entry</span><b>Close back above MA</b><small>${esc(s.rule_formal.reentry)}</small></div><div><span>Trades in 16y test</span><b>${esc(s.rule_formal.trades_in_16y_backtest)}</b><small>trade only on state change</small></div><div><span>Origin</span><b>Jun's design</b><small>${esc(s.origin)}</small></div></div><p><small>${esc(s.parameter_note)}</small></p></section><section><h2>Live now</h2><div class="kv"><div><span>October 2026 grade</span><b>${esc(g.gate === 'ON' ? 'Gate ON — no trim' : 'Gate OFF — 70% TQQQ')}</b><small>close ${money(g.month_close)} vs MA ${money(g.ma_10mo)} (${pct(g.close_vs_ma_pct)})</small></div><div><span>Exit line</span><b>${money(g.exit_line)}</b><small>${money(g.exit_line_distance_dollars)} from the October close (${pct(g.exit_line_distance_pct)})</small></div><div><span>QQQ close</span><b>${money(live.qqq.close)}</b><small>${esc(live.qqq.date)} · ${pct(live.distances.qqq_close_vs_exit_line_pct)} vs exit line</small></div><div><span>TQQQ close</span><b>${money(live.tqqq.close)}</b><small>${esc(live.tqqq.date)}</small></div><div><span>TQQQ Labs line</span><b>${money(live.labs.sell_line)}</b><small>200-day ${money(live.labs.qqq_200day)} + 0.67% · ${esc(live.labs.read)}</small></div><div><span>Next grade</span><b>${esc('Nov 30, 2026')}</b><small>month-end close; MA recomputed then</small></div></div>${drift ? `<p><b>Verification drift:</b> ${esc(driftNote)}</p>` : ''}</section><section><h2>The evidence — profit as % of buy-and-hold</h2><table><thead><tr><th>System</th><th>Full period</th><th>Bull years</th><th>2018–26</th><th>From Nov 2021 top</th><th>Max drawdown</th></tr></thead><tbody>${rows}</tbody></table><div class="verdict"><p><b>Verdict.</b> ${esc(ev.verdict)}</p></div><p><small>Source: ${esc(ev.source)}</small></p><p><small>${esc(ev.key_mechanism_note)}</small></p></section><section><h2>The other TQQQ systems — do not merge these</h2><div class="grid">${related}</div></section><section><h2>Open research — the path to a large-margin edge</h2><ul>${research}</ul><h2>What would falsify this system</h2><ul>${falsifiers}</ul></section><footer class="foot">Generated from <a href="/data/tqqq-strategy.json">data/tqqq-strategy.json</a> by scripts/generate-tqqq-strategy.cjs · Research support only; no automatic brokerage action. · Agentic watcher state: <a href="/outputs/tqqq-watcher-state.json">outputs/tqqq-watcher-state.json</a></footer></main></body></html>`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`tqqq-strategy: grade ${latestMonth} close ${money(round2(latestMonthClose))} vs MA ${money(round2(ma))} (${pct(round2(closeVsMa))}) gate ${gate}; exit ${money(round2(exitLine))}; Labs line ${money(round2(labsLine))}${drift ? ' — DRIFT FLAGGED' : ''}; wrote ${path.relative(root, outPath)}`);
