const rules = {
  SPY: { posture:'Core anchor', holdUntil:'Hold while it remains the portfolio baseline.', addWhen:'Add on broad-market pullback, not euphoric strength.', trimWhen:'Trim if SPY/megacap overlap crowds out better opportunities.', exitWhen:'Full exit only if whole portfolio strategy changes.', invalidation:'Strategic invalidation only.', review:'Weekly / macro stress.' },
  AMZN: { posture:'Core compounder', holdUntil:'Hold while AWS/AI/cloud growth and retail leverage remain intact.', addWhen:'Add on valuation reset with stable AWS/revenue revisions.', trimWhen:'Trim if AWS slows or weight outruns target.', exitWhen:'Exit review if AWS competitive position or margin recovery breaks.', invalidation:'AWS + retail leverage no longer supports premium valuation.', review:'Earnings / AWS / capex.' },
  BMNR: { posture:'Speculative verification', holdUntil:'Hold only while thesis/liquidity/downside are being verified.', addWhen:'No add until thesis, liquidity, catalyst, downside are documented.', trimWhen:'Trim on strength or if uncertainty remains high.', exitWhen:'Exit review if thesis cannot be verified or price breaks on poor liquidity.', invalidation:'Cannot explain why this beats SPY risk-adjusted.', review:'Priority research.' },
  META: { posture:'Core compounder', holdUntil:'Hold while ads, engagement, margins, and AI distribution remain intact.', addWhen:'Add on pullback if ad growth and margins remain strong.', trimWhen:'Trim if capex rises without revenue evidence or weight exceeds target.', exitWhen:'Exit review if ads/engagement thesis breaks.', invalidation:'AI/capex spend stops translating into platform strength.', review:'Earnings / capex / regulation.' },
  NFLX: { posture:'Hold/watch compounder', holdUntil:'Hold while subscriber/ads/margin story supports valuation.', addWhen:'Add after pullback or stronger ad-tier/pricing evidence.', trimWhen:'Trim if valuation expands faster than earnings.', exitWhen:'Exit review if growth narrative breaks for multiple quarters.', invalidation:'Ad-tier/pricing no longer offsets content/competition risk.', review:'Earnings / subs / ads.' },
  MA: { posture:'Quality compounder / diversifier', holdUntil:'Hold while payment volume and cross-border spend remain durable.', addWhen:'Add on quality-stock pullback without accelerating consumer stress.', trimWhen:'Trim if regulation/consumer stress weakens risk-reward.', exitWhen:'Exit review if network moat or volume growth deteriorates.', invalidation:'Network durability no longer supports premium valuation.', review:'Earnings / consumer data / regulation.' },
  MSFT: { posture:'Core AI/cloud compounder', holdUntil:'Hold while Azure/cloud and enterprise AI adoption remain intact.', addWhen:'Add on pullback if Azure growth and AI monetization stay strong.', trimWhen:'Trim if AI capex outruns monetization or valuation stretches.', exitWhen:'Exit review if cloud growth decelerates materially.', invalidation:'Enterprise cloud + AI advantage stops compounding.', review:'Earnings / Azure / AI / antitrust.' },
  CEG: { posture:'AI power infrastructure watch', holdUntil:'Hold while power-demand/data-center thesis remains intact.', addWhen:'Add after expectation reset or confirmed earnings/guidance upside.', trimWhen:'Trim if AI-power narrative gets crowded or valuation outruns fundamentals.', exitWhen:'Exit review if earnings/guidance contradicts AI-power thesis.', invalidation:'Power-demand upside fails to translate into cash-flow.', review:'Earnings / power pricing / contracts.' },
  TSNF: { posture:'Speculative verification', holdUntil:'Hold only while thesis/liquidity are being verified.', addWhen:'No add until liquidity, issuer, catalyst, downside are documented.', trimWhen:'Trim on strength or if liquidity remains thin.', exitWhen:'Exit review if thesis cannot be verified or liquidity is inadequate.', invalidation:'Cannot verify what you own and why it should outperform.', review:'Priority research.' },
  CONL: { posture:'Tactical leveraged swing only', holdUntil:'Hold only while range thesis and COIN/BTC risk tone support bounce.', addWhen:'Add-watch near lower range only with crypto confirmation.', trimWhen:'Scale down into upper range unless breakout is confirmed.', exitWhen:'Exit/reduce below invalidation; never average down below invalidation.', invalidation:'Lower support breaks with COIN/BTC weakness.', review:'Daily while held; time stop 2–5 trading days.' },
  DOGE: { posture:'Speculative crypto risk bucket', holdUntil:'Hold only while crypto risk appetite remains supportive.', addWhen:'Add only after BTC/crypto breadth confirms strength.', trimWhen:'Trim into sharp meme/liquidity rallies.', exitWhen:'Exit/reduce if DOGE breaks with BTC weakness or no catalyst.', invalidation:'Meme/liquidity thesis fails.', review:'Crypto risk-on moves; weekly otherwise.' },
  'VOYG-35C-2027': { posture:'Long-dated call option / convex speculation', holdUntil:'Hold only while VOYG thesis/catalyst justify option risk before 1/15/2027.', addWhen:'No add until underlying thesis, bid/ask, IV, and catalyst timing are verified.', trimWhen:'Trim if option spikes or IV/liquidity risk worsens.', exitWhen:'Exit/reduce if thesis fails, catalyst timing slips, or max-loss tolerance is hit.', invalidation:'No clear catalyst plus time decay/IV risk.', review:'Weekly and after VOYG news.' },
  TSLT: { posture:'Tactical leveraged TSLA product', holdUntil:'Hold only with explicit short-term TSLA thesis.', addWhen:'Add only if TSLA catalyst/support confirms and risk bucket stays small.', trimWhen:'Trim into sharp TSLA/TSLT rallies.', exitWhen:'Exit/reduce if TSLA thesis fails or product decay dominates.', invalidation:'No TSLA catalyst plus daily leverage decay.', review:'Daily while held.' }
};
const overrides = {
  CONL: { entryLow:8.20, entryHigh:8.60, addBelow:8.20, trimLow:9.40, trimHigh:10.00, stop:7.80, hardExit:7.70, target:10.00, horizon:'2–5 trading days' },
  DOGE: { entryLow:0.105, entryHigh:0.115, addBelow:0.105, trimLow:0.135, trimHigh:0.155, stop:0.098, hardExit:0.092, target:0.15, horizon:'tactical crypto cycle' },
  TSLT: { entryLow:20.50, entryHigh:22.00, addBelow:20.50, trimLow:26.00, trimHigh:28.50, stop:19.00, hardExit:18.25, target:28.00, horizon:'days, not weeks' },
  'VOYG-35C-2027': { entryLow:850, entryHigh:980, addBelow:850, trimLow:1350, trimHigh:1600, stop:700, hardExit:600, target:1500, horizon:'event-driven before theta accelerates' }
};
const profiles = {
  core: { entry:[-.08,-.04], add:-.10, trim:[.12,.20], stop:-.14, hard:-.18, target:.18, horizon:'weeks to quarters' },
  watch: { entry:[-.10,-.06], add:-.13, trim:[.10,.16], stop:-.12, hard:-.16, target:.15, horizon:'weeks' },
  spec: { entry:[-.12,-.07], add:null, trim:[.08,.15], stop:-.10, hard:-.15, target:.14, horizon:'days to weeks' }
};
function profileFor(ticker){
  ticker=String(ticker||'').toUpperCase();
  if (['BMNR','TSNF'].includes(ticker)) return 'spec';
  if (['CEG','NFLX'].includes(ticker)) return 'watch';
  return 'core';
}
function roundPrice(x){
  if (!isFinite(x)) return null;
  if (x < 1) return +x.toFixed(4);
  if (x < 20) return +x.toFixed(2);
  if (x < 100) return +x.toFixed(2);
  return +x.toFixed(0);
}
function numericLevels(ticker, price, tech={}){
  ticker=String(ticker||'').toUpperCase(); price=Number(price||0);
  if (overrides[ticker]) return {...overrides[ticker], current:roundPrice(price), basis:'fixed tactical levels'};
  const p = profiles[profileFor(ticker)];
  const atr = Number(tech?.atr || 0);
  const smaPrice = pct => Number.isFinite(Number(pct)) ? price / (1 + Number(pct)/100) : null;
  const s20 = smaPrice(tech?.sma20), s50 = smaPrice(tech?.sma50), s200 = smaPrice(tech?.sma200);
  const support = [s20,s50].filter(Number.isFinite).sort((a,b)=>a-b)[0];
  const targetPrice = Number(tech?.targetPrice || 0);
  if (atr > 0 && support) {
    const entryHigh = Math.min(price - atr*0.35, support + atr*0.3);
    const entryLow = entryHigh - atr*1.0;
    return {
      current: roundPrice(price),
      entryLow: roundPrice(entryLow),
      entryHigh: roundPrice(entryHigh),
      addBelow: profileFor(ticker)==='spec' ? null : roundPrice(entryLow),
      trimLow: roundPrice(price + atr*1.5),
      trimHigh: roundPrice(targetPrice && targetPrice < price + atr*4 ? targetPrice : price + atr*3),
      stop: roundPrice(Math.min(s50 || price-atr*2, price-atr*2)),
      hardExit: roundPrice(s200 ? Math.min(s200, price-atr*3) : price-atr*3),
      target: roundPrice(targetPrice || price + atr*3),
      horizon: p.horizon,
      basis: 'Finviz ATR + moving-average band'
    };
  }
  return {
    current: roundPrice(price), entryLow: roundPrice(price*(1+p.entry[0])), entryHigh: roundPrice(price*(1+p.entry[1])), addBelow: p.add == null ? null : roundPrice(price*(1+p.add)), trimLow: roundPrice(price*(1+p.trim[0])), trimHigh: roundPrice(price*(1+p.trim[1])), stop: roundPrice(price*(1+p.stop)), hardExit: roundPrice(price*(1+p.hard)), target: roundPrice(price*(1+p.target)), horizon: p.horizon, basis: `${profileFor(ticker)} dynamic band from current price`
  };
}
function strategyFor(ticker) {
  return rules[String(ticker || '').toUpperCase()] || { posture:'Needs strategy', holdUntil:'Define thesis first.', addWhen:'Do not add until thesis is documented.', trimWhen:'Trim if risk exceeds conviction.', exitWhen:'Exit review if thesis cannot be verified.', invalidation:'Unknown.', review:'Review manually.' };
}
module.exports = { rules, strategyFor, numericLevels };
