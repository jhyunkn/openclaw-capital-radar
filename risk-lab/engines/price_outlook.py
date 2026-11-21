"""Price outlook per stock: volatility fan, 'if the S&P follows history' path, and analyst targets.
Run: python3 price_outlook.py OUT_DIR   (shares market_brief.py's price cache)

Fan: lognormal bands with zero expected return. Volatility starts at today's EWMA level and
mean-reverts toward the stock's 1-year average with a 3-month half-life, because spikes fade.
History path: the median S&P 500 path over the year after the 23 past setups like today
(VIX 30+, S&P 8-20% below its high), scaled by the stock's 1-year beta to SPY.
Analyst targets: Robinhood's consensus 12-month low / mean / high.
Decision layer (per stock): trend (price vs 200-day, 50-day slope), the stock's own record after
past days in the same state (same distance below its 52-week high, same side of its 200-day,
episodes counted once), key levels, and an action state (Watch / Probe / Add / Hold / Trim review)
with a promotion level and an invalidation level. Rules, not advice.
"""
import json, math, os, sys, datetime as dt, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read(); NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
CACHE = paths.CACHE


def yahoo(sym, start=-631152000):
    path = os.path.join(CACHE, "brief_" + sym.replace("^", "_").replace("=", "_") + ".json")
    if os.path.exists(path) and dt.datetime.now().timestamp() - os.path.getmtime(path) < 6 * 3600:
        return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}"
           f"?period1={start}&period2={int(dt.datetime.now().timestamp())}&interval=1d")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
        d = json.load(r)["chart"]["result"][0]
    q = d["indicators"]["quote"][0]; adj = d["indicators"].get("adjclose", [{}])[0].get("adjclose") or q["close"]
    out = {}
    for t, c, a, h in zip(d["timestamp"], q["close"], adj, q["high"]):
        if c is None and h is not None and t == d["timestamp"][-1]:
            c = a = d["meta"].get("regularMarketPrice")
        if a is None: a = c
        if a: out[dt.datetime.fromtimestamp(t, dt.timezone.utc).date()] = a
    json.dump({k.isoformat(): v for k, v in out.items()}, open(path, "w"))
    return out


AN = json.load(open(paths.ANALYST))
POS = json.load(open(paths.POSITIONS))
try:
    LEV = set(json.load(open(os.path.join(paths.PRIVATE, "overrides.json"))).get("leveraged_symbols", []))
except Exception:
    LEV = set()
HELD = [p["yahoo"] for p in POS["positions"] if p["yahoo"] and not p["yahoo"].endswith("-USD")]
UNI = json.load(open(os.path.join(paths.CONFIG, "outlook_universe.json")))["groups"]
GROUP = {}
for g, syms in UNI.items():
    for x in syms: GROUP.setdefault(x, g)
SYMS = list(dict.fromkeys(HELD + ["QQQ"] + [x for v in UNI.values() for x in v] + list(AN["targets"])))

spx = yahoo("^GSPC"); vixd = yahoo("^VIX", 631152000)
cal = sorted(spx); px = np.array([spx[d] for d in cal]); T = len(cal)
vix = np.array([vixd.get(d, np.nan) for d in cal]); dd = px / np.maximum.accumulate(px) - 1
idx = np.flatnonzero((vix >= 30) & (dd <= -0.08) & (dd >= -0.20))
starts = [idx[0]] + [b for a, b in zip(idx, idx[1:]) if b - a > 21]
H = 252
paths = np.array([px[s:s + H + 1] / px[s] - 1 for s in starts if s + H < T])
spx_med = np.median(paths, axis=0)

spy = yahoo("SPY", 1514764800); sdays = sorted(spy)
STEPS = sorted(set(list(range(0, 22, 3)) + list(range(21, 64, 6)) + list(range(63, H + 1, 12)) + [21, 63, H]))
Z = {"p05": -1.645, "p16": -1.0, "p84": 1.0, "p95": 1.645}
hist_rows, cone_rows, summ = [], [], []


