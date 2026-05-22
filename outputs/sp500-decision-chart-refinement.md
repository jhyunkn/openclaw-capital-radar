# S&P 500 Direction Radar ΓÇö Capital Radar Refinement

Generated: 2026-05-22

## Correction

The intended ΓÇ£decision chartΓÇ¥ is not the internal operation graph. It is a market-direction chartbook/annotation surface that helps decide portfolio posture.

The useful model is closer to a JUTOPIA-style chart analyst workflow: read S&P 500 / Nasdaq / VIX / Fear & Greed / breadth / rates / credit together, annotate inflection zones, then translate the market read into asset-balance posture.

## What I Extracted from JUTOPIA

From the channel structure and sampled transcripts:

1. Start with one market question: uptrend, correction, chop, or risk-off?
2. Compare price structure with psychology and volatility; do not read price alone.
3. Treat Fear & Greed as a regime/sentiment overlay:
   - 50 is a useful neutral/positive threshold.
   - 75+ can indicate strong bull phases, but failure to reach/hold greed extremes can warn of weaker/choppy markets.
4. Use VIX as a stress/reversal map:
   - 25ΓÇô30 often marks fear/reversal zones.
   - Rising VIX trend warns that equity rallies may be fragile.
5. Use put/call extremes contrarianly, especially near one-year extremes.
6. Watch 20D/50D retests after sharp rallies:
   - 20D hold = constructive continuation.
   - 50D loss = map changes from risk-on to defensive watch.
7. Translate into allocation posture, not trade certainty: hold, trim beta, wait for pullback, add only through disciplined zones.

## Capital Radar Adaptation

The refined artifact is now:

- `outputs/sp500-market-decision-map.json`
- `outputs/sp500-direction-radar.html`
- public copies under `public/outputs/`

It now includes:

- market direction likelihoods
- channel read
- next inflection
- confirmation / invalidation language
- JUTOPIA-derived method pattern
- asset-balance guidance
- visual blueprint for the future rendered chart

## Current Generated Read

Current output:

- Decision: `RISK_ON_BUT_DO_NOT_CHASE`
- Regime: `RISK_ON_TREND`
- Score: `84/100`
- Continuation likelihood: 55%
- Pullback/consolidation likelihood: 30%
- Risk-off breakdown likelihood: 15%

Interpretation:

The market is still constructive because SPY is above 20D/50D/200D, QQQ leadership is positive, breadth proxy is supportive, VIX is calm, and credit is contained.

But this is not a clean ΓÇ£buy everythingΓÇ¥ signal. MACD is negative, small caps lag, rates remain a constraint, and the map says not to chase. The next useful signal is whether SPY holds/reclaims the 20D after cooling, or loses the 50D with volatility expansion.

## Proposed Final Chart Direction

### Name

**S&P 500 Direction Radar**

### First screen

One hero answer:

- market regime
- score
- direction likelihoods
- current action bias
- next inflection
- invalidation

### Main visual

A large annotated SPY/SPX chart should become the focal point:

- 20D / 50D / 200D lines
- upper-band / chase-risk zone
- pullback / retest zone
- defensive invalidation zone
- current price badge
- ΓÇ£what would confirm / invalidateΓÇ¥ labels directly on chart

### Evidence strips

1. Momentum: RSI + MACD
2. Fear / volatility: VIX + future CNN Fear & Greed + future put/call
3. Participation: QQQ vs SPY, IWM vs SPY, breadth above 50D/200D
4. Macro pressure: 10Y and HY OAS
5. Portfolio translation: core, levered/synthetic, speculative, cash, opportunity scout

## Capital Radar Rule

The market map can change portfolio posture, but it cannot automatically authorize ticker actions.

- Market constructive ΓåÆ allow research / prepare zones.
- Pullback to support ΓåÆ evaluate adds if ticker gates pass.
- Risk-off trigger ΓåÆ reduce beta/levered exposure first.
- Opportunity Scout remains research-only until primary evidence, zone authority, invalidation, and risk budget pass.

## Design Gate

Approval label: `passed_with_design_concerns`

Reason: analytical direction is now right and an HTML radar surface exists, but the true annotated price chart still needs a proper renderer/screenshot validation rather than a text-first prototype.
