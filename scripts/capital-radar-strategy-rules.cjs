const rules = {
  SPY: {
    posture: 'Core anchor',
    holdUntil: 'Hold while it remains the portfolio baseline and you do not need cash for higher-conviction opportunities.',
    addWhen: 'Add only on broad-market pullback or planned cash deployment, not after a euphoric run; prefer when index weakness is not paired with credit/liquidity stress.',
    trimWhen: 'Trim if SPY plus megacap overlap keeps total broad/tech beta above your intended risk budget, or if cash is needed for higher-conviction asymmetric setups.',
    exitWhen: 'Do not fully exit unless your whole portfolio strategy changes or there is a severe macro/liquidity breakdown that requires a defensive reset.',
    invalidation: 'Invalidation is strategic, not ticker-specific: index thesis fails only if you decide the portfolio should no longer use broad U.S. equity beta as its base.',
    review: 'Review weekly; immediately if VIX/credit spreads spike or SPY weight materially exceeds target.'
  },
  AMZN: {
    posture: 'Core compounder',
    holdUntil: 'Hold while AWS/AI/cloud growth and retail operating leverage remain intact, and valuation does not detach from earnings/cash-flow progress.',
    addWhen: 'Add on valuation reset or pullback when AWS/revenue revisions remain stable-to-positive; avoid adding only because price is green.',
    trimWhen: 'Trim if AMZN weight rises too far above target, AWS momentum weakens, capex/free-cash-flow concerns worsen, or better risk/reward appears elsewhere.',
    exitWhen: 'Exit review if AWS loses competitive position, margin recovery reverses, or management guidance materially breaks the core thesis.',
    invalidation: 'Thesis invalidation: AWS + retail leverage no longer support premium valuation.',
    review: 'Review after earnings, guidance, AWS growth updates, and major capex commentary.'
  },
  BMNR: {
    posture: 'Speculative verification',
    holdUntil: 'Hold only as a monitored speculative position while thesis, liquidity, filings, and downside case are being verified.',
    addWhen: 'Do not add until the thesis is documented, liquidity is acceptable, catalyst path is clear, and downside scenario is survivable.',
    trimWhen: 'Trim if information quality remains poor, liquidity weakens, position weight stays large relative to conviction, or price strength gives a chance to reduce risk.',
    exitWhen: 'Exit review if thesis cannot be verified, filings/news reveal material weakness, or price breaks support on bad liquidity.',
    invalidation: 'Invalidation: cannot explain why this should beat SPY on a risk-adjusted basis.',
    review: 'Priority research item: verify issuer, business model, filings, liquidity, float, catalysts, and downside.'
  },
  META: {
    posture: 'Core compounder',
    holdUntil: 'Hold while ad momentum, engagement, margins, and AI distribution advantage remain intact.',
    addWhen: 'Add on pullback or valuation reset if ad growth and margin discipline remain strong; avoid adding into AI-capex euphoria.',
    trimWhen: 'Trim if AI/metaverse capex rises without revenue evidence, regulation risk becomes material, or weight exceeds target.',
    exitWhen: 'Exit review if ads/engagement thesis breaks or management returns to undisciplined spending.',
    invalidation: 'Thesis invalidation: AI/capex spend stops translating into platform strength or margins.',
    review: 'Review after earnings, capex commentary, ad growth, and regulatory developments.'
  },
  NFLX: {
    posture: 'Hold/watch compounder',
    holdUntil: 'Hold while subscriber/ads/margin story remains intact and valuation is supported by growth.',
    addWhen: 'Add only after pullback or evidence that ad-tier and pricing power are improving faster than expectations.',
    trimWhen: 'Trim if valuation expands faster than earnings, subscriber growth slows, or competition/content costs pressure margins.',
    exitWhen: 'Exit review if growth narrative breaks for multiple quarters or price strength becomes unsupported by fundamentals.',
    invalidation: 'Thesis invalidation: paid sharing/ad-tier/pricing story no longer offsets content and competition risk.',
    review: 'Review after earnings, subscriber data, ad-tier updates, and margin guidance.'
  },
  MA: {
    posture: 'Quality compounder / diversifier',
    holdUntil: 'Hold while payment volume, cross-border travel/spend, and margins remain durable.',
    addWhen: 'Add on broad quality-stock pullback when consumer/credit stress is not accelerating.',
    trimWhen: 'Trim if consumer stress, regulation, or valuation makes risk/reward weaker than SPY or other quality names.',
    exitWhen: 'Exit review if network moat or payment-volume growth materially deteriorates.',
    invalidation: 'Thesis invalidation: payment network durability no longer supports premium valuation.',
    review: 'Review after earnings, consumer credit/spend data, and regulatory headlines.'
  },
  MSFT: {
    posture: 'Core AI/cloud compounder',
    holdUntil: 'Hold while Azure/cloud growth, enterprise AI adoption, and operating margin remain intact.',
    addWhen: 'Add on pullback if Azure growth and AI monetization stay strong; avoid adding only into headline enthusiasm.',
    trimWhen: 'Trim if AI capex outruns monetization, antitrust/regulatory risk escalates, or valuation becomes stretched versus growth.',
    exitWhen: 'Exit review if cloud growth materially decelerates or AI strategy becomes a margin drag without adoption evidence.',
    invalidation: 'Thesis invalidation: enterprise cloud + AI advantage stops compounding.',
    review: 'Review after earnings, Azure growth, OpenAI/AI partnership updates, and antitrust developments.'
  },
  CEG: {
    posture: 'AI power infrastructure watch',
    holdUntil: 'Hold while power-demand/data-center thesis remains intact, but do not treat it as a risk-free utility.',
    addWhen: 'Add only after pullback/expectation reset or when earnings/guidance confirms durable power-demand upside.',
    trimWhen: 'Trim if AI-power narrative becomes crowded, valuation outruns fundamentals, or regulatory/contract risk rises.',
    exitWhen: 'Exit review if positive news fails repeatedly or earnings/guidance contradicts the AI-power thesis.',
    invalidation: 'Thesis invalidation: data-center/power-demand upside fails to translate into durable earnings/cash-flow.',
    review: 'Review after earnings, power pricing, regulatory updates, and data-center contract news.'
  },
  TSNF: {
    posture: 'Speculative verification',
    holdUntil: 'Hold only while thesis/liquidity are being verified; do not add without clear evidence.',
    addWhen: 'Do not add until liquidity, issuer/business model, catalyst path, and downside are documented.',
    trimWhen: 'Trim if volume/liquidity remains thin or if price strength offers a chance to reduce unknown-risk exposure.',
    exitWhen: 'Exit review if thesis cannot be verified, liquidity is inadequate, or price breaks on weak volume/news.',
    invalidation: 'Invalidation: cannot verify what you own and why it should outperform.',
    review: 'Priority research item: confirm ticker identity, liquidity, filings, issuer quality, and catalyst.'
  },
  CONL: {
    posture: 'Tactical leveraged swing only',
    holdUntil: 'Hold only while the 8–10 range thesis remains intact and COIN/BTC risk tone supports a bounce.',
    addWhen: 'Consider add-watch near 8.20–8.60 only if COIN is not breaking down, BTC/crypto risk tone is stable/improving, and broader market is not risk-off.',
    trimWhen: 'Scale down into 9.40–9.70, and review taking more off near 10.00 unless COIN/BTC confirms a real breakout.',
    exitWhen: 'Exit/reduce if CONL closes below 8.00 with weak COIN/BTC, or hard review below 7.70–7.80. Do not average down below invalidation without a new written thesis.',
    invalidation: 'Range thesis invalidates if CONL loses lower support while COIN/BTC confirm weakness; 2x daily leverage makes waiting expensive.',
    review: 'Review daily while held; time stop after 2–5 trading days if the bounce does not arrive.'
  },
  DOGE: {
    posture: 'Speculative crypto risk bucket',
    holdUntil: 'Hold only while crypto risk appetite is supportive and the position remains a small, explicitly speculative bucket.',
    addWhen: 'Add only after BTC/crypto breadth confirms strength and DOGE is not merely spiking on meme momentum; never add if it would crowd out core holdings.',
    trimWhen: 'Trim into sharp meme/liquidity rallies, if position weight grows beyond comfort, or if BTC/crypto market structure weakens.',
    exitWhen: 'Exit/reduce if DOGE breaks down with BTC weakness, if liquidity/risk appetite fades, or if you cannot state the near-term catalyst.',
    invalidation: 'Invalidation: meme/liquidity thesis fails and DOGE becomes dead capital with high drawdown risk.',
    review: 'Review during crypto/risk-on moves; otherwise weekly as a speculative bucket.'
  },
  'VOYG-35C-2027': {
    posture: 'Long-dated call option / convex speculation',
    holdUntil: 'Hold only while the VOYG thesis and catalyst path justify option risk before 1/15/2027 expiration.',
    addWhen: 'Do not add until underlying VOYG thesis, liquidity/spread, IV, and catalyst timing are verified; option adds need stricter evidence than shares.',
    trimWhen: 'Trim if the option spikes sharply, spread/liquidity worsens, implied volatility inflates without fundamental confirmation, or position value grows too large for a speculative bucket.',
    exitWhen: 'Exit/reduce if underlying thesis fails, catalyst timing slips too close to expiration, option liquidity is poor, or loss reaches the pre-set max-risk tolerance.',
    invalidation: 'Invalidation: no clear underlying catalyst plus time decay/IV risk makes the option an uncontrolled lottery ticket.',
    review: 'Review weekly and after any VOYG news; track underlying price, option bid/ask, IV, and days-to-expiration.'
  },
  TSLT: {
    posture: 'Tactical leveraged TSLA product',
    holdUntil: 'Hold only with explicit short-term TSLA thesis; not a passive investment holding.',
    addWhen: 'Add only if TSLA has confirmed catalyst/technical support and position remains inside a small tactical risk bucket.',
    trimWhen: 'Trim into sharp TSLA/TSLT rallies or if portfolio risk budget tightens.',
    exitWhen: 'Exit/reduce if TSLA thesis fails, product decay dominates, or holding period drifts beyond the tactical window.',
    invalidation: 'Invalidation: no clear TSLA catalyst plus daily leverage decay/path-dependency.',
    review: 'Review daily while held; avoid multi-week drift without active thesis.'
  }
};

function strategyFor(ticker) {
  return rules[String(ticker || '').toUpperCase()] || {
    posture: 'Needs strategy', holdUntil: 'Define thesis first.', addWhen: 'Do not add until thesis is documented.', trimWhen: 'Trim if risk exceeds conviction.', exitWhen: 'Exit review if thesis cannot be verified.', invalidation: 'Unknown.', review: 'Review manually.'
  };
}
module.exports = { rules, strategyFor };