def bizdays(d0, n):
    d = d0
    while n > 0:
        d += dt.timedelta(days=1)
        if d.weekday() < 5: n -= 1
    return d


for s in SYMS:
    h = yahoo(s, 1514764800)
    ds = [d for d in sdays if d in h]
    if len(ds) < 260:
        continue
    c = np.array([h[d] for d in ds]); r = np.diff(np.log(c))
    s2 = float(np.var(r[-504:-252])) if len(r) > 504 else float(np.var(r))
    for x in r[-252:]:
        s2 = 0.94 * s2 + 0.06 * x * x
    sig_now, sig_long = math.sqrt(s2), float(np.std(r[-252:]))
    spr = np.diff(np.log(np.array([spy[d] for d in ds])))
    beta = float(np.cov(r[-252:], spr[-252:])[0, 1] / np.var(spr[-252:]))
    p0 = float(c[-1]); ma50 = np.convolve(c, np.ones(50) / 50, "full")[:len(c)]
    ma200h = np.convolve(c, np.ones(200) / 200, "full")[:len(c)]
    for i, (d, v, m) in enumerate(zip(ds[-126:], c[-126:], ma50[-126:])):
        m2 = float(ma200h[len(c) - 126 + i]) if len(c) - 126 + i >= 199 else None
        hist_rows.append({"symbol": s, "date": d.isoformat(), "close": round(float(v), 4), "ma50": round(float(m), 4),
                          "ma200": round(m2, 4) if m2 else None, "key": f"{s}|{d.isoformat()}"})
    cumvar = np.cumsum([sig_long ** 2 + (sig_now ** 2 - sig_long ** 2) * math.exp(-k * math.log(2) / 63) for k in range(H + 1)])
    sd = lambda t: math.sqrt(cumvar[t - 1]) if t > 0 else 0.0
    d0 = ds[-1]
    for t in STEPS:
        row = {"symbol": s, "step": t, "date": bizdays(d0, t).isoformat(), "key": f"{s}|{t}",
               "p50": round(p0, 4), "history_path": round(p0 * max(0.01, 1 + beta * spx_med[t]), 4)}
        for k, z in Z.items():
            row[k] = round(p0 * math.exp(z * sd(t)), 4)
        cone_rows.append(row)
    t_ = AN["targets"].get(s)
    rng = lambda t, z: (p0 * math.exp(-z * sd(t)), p0 * math.exp(z * sd(t)))
    lo1, hi1 = rng(21, 1); lo3, hi3 = rng(63, 1); lo12, hi12 = rng(H, 1)
    row = {"symbol": s, "held": s in HELD, "group": GROUP.get(s, "Other"), "price": round(p0, 2), "asof": ds[-1].isoformat(), "vol_now_pct": round(sig_now * math.sqrt(252) * 100), "vol_1y_pct": round(sig_long * math.sqrt(252) * 100),
           "beta": round(beta, 2), "m1_lo": round(lo1, 2), "m1_hi": round(hi1, 2), "m3_lo": round(lo3, 2), "m3_hi": round(hi3, 2),
           "m12_lo": round(lo12, 2), "m12_hi": round(hi12, 2), "history_3m": round(p0 * (1 + beta * spx_med[63]), 2),
           "history_12m": round(p0 * (1 + beta * spx_med[H]), 2), "high_52w": round(float(c[-252:].max()), 2), "low_52w": round(float(c[-252:].min()), 2)}
    if t_:
        b, hld, sl, hi, lo, mean = t_
        n = b + hld + sl
        row.update({"target_mean": mean, "target_low": lo, "target_high": hi, "analysts": n, "buy_pct": round(b / n * 100),
                    "target_date": AN.get("target_dates", {}).get(s),
                    "upside_to_mean_pct": round((mean / p0 - 1) * 100, 1),
                    "target_sigmas_12m": round(math.log(mean / p0) / sd(H), 2)})
    # ---- decision layer ----
    ma200 = np.convolve(c, np.ones(200) / 200, "full")[:len(c)]; ma200[:199] = np.nan
    hi252 = np.array([c[max(0, i - 251):i + 1].max() for i in range(len(c))]); dd52 = c / hi252 - 1
    m50, m50_20, m200 = float(ma50[-1]), float(ma50[-21]), float(ma200[-1])
    above200 = p0 > m200; slope_up = m50 >= m50_20
    trend = "Uptrend" if above200 and slope_up else "Downtrend" if (not above200 and not slope_up) else "Turning" if not above200 else "Pullback in uptrend"
    n = len(c); f3 = np.full(n, np.nan); f12 = np.full(n, np.nan)
    f3[:-63] = c[63:] / c[:-63] - 1; f12[:-252] = c[252:] / c[:-252] - 1
    ok_ = np.arange(n) >= 252
    same = ok_ & (np.abs(dd52 - dd52[-1]) <= 0.05) & ((c > ma200) == above200) & ~np.isnan(ma200)
    i12 = np.flatnonzero(same & ~np.isnan(f12)); i3 = np.flatnonzero(same & ~np.isnan(f3))
    eps = (1 + int(np.sum(np.diff(i12) > 21))) if len(i12) else 0
    base12 = f12[ok_ & ~np.isnan(f12)]
    own = {"own_days": int(len(i12)), "own_episodes": eps, "own_since": ds[252].year,
           "base_f12_up_pct": round(float((base12 > 0).mean()) * 100) if len(base12) else None}
    if len(i12) >= 40 and eps >= 4:
        own.update({"own_f12_median": round(float(np.median(f12[i12])) * 100, 1), "own_f12_up_pct": round(float((f12[i12] > 0).mean()) * 100),
                    "own_f3_median": round(float(np.median(f3[i3])) * 100, 1), "own_f3_up_pct": round(float((f3[i3] > 0).mean()) * 100),
                    "own_f3_p10": round(float(np.percentile(f3[i3], 10)) * 100, 1)})
    swing_lo = float(c[-63:].min()); p16_3m = p0 * math.exp(-sd(63))
    one_m = p0 * math.exp(-sd(21))  # about one normal month of downside
    invalid = max(swing_lo if swing_lo < p0 * 0.985 else 0.0, one_m)
    invalid_basis = "3-month low" if invalid == swing_lo else "one normal month down"
    above = sorted([(x, n_) for x, n_ in ((m50, "50-day average"), (m200, "200-day average")) if x > p0])
    promote, promote_basis = above[0] if above else (float(c[-21:].max()), "1-month high")
    pts, why = 0, []
    up12, base = own.get("own_f12_up_pct"), own.get("base_f12_up_pct")
    own["own_edge_pts"] = (up12 - base) if up12 is not None and base is not None else None
    if up12 is not None:
        e = own["own_edge_pts"]
        if e >= 10: pts += 1; why.append(f"in past setups like this it was higher a year later {up12}% of the time, above its normal {base}%")
        elif e <= -10: pts -= 1; why.append(f"in past setups like this it was higher a year later only {up12}% of the time, below its normal {base}%")
        else: why.append(f"past setups like this ({up12}% higher a year later) were no better than its normal {base}%")
    else:
        why.append(f"too few past setups like this since {own['own_since']} to judge")
    if trend == "Uptrend": pts += 1; why.append("the trend is up")
    elif trend == "Downtrend": pts -= 1; why.append("the trend is down (below the 200-day, 50-day falling)")
    elif trend == "Pullback in uptrend": why.append("it is pulling back inside an uptrend (above the 200-day, 50-day falling)")
    else: why.append("it is below its 200-day but the 50-day is turning up")
    if row["history_12m"] > p0 * 1.05: pts += 1; why.append("the S&P's typical path after setups like today lifts it")
    if t_ and 0.2 <= row["target_sigmas_12m"] <= 1.2 and row["buy_pct"] >= 70: pts += 1; why.append(f"{row['buy_pct']}% of analysts rate it a buy, with a reachable average target")
    held = s in HELD; lev = s in LEV
    if lev: why.append("it is a leveraged daily-reset fund, which loses value in choppy markets")
    if held:
        state = ("Trim review" if lev and trend == "Downtrend" else "Hold, wait for trend" if lev else
                 "Add review" if pts >= 2 and trend == "Uptrend" else "Hold" if pts >= 1 else
                 "Hold, wait for trend" if pts == 0 else "Trim review")
    mstate = ("Probe" if pts >= 2 and trend in ("Uptrend", "Pullback in uptrend") else "Watch: odds good, trend not yet" if pts >= 2
              else "Watch" if pts >= 0 else "Avoid for now")
    if not held:
        state = mstate
    if False:
        state = "Probe" if pts >= 2 and trend in ("Uptrend", "Pullback in uptrend") else "Watch: odds good, trend not yet" if pts >= 2 else "Watch" if pts >= 0 else "Avoid for now"
    row.update({"ma50": round(m50, 2), "ma200": round(m200, 2), "vs_ma200_pct": round((p0 / m200 - 1) * 100, 1), "dd_52w_pct": round(float(dd52[-1]) * 100, 1),
                "trend": trend, "swing_low_3m": round(swing_lo, 2), "promote_level": round(promote, 2), "invalid_level": round(invalid, 2),
                "promote_basis": promote_basis, "invalid_basis": invalid_basis,
                "evidence_score": pts, "action": state, "action_market": mstate, "action_why": (lambda t: t[:1].upper() + t[1:])("; ".join(why[:5])) + ".", "leveraged": lev, **own})
    summ.append(row)

