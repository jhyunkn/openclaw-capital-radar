const fs = require('fs');
const path = require('path');
const input = process.argv[2] || path.join(__dirname, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(input, 'utf8'));
const allowedSignals = ["HOLD","HOLD / WATCH","ADD WATCH","ADD CANDIDATE","TRIM WATCH","TRIM CANDIDATE","EXIT REVIEW","INVESTIGATE"];
function line(s=''){ return s + '\n'; }
function bullets(items){ return items.map(i => '- ' + i).join('\n'); }
function check(){
  const bad = [];
  for (const h of state.holdings || []) if (!allowedSignals.includes(h.signal)) bad.push(h.ticker + ': invalid signal ' + h.signal);
  for (const c of state.opportunityScout?.candidates || []) if (!allowedSignals.includes(c.signal)) bad.push(c.ticker + ': invalid signal ' + c.signal);
  const required = ['marketRegime','kostolanyCycle','holdings','newsMonitoring','valuationExpectation','rebalance','opportunityScout','riskOfficer','finalOutput'];
  for (const key of required) if (!state[key]) bad.push('missing section: ' + key);
  if (bad.length) { console.error('Report validation failed:\n' + bad.map(x => '- ' + x).join('\n')); process.exit(1); }
}
function render(){
  let out = '';
  out += line('# ' + state.meta.reportName + ' - Daily Financial Report');
  out += line();
  out += line('**Date:** ' + state.meta.reportDate + '  ');
  out += line('**Target time:** ' + state.meta.targetTime + '  ');
  out += line('**Data status:** ' + state.meta.dataStatus + '  ');
  out += line('**Boundary:** Research/report support only; not an automatic broker.');
  out += line();
  out += line('## 1. Market Regime');
  out += line('- **Posture:** ' + state.marketRegime.posture);
  out += line('- **Growth:** ' + state.marketRegime.growth);
  out += line('- **Inflation:** ' + state.marketRegime.inflation);
  out += line('- **Policy:** ' + state.marketRegime.policy);
  out += line('- **Liquidity:** ' + state.marketRegime.liquidity);
  out += line('- **Risk appetite:** ' + state.marketRegime.riskAppetite);
  out += line('- **Most important macro signal:** ' + state.marketRegime.mostImportantMacroSignal);
  out += line('- **Confidence:** ' + state.marketRegime.confidence);
  out += line();
  out += line('## 2. Kostolany Cycle Position');
  out += line('**Phase:** ' + state.kostolanyCycle.phase);
  out += line();
  out += line(state.kostolanyCycle.interpretation);
  out += line();
  out += line('**Evidence:**');
  out += line(bullets(state.kostolanyCycle.evidence));
  out += line();
  out += line('## 3. Existing Holdings Review');
  const hasLivePrices = state.holdings.some(h => h.livePrice !== undefined);
  if (hasLivePrices) {
    out += line('| Ticker | Shares | Price | Day | 5D | 1M | Weight | Role | Health | Signal | Rationale |');
    out += line('|---|---:|---:|---:|---:|---:|---:|---|---|---|---|');
    for (const h of state.holdings) out += line('|' + [h.ticker, h.shares, h.livePrice ?? 'n/a', h.dayChangePct ?? 'n/a', h.perf5dPct ?? 'n/a', h.perf1mPct ?? 'n/a', h.portfolioWeightPct ?? 'n/a', h.role, h.health, h.signal, h.actionRationale].join('|') + '|');
  } else {
    out += line('| Ticker | Shares | Role | Health | Signal | Rationale |');
    out += line('|---|---:|---|---|---|---|');
    for (const h of state.holdings) out += line('|' + [h.ticker, h.shares, h.role, h.health, h.signal, h.actionRationale].join('|') + '|');
  }
  out += line();
  out += line('## 4. News and Article Monitoring');
  for (const n of state.newsMonitoring) out += line('- **M' + n.materiality + '** ' + n.item + ' - affected: ' + n.affected.join(', ') + '; source: ' + n.requiredSource + '; status: ' + n.status);
  out += line();
  out += line('## 5. Valuation and Expectation Analysis');
  out += line(state.valuationExpectation.method);
  out += line();
  out += line('**Required fields:** ' + state.valuationExpectation.requiredFields.join(', '));
  out += line();
  out += line('**Status:** ' + state.valuationExpectation.status);
  out += line();
  out += line('## 6. Rebalance Analysis');
  out += line('- **Pressure:** ' + state.rebalance.pressure);
  out += line('- **Rationale:** ' + state.rebalance.rationale);
  out += line('- **Trim watch:** ' + state.rebalance.trimWatch.join(', '));
  out += line('- **Add watch:** ' + state.rebalance.addWatch.join(', '));
  out += line();
  out += line('## 7. Action Signals');
  out += line('Allowed signals only: ' + allowedSignals.join(', '));
  out += line();
  for (const h of state.holdings) out += line('- **' + h.ticker + ': ' + h.signal + '** - ' + h.actionRationale);
  out += line();
  out += line('## 8. Opportunity Scout');
  out += line(state.opportunityScout.method);
  out += line();
  out += line('**Required screens:**');
  out += line(bullets(state.opportunityScout.requiredScreens));
  out += line();
  out += line('**Current candidates:**');
  for (const c of state.opportunityScout.candidates) out += line('- **' + c.ticker + ' - ' + c.signal + ':** ' + c.reason);
  out += line();
  out += line('## 9. Risk Officer Review');
  out += line('- **Highest-risk position:** ' + state.riskOfficer.highestRiskPosition);
  out += line('- **Weakest holding:** ' + state.riskOfficer.weakestHolding);
  out += line('- **Strongest holding:** ' + state.riskOfficer.strongestHolding);
  out += line();
  out += line('**Key risks:**');
  out += line(bullets(state.riskOfficer.keyRisks));
  out += line();
  out += line('**Human review required:**');
  out += line(bullets(state.riskOfficer.humanReviewRequired));
  out += line();
  if (state.liveMarket || state.liveRatesCredit) {
    out += line('## Evidence Appendix - Live Data Snapshot');
    if (state.liveMarket) {
      out += line('### Market tape');
      out += line('| Symbol | Price | Day % | 5D % | 1M % | 3M % | As of |');
      out += line('|---|---:|---:|---:|---:|---:|---|');
      for (const m of state.liveMarket) out += line('|' + [m.symbol, m.price ?? 'n/a', m.changePct ?? 'n/a', m.perf5dPct ?? 'n/a', m.perf1mPct ?? 'n/a', m.perf3mPct ?? 'n/a', m.asOf ?? 'n/a'].join('|') + '|');
      out += line();
    }
    if (state.liveRatesCredit) {
      out += line('### Rates / credit / liquidity');
      out += line('| Series | Name | Value | Latest date |');
      out += line('|---|---|---:|---|');
      for (const r of state.liveRatesCredit) out += line('|' + [r.id, r.name, r.value ?? 'n/a', r.latestDate ?? 'n/a'].join('|') + '|');
      out += line();
    }
    if (state.liveDataErrors?.length) {
      out += line('### Live data errors');
      for (const e of state.liveDataErrors) out += line('- ' + JSON.stringify(e));
      out += line();
    }
  }
  out += line('## 10. Final Output');
  out += line('- **Market Posture:** ' + state.finalOutput.marketPosture);
  out += line('- **Most Important Macro Signal:** ' + state.marketRegime.mostImportantMacroSignal);
  out += line('- **Most Important Holding Update:** ' + state.finalOutput.mostImportantHoldingUpdate);
  out += line('- **Strongest Current Holding:** ' + state.riskOfficer.strongestHolding);
  out += line('- **Weakest Current Holding:** ' + state.riskOfficer.weakestHolding);
  out += line('- **Highest-Risk Position:** ' + state.riskOfficer.highestRiskPosition);
  out += line('- **Top Add Watch:** ' + state.finalOutput.topAddWatch);
  out += line('- **Top Trim Watch:** ' + state.finalOutput.topTrimWatch);
  out += line('- **Top 3 New Research Candidates:** ' + state.finalOutput.top3NewResearchCandidates.join(', '));
  out += line('- **Rebalance Pressure:** ' + state.rebalance.pressure);
  out += line('- **Final Judgment:** ' + state.finalOutput.finalJudgment);
  out += line();
  out += line('---');
  out += line('Precedent basis: ' + state.meta.precedentBasis.join('; '));
  return out;
}
check();
const md = render();
const outPath = process.argv[3] || path.join(__dirname, 'outputs', state.meta.reportDate + '-capital-radar-sample.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md);
console.log(outPath);
