const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const now = new Date().toISOString();
const packets = read('outputs/opportunity-evidence-packets.json') || { priorityQueue: [], packets: [] };
const goggles = read('data/research/finance-goggles.json') || { goggles: [] };
const goggleIds = list(goggles.goggles).map(g => g.goggleId);
function selectGoggles(p) {
  const t = `${p.ticker} ${p.name} ${p.whyInteresting} ${p.portfolioRole}`.toLowerCase();
  const out = ['stock_research_default'];
  if (/dilution|small|speculative|optional|rocket|hims|oklo|smr|rklb|asts/.test(t)) out.push('small_cap_squeeze_optional', 'dilution_risk');
  if (/bitcoin|crypto|ibit|coin|conl|btc/.test(t)) out.push('bitcoin_treasury_company');
  if (/ai|data center|power|grid|nuclear|uranium|vertiv|eaton|quanta|nextracker|vernova|nvidia|broadcom/.test(t)) out.push('ai_infrastructure');
  out.push('macro_liquidity');
  return [...new Set(out)].filter(x => goggleIds.includes(x));
}
function md(p) {
  return `# ${p.ticker} Opportunity Dossier\n\nGenerated: ${now}\nRun mode: LOCAL_OPPORTUNITY_DOSSIER_NO_WEB_SEARCH\nAction permission: ${p.actionPermission}\n\n## Current Setup\n\n- Name: ${p.name}\n- Lane: ${p.lane}\n- Stage: ${p.opportunityStage}\n- Opportunity score: ${p.opportunityScore}\n- Portfolio role: ${p.portfolioRole}\n- Current price: ${p.priceFrame?.currentPrice ?? 'n/a'}\n- Price read: ${p.priceFrame?.priceRead ?? 'n/a'}\n\n## Why Interesting\n\n${p.whyInteresting || 'No thesis loaded.'}\n\n## Why Now\n\n${list(p.whyNow).map(x => `- ${x}`).join('\n') || '- No native event driver loaded.'}\n\n## Evidence Refs\n\n${list(p.evidenceRefs).map(e => `- ${e.sourceId}: ${e.use} (${e.reliabilityClass || 'unrated'}${e.status ? `; ${e.status}` : ''})`).join('\n')}\n\n## Confirm Before Promotion\n\n${list(p.confirmBeforePromotion).map(x => `- ${x}`).join('\n')}\n\n## Invalidation / Risk Questions\n\n${list(p.invalidationQuestions).map(x => `- ${x}`).join('\n')}\n\n## Missing For Promotion\n\n${list(p.missingForPromotion).map(x => `- ${x}`).join('\n')}\n\n## Finance Goggles To Apply\n\n${selectGoggles(p).map(x => `- ${x}`).join('\n')}\n\n## Action Framework\n\nObservation:\n${list(p.whyNow)[0] || 'Candidate exists in Opportunity Scout, but primary evidence is not attached yet.'}\n\nInterpretation:\nResearch-only lead. Treat as an investable question, not a buy signal.\n\nAction:\nBuild primary-source evidence packet before any position decision.\n\nSize:\nNo size authorized. Define max loss/risk budget only after evidence pass.\n\nTrigger:\nRequires primary evidence + price zone + confirmation/reclaim/support rule.\n\nInvalidation:\nAny primary-source contradiction, financing/dilution issue, broken thesis, or failed technical reclaim blocks promotion.\n\nNext Review:\nRun targeted ticker research/update dossier; attach SEC/IR/company evidence.\n\n## Boundary\n\nLocal/public/internal evidence only. No web_search, no fresh news causality claim.\n`;
}
const priority = list(packets.priorityQueue).slice(0, 8);
const summaries = [];
for (const p of priority) {
  const dir = path.join(root, 'tickers', p.ticker);
  fs.mkdirSync(dir, { recursive: true });
  const dossier = {
    generatedAt: now,
    ticker: p.ticker,
    name: p.name,
    lane: p.lane,
    opportunityStage: p.opportunityStage,
    opportunityScore: p.opportunityScore,
    actionPermission: p.actionPermission,
    financeGoggles: selectGoggles(p),
    packetRef: p.packetId,
    nextRequired: p.missingForPromotion,
    sourceBoundary: p.sourceBoundary
  };
  fs.writeFileSync(path.join(dir, 'opportunity-dossier.json'), JSON.stringify(dossier, null, 2));
  fs.writeFileSync(path.join(dir, 'opportunity-dossier.md'), md(p));
  summaries.push({ ticker: p.ticker, stage: p.opportunityStage, score: p.opportunityScore, goggles: dossier.financeGoggles, path: `tickers/${p.ticker}/opportunity-dossier.md` });
}
const out = { generatedAt: now, status: summaries.length ? 'ACTIVE' : 'EMPTY', dossiers: summaries, policy: 'Persistent dossiers are research memory only. No buy permission.' };
for (const rel of ['outputs/opportunity-dossier-index.json', 'public/outputs/opportunity-dossier-index.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(out, null, 2));
}
console.log(JSON.stringify({ wrote: 'outputs/opportunity-dossier-index.json', dossiers: summaries.length, top: summaries.slice(0,5).map(x=>x.ticker) }, null, 2));