meta = lambda note: [{"label": "price_outlook.py", "value": SRC, "type": "code", "lang": "python"}, {"label": "Computed", "value": NOW},
                     {"label": "Inputs", "value": "Yahoo Finance daily closes; " + AN["source"] + " synced " + AN["syncedAt"]}, {"label": "Method", "value": note}]
json.dump({"rows": summ, "meta": meta("Ranges are 68% bands (about 2 in 3 outcomes) with no assumed drift. 'Analyst σ' = how many 12-month standard deviations the mean analyst target sits above today's price.")}, open(os.path.join(OUT, "outlook_summary.json"), "w"), allow_nan=False)
json.dump({"rows": cone_rows, "meta": meta("Fan percentiles by trading day ahead: p05/p95 bound 90% of outcomes, p16/p84 bound 68%.")}, open(os.path.join(OUT, "outlook_cone.json"), "w"), allow_nan=False)
json.dump({"rows": hist_rows, "meta": meta("Last 6 months of closes with the 50-day average.")}, open(os.path.join(OUT, "outlook_history.json"), "w"), allow_nan=False)
print(len(summ), len(cone_rows), len(hist_rows), "S&P history median path: 3m %+.1f%%, 12m %+.1f%%" % (spx_med[63] * 100, spx_med[H] * 100))
for x in summ:
    print(f"{x['symbol']:6} {x['action']:30} {x['trend']:20} own {x.get('own_f12_up_pct','—')}% ({x['own_episodes']} eps) promote {x['promote_level']} invalid {x['invalid_level']} | {x['action_why'][:110]}")
    continue
    print(f"{x['symbol']:6} {x['price']:9.2f} vol {x['vol_now_pct']:3}%/{x['vol_1y_pct']:3}% 3m {x['m3_lo']:8.2f}-{x['m3_hi']:8.2f} hist3m {x['history_3m']:8.2f} 12m {x['m12_lo']:8.2f}-{x['m12_hi']:8.2f} target {x.get('target_mean','—')} ({x.get('upside_to_mean_pct','')}%, {x.get('target_sigmas_12m','')}σ)")
