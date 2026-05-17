const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const strategyPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const exposurePath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const researchPath = path.join(root, 'outputs', 'research-candidate-map.json');
const notesDir = path.join(root, 'agent-notes', 'tickers');
const outPath = path.join(root, 'outputs', 'thesis-dossiers.json');
function safeJson(file, fallback, label) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn(`[thesis] using fallback for ${label || file}: ${error.message}`);
    return fallback;
  }
}
const state = safeJson(statePath, { holdings: [], opportunityScout: { candidates: [] } }, 'state');
const strategy = safeJson(strategyPath, { interpretations: [] }, 'strategy interpretations');
const exposure = safeJson(exposurePath, { buckets: [] }, 'portfolio exposure map');
const research = safeJson(researchPath, { allCandidates: [] }, 'research candidate map');
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const candidates = Array.isArray(research.allCandidates) ? research.allCandidates : [];
const strategyByTicker = new Map((Array.isArray(strategy.interpretations) ? strategy.interpretations : []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const list = value => Array.isArray(value) ? value : [];
function readNote(ticker) {
  const file = path.join(notesDir, `${String(ticker || '').toLowerCase()}.json`);
  return safeJson(file, null, `agent note ${ticker}`);
}
function textOf(x){ return `${x?.ticker || ''} ${x?.name || ''} ${x?.exposureBucket || ''} ${x?.role || ''} ${x?.thesis || ''} ${x?.actionRationale || ''} ${list(x?.confirmBeforeAdd).join(' ')} ${list(x?.keyRisks).join(' ')}`; }
function inferBusinessModel(x){
  const t = textOf(x);
  if (/ETF|index|SPY|QQQ|IWM|VTI|VOO|basket/i.test(t)) return 'Portfolio vehicle / index exposure rather than operating business.';
  if (/levered|daily reset|2x|3x|TSLT|CONL|TMF|SOXL|TQQQ/i.test(t)) return 'Levered tactical product; returns depend on underlying direction, volatility path, and decay.';
  if (/bitcoin|crypto|IBIT|BITO|ethereum|ETHE/i.test(t)) return 'Crypto-linked exposure; value is driven by liquidity, adoption narrative, flows, and risk appetite.';
  if (/cloud|software|AI|platform|MSFT|META|GOOGL/i.test(t)) return 'Large-scale platform business with AI, cloud, advertising, software, or network effects as major value drivers.';
  if (/retail|commerce|logistics|AMZN/i.test(t)) return 'Scale commerce and cloud platform; margin mix, cloud growth, and logistics efficiency drive value.';
  if (/power|utility|grid|energy|nuclear|CEG|GEV/i.test(t)) return 'Power/infrastructure exposure; demand is linked to electrification, data centers, grid investment, and policy.';
  if (/semiconductor|chip|NVDA|AVGO/i.test(t)) return 'Semiconductor/platform hardware exposure; demand cycle depends on AI compute, networking, and capex intensity.';
  if (/payment|MA|V|fintech/i.test(t)) return 'High-margin transaction network; volume growth, cross-border spend, and regulation drive value.';
  return 'Operating-business exposure; business model requires explicit analyst review.';
}
function inferMacroLinkage(x, interp){
  const t = textOf(x);
  const links = [];
  if (/AI|cloud|semiconductor|data center|power|grid|infrastructure/i.test(t)) links.push('AI capex / infrastructure buildout');
  if (/rate|duration|treasury|TMF|bond|credit/i.test(t)) links.push('rates / duration regime');
  if (/crypto|bitcoin|IBIT|CONL|COIN/i.test(t)) links.push('liquidity / crypto risk appetite');
  if (/consumer|retail|AMZN|payment|MA/i.test(t)) links.push('consumer spending / nominal growth');
  if (/utility|power|energy|nuclear/i.test(t)) links.push('power demand / energy policy / grid bottlenecks');
  if (interp?.portfolioConflict?.status && interp.portfolioConflict.status !== 'No major conflict') links.push(interp.portfolioConflict.status);
  return links.length ? [...new Set(links)] : ['Macro linkage not sufficiently mapped; requires research.'];
}
function inferPortfolioRole(x, interp){ return interp?.role || x?.role || x?.exposureBucket || 'Portfolio role requires classification.'; }
function valuationQuestion(x, interp){
  if (interp?.exposureType === 'levered') return 'Valuation multiples are not the decision basis; analyze decay, volatility path, liquidity, and underlying exposure.';
  if (interp?.exposureType === 'crypto') return 'Traditional valuation is limited; analyze liquidity cycle, flows, adoption narrative, and drawdown risk.';
  if (interp?.exposureType === 'index') return 'Analyze broad market valuation, earnings breadth, liquidity, and concentration risk rather than single-company multiples.';
  const fpe = x?.dataContract?.forwardPE ?? x?.forwardPE;
  const fcf = x?.dataContract?.fcfYield ?? x?.fcfYield;
  if (n(fpe) || n(fcf)) return `Is current valuation justified by growth and cash-flow durability? Forward PE: ${fpe ?? 'missing'}; FCF yield: ${fcf ?? 'missing'}.`;
  return 'Forward valuation data is missing; do not upgrade confidence until source-backed valuation is available.';
}
function technicalQuestion(x, interp){
  const b = interp?.nearestDecisionBoundary;
  if (b && Number.isFinite(b.distancePct)) return `Is the ${b.label} near ${Number(b.value).toFixed(2)} structurally meaningful, or only mechanically close to current price?`;
  return 'No mapped technical boundary; derive support/resistance from price history before action.';
}
function whyNow(x, interp, candidate){
  const items = [];
  if (candidate?.nearTermScore >= 45) items.push(`Near-term setup score ${candidate.nearTermScore}; candidate is being watched for tactical/explosive potential.`);
  if (candidate?.longTermScore >= 45) items.push(`Long-term macro-fit score ${candidate.longTermScore}; candidate may help portfolio balance.`);
  for (const item of list(interp?.newInformation)) items.push(item);
  if (!items.length && x?.actionRationale) items.push(x.actionRationale);
  return items.length ? items.slice(0,4) : ['No urgent new information detected; monitor until a real catalyst, data change, or price boundary emerges.'];
}
function buildCases(x, interp, note){
  const thesis = note?.agentThesis || {};
  const bull = thesis.bullCase || x?.thesis || 'Bull case requires explicit source-backed thesis.';
  const bear = thesis.bearCase || thesis.invalidation || x?.watch || 'Bear case requires explicit invalidation logic.';
  const base = thesis.baseCase || x?.actionRationale || x?.thesis || 'Base case requires analyst-authored thesis.';
  return { base, bull, bear };
}
function checklist(x, interp, candidate){
  const items = [];
  for (const item of list(candidate?.confirmBeforeAdd || x?.confirmBeforeAdd)) items.push(item);
  if (interp?.dataConfidence?.tone !== 'positive') items.push(`Resolve data confidence issue: ${interp?.dataConfidence?.reason || 'missing fields.'}`);
  if (interp?.positionPressure?.tone !== 'positive') items.push(`Risk-budget gate: ${interp?.positionPressure?.reason || 'position pressure.'}`);
  if (interp?.portfolioConflict?.tone !== 'positive') items.push(`Portfolio conflict gate: ${interp?.portfolioConflict?.reason || interp?.portfolioConflict?.status || 'conflict.'}`);
  if (!items.length) items.push('Confirm thesis, valuation, technical structure, and macro regime alignment before adding.');
  return [...new Set(items)].slice(0,6);
}
function risks(x, interp, candidate){
  const items = [];
  for (const item of list(candidate?.keyRisks || x?.keyRisks)) items.push(item);
  if (x?.watch) items.push(x.watch);
  if (interp?.exposureType === 'levered') items.push('Levered decay and volatility-path risk can overwhelm directional thesis.');
  if (interp?.portfolioConflict?.tone !== 'positive' && interp?.portfolioConflict?.reason) items.push(interp.portfolioConflict.reason);
  if (!items.length) items.push('Risk list is thin; requires source-backed research before confidence upgrade.');
  return [...new Set(items)].slice(0,6);
}
function confidence(x, interp, dossier){
  let score = 40;
  if ((x?.thesis || '').length > 120 || (dossier.cases?.base || '').length > 120) score += 15;
  if (interp?.dataConfidence?.tone === 'positive') score += 15; else if (interp?.dataConfidence?.tone === 'caution') score += 6;
  if (interp?.decisionConfidence?.level === 'High') score += 15; else if (interp?.decisionConfidence?.level === 'Medium') score += 8;
  if (list(dossier.confirmBeforeAdd).length >= 3) score += 8;
  if (list(dossier.keyRisks).length >= 3) score += 7;
  score = Math.max(0, Math.min(100, score));
  return { score, level: score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low', reason: score >= 80 ? 'Thesis, data, risks, and gates are sufficiently structured for operating review.' : score >= 60 ? 'Usable structure exists, but several fields need deeper source-backed research.' : 'Dossier is too thin for capital action.' };
}
function dossierFor(x, type){
  const ticker = String(x?.ticker || 'UNKNOWN').toUpperCase();
  const interp = strategyByTicker.get(ticker) || {};
  const candidate = candidates.find(c => String(c?.ticker || '').toUpperCase() === ticker);
  const note = readNote(ticker);
  const cases = buildCases(x, interp, note);
  const dossier = {
    ticker,
    type,
    name: x?.name || ticker,
    signal: interp.signal || x?.computedSignal || x?.signal || 'Review',
    role: inferPortfolioRole(x, interp),
    businessModel: inferBusinessModel(x),
    whyItMattersNow: whyNow(x, interp, candidate),
    macroLinkage: inferMacroLinkage(x, interp),
    portfolioFit: candidate?.portfolioFit || interp?.portfolioConflict?.reason || 'Portfolio fit requires explicit review.',
    cases,
    valuationQuestion: valuationQuestion(x, interp),
    technicalQuestion: technicalQuestion(x, interp),
    confirmBeforeAdd: checklist(x, interp, candidate),
    trimCondition: list(interp.signalChangeConditions).find(v => /trim|rebalance/i.test(String(v))) || 'Trim if valuation, technical structure, or risk budget becomes unfavorable.',
    exitCondition: list(interp.signalChangeConditions).find(v => /exit|break|invalidation/i.test(String(v))) || note?.agentThesis?.invalidation || x?.watch || 'Exit condition requires explicit invalidation rule.',
    keyRisks: risks(x, interp, candidate),
    dataGaps: list(interp?.dataConfidence?.missing),
    sourceConfidence: interp?.dataConfidence?.status || 'Unknown',
    actionPermission: interp?.actionPermission?.status || 'Review',
    urgency: interp?.urgency?.level || 'Monitor',
    lastReviewed: new Date().toISOString()
  };
  dossier.dossierConfidence = confidence(x, interp, dossier);
  return dossier;
}
const holdingDossiers = holdings.map(h => dossierFor(h, 'holding')).filter(d => d.ticker !== 'UNKNOWN');
const candidateDossiers = candidates.filter(c => !holdings.some(h => String(h?.ticker || '').toUpperCase() === String(c?.ticker || '').toUpperCase())).map(c => dossierFor(c, 'candidate')).filter(d => d.ticker !== 'UNKNOWN');
const result = { generatedAt: new Date().toISOString(), purpose: 'Source object for deeper thesis analysis across holdings and research candidates.', priority: 'Analytical depth, strategic usefulness, data integrity.', warnings: holdings.length ? [] : ['No holdings found in state input.'], holdings: holdingDossiers, candidates: candidateDossiers, all: [...holdingDossiers, ...candidateDossiers] };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated thesis dossiers: ${holdingDossiers.length} holdings / ${candidateDossiers.length} candidates`);
