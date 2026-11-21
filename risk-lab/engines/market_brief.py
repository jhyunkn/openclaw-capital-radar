"""Market brief: S&P 500 ranges, what led after past sell-offs like today, and a momentum screen.
Run: python3 market_brief.py OUT_DIR  (prints a report and writes brief_*.json)
"""
import json, math, os, sys, datetime as dt, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = sys.argv[1]
CACHE = paths.CACHE


def yahoo(sym, start=-631152000):
    path = os.path.join(CACHE, "brief_" + sym.replace("^", "_").replace("=", "_") + ".json")
    if os.path.exists(path) and dt.datetime.now().timestamp() - os.path.getmtime(path) < 6 * 3600:
        return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}"
           f"?period1={start}&period2={int(dt.datetime.now().timestamp())}&interval=1d")
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
                d = json.load(r)["chart"]["result"][0]; break
        except Exception:
            if i == 3: return {}
    q = d["indicators"]["quote"][0]; adj = d["indicators"].get("adjclose", [{}])[0].get("adjclose") or q["close"]
    out = {}
    for t, c, a, h in zip(d["timestamp"], q["close"], adj, q["high"]):
        if c is None and h is not None and t == d["timestamp"][-1]:
            c = a = d["meta"].get("regularMarketPrice")
        if a is None: a = c
        if a: out[dt.datetime.fromtimestamp(t, dt.timezone.utc).date()] = a
    json.dump({k.isoformat(): v for k, v in out.items()}, open(path, "w"))
    return out


spx = yahoo("^GSPC"); vixd = yahoo("^VIX", 631152000)
cal = sorted(spx); px = np.array([spx[d] for d in cal]); T = len(cal)
vix = np.array([vixd.get(d, np.nan) for d in cal])
runmax = np.maximum.accumulate(px); dd = px / runmax - 1
ma50 = np.convolve(px, np.ones(50) / 50, "full")[:T]; ma200 = np.convolve(px, np.ones(200) / 200, "full")[:T]
now = px[-1]
R = {}

# ---- 1. ranges
v = vix[-1]
for label, days in (("1 month", 21), ("3 months", 63)):
    s = v / 100 * math.sqrt(days / 252)
    R[f"implied_{days}"] = {"window": label, "lo68": now * math.exp(-s), "hi68": now * math.exp(s), "lo95": now * math.exp(-2 * s), "hi95": now * math.exp(2 * s)}
sig = (vix >= 30) & (dd <= -0.08) & (dd >= -0.20)
idx = np.flatnonzero(sig)
starts = [idx[0]] + [b for a, b in zip(idx, idx[1:]) if b - a > 21]
eps = []
for s0 in starts:
    if s0 + 63 >= T: continue
    w = px[s0:s0 + 64]
    eps.append({"date": cal[s0].isoformat(), "further_low_pct": (w.min() / px[s0] - 1) * 100, "days_to_low": int(w.argmin()),
                "ret3m_pct": (px[s0 + 63] / px[s0] - 1) * 100,
                "ret12m_pct": (px[s0 + 252] / px[s0] - 1) * 100 if s0 + 252 < T else None,
                "days_to_new_high": next((k for k in range(s0, T) if px[k] >= runmax[s0]), None)})
for e in eps:
    s0 = cal.index(dt.date.fromisoformat(e["date"]))
    e["days_to_new_high"] = (e["days_to_new_high"] - s0) if e["days_to_new_high"] is not None else None
fl = np.array([e["further_low_pct"] for e in eps]); r3 = np.array([e["ret3m_pct"] for e in eps])
nh = [e["days_to_new_high"] for e in eps if e["days_to_new_high"] is not None]
R["analog"] = {"episodes": len(eps), "further_low_median": float(np.median(fl)), "further_low_p90": float(np.quantile(fl, .1)),
               "further_low_worst": float(fl.min()), "ret3m_p10": float(np.quantile(r3, .1)), "ret3m_med": float(np.median(r3)),
               "ret3m_p90": float(np.quantile(r3, .9)), "days_to_new_high_median": float(np.median(nh)) if nh else None,
               "pct_new_high_within_1y": float(np.mean([d is not None and d <= 252 for d in [e["days_to_new_high"] for e in eps]]) * 100)}
R["levels"] = {"close": now, "all_time_high": float(runmax[-1]), "ma50": float(ma50[-1]), "ma200": float(ma200[-1]),
               "low_52w": float(px[-252:].min()), "correction_10": float(runmax[-1] * 0.9), "bear_20": float(runmax[-1] * 0.8),
               "bear_30": float(runmax[-1] * 0.7), "drawdown_pct": float(dd[-1] * 100)}

# ---- 2. which sectors led after past setups like today (sector ETFs exist since Dec 1998)
SECT = {"XLK": "Technology", "XLY": "Cons. discretionary", "XLF": "Financials", "XLI": "Industrials", "XLE": "Energy",
        "XLB": "Materials", "XLV": "Health care", "XLP": "Cons. staples", "XLU": "Utilities"}
sp = {s: yahoo(s, 915148800) for s in SECT}
eps99 = [e for e in eps if e["date"] >= "1999-01-01"]
sect_rows = []
for s, name in SECT.items():
    ex, trail_rank = [], []
    for e in eps99:
        d0 = dt.date.fromisoformat(e["date"]); i0 = cal.index(d0)
        if i0 + 63 >= T or d0 not in sp[s]: continue
        d3 = cal[i0 + 63]; dm = cal[i0 - 63]
        if d3 in sp[s] and dm in sp[s]:
            ex.append((sp[s][d3] / sp[s][d0] - 1) - (px[i0 + 63] / px[i0] - 1))
    sect_rows.append({"etf": s, "sector": name, "episodes": len(ex), "median_excess_3m_pct": float(np.median(ex) * 100) if ex else None,
                      "beat_spx_pct": float(np.mean(np.array(ex) > 0) * 100) if ex else None})
# leaders vs laggards: rank sectors by their trailing 3-month return at each signal
lead, lag = [], []
for e in eps99:
    d0 = dt.date.fromisoformat(e["date"]); i0 = cal.index(d0)
    if i0 + 63 >= T: continue
    rows = []
    for s in SECT:
        try:
            rows.append(((sp[s][d0] / sp[s][cal[i0 - 63]] - 1), sp[s][cal[i0 + 63]] / sp[s][d0] - 1))
        except KeyError:
            pass
    if len(rows) < 6: continue
    rows.sort(key=lambda r: r[0])
    lag.append(np.mean([r[1] for r in rows[:3]])); lead.append(np.mean([r[1] for r in rows[-3:]]))
R["leaders_vs_laggards"] = {"episodes": len(lead), "leaders_fwd3m_median": float(np.median(lead) * 100), "laggards_fwd3m_median": float(np.median(lag) * 100),
                            "laggards_won_pct": float(np.mean(np.array(lag) > np.array(lead)) * 100)}
sect_rows.sort(key=lambda r: -(r["median_excess_3m_pct"] or -99))

# ---- 3. momentum screen
UNIV = {"ETF": ["SPY", "QQQ", "IWM", "SMH", "XLK", "XLC", "XLY", "XLF", "XLI", "XLE", "XLB", "XLV", "XLP", "XLU", "XLRE", "TLT", "GLD", "BTC-USD", "ETH-USD"],
        "Stock": ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA", "BRK-B", "JPM", "V", "MA", "LLY", "UNH", "JNJ", "ABBV", "MRK",
                  "XOM", "CVX", "WMT", "COST", "PG", "KO", "PEP", "HD", "MCD", "CAT", "GE", "RTX", "LMT", "HON", "NEE", "DUK", "SO", "CEG", "VST",
                  "VRT", "ORCL", "CRM", "AMD", "MU", "PLTR", "NFLX", "UBER", "BWXT", "LEU", "IAU", "BMNR", "TQQQ"]}
spy = yahoo("SPY", 1514764800); sdays = sorted(spy)
spy_arr = np.array([spy[d] for d in sdays])
rows = []
for kind, syms in UNIV.items():
    for s in syms:
        h = yahoo(s, 1514764800)
        ds = [d for d in sdays if d in h]
        if len(ds) < 260: continue
        c = np.array([h[d] for d in ds]); sp_c = np.array([spy[d] for d in ds])
        r = lambda n: c[-1] / c[-1 - n] - 1
        m12_1 = c[-22] / c[-253] - 1
        diff = np.diff(c[-15:]); up = diff[diff > 0].sum(); dn = -diff[diff < 0].sum(); rsi = 100 - 100 / (1 + up / dn) if dn > 0 else 100
        rr = np.diff(np.log(c[-253:])); sr = np.diff(np.log(sp_c[-253:]))
        beta = np.cov(rr, sr)[0, 1] / np.var(sr)
        rows.append({"symbol": s, "kind": kind, "price": float(c[-1]), "ret1m": r(21) * 100, "ret3m": r(63) * 100, "ret6m": r(126) * 100,
                     "mom12_1": m12_1 * 100, "vs_ma50": (c[-1] / c[-50:].mean() - 1) * 100, "vs_ma200": (c[-1] / c[-200:].mean() - 1) * 100,
                     "off_high": (c[-1] / c[-252:].max() - 1) * 100, "rsi14": rsi, "beta": beta,
                     "rel1m": (r(21) - (sp_c[-1] / sp_c[-22] - 1)) * 100})
# composite: 12-1 momentum rank + 1-month relative strength rank (resilience) + trend filter
def pr(vals):
    o = np.argsort(np.argsort(vals)); return o / (len(vals) - 1) * 100
m = pr(np.array([x["mom12_1"] for x in rows])); rs = pr(np.array([x["rel1m"] for x in rows]))
for x, a, b in zip(rows, m, rs):
    x["score"] = 0.5 * a + 0.5 * b + (10 if x["vs_ma200"] > 0 else -10)
    x["state"] = ("Leader" if x["vs_ma200"] > 0 and x["rel1m"] > 0 else "Holding up" if x["rel1m"] > 0 else
                  "Breaking down" if x["vs_ma200"] < 0 and x["ret1m"] < -10 else "Weak")
rows.sort(key=lambda x: -x["score"])
R["screen"] = rows; R["sectors_after"] = sect_rows; R["episodes"] = eps; R["asof"] = cal[-1].isoformat()
json.dump(R, open(os.path.join(OUT, "brief.json"), "w"), default=float)

L = R["levels"]; A = R["analog"]
print(f"S&P {now:.0f}  ATH {L['all_time_high']:.0f}  dd {L['drawdown_pct']:.1f}%  50d {L['ma50']:.0f}  200d {L['ma200']:.0f}  52wLow {L['low_52w']:.0f}  -20% {L['bear_20']:.0f}  -30% {L['bear_30']:.0f}")
for k in ("implied_21", "implied_63"):
    x = R[k]; print(k, {kk: round(vv) if isinstance(vv, float) else vv for kk, vv in x.items()})
print("analog", {k: round(v, 1) if isinstance(v, float) else v for k, v in A.items()})
print("price at analog med low", round(now * (1 + A["further_low_median"] / 100)), "p90 low", round(now * (1 + A["further_low_p90"] / 100)),
      "3m p10/med/p90", [round(now * (1 + A[k] / 100)) for k in ("ret3m_p10", "ret3m_med", "ret3m_p90")])
print("leaders vs laggards", R["leaders_vs_laggards"])
for r_ in sect_rows: print(" ", r_["sector"], r_["episodes"], round(r_["median_excess_3m_pct"], 1), round(r_["beat_spx_pct"]))
print("TOP")
for x in rows[:18]: print(f"  {x['symbol']:8} {x['kind']:5} {x['state']:13} 1m {x['ret1m']:6.1f} rel {x['rel1m']:6.1f} 3m {x['ret3m']:6.1f} 12-1 {x['mom12_1']:6.1f} v200 {x['vs_ma200']:6.1f} off {x['off_high']:6.1f} rsi {x['rsi14']:4.0f} b {x['beta']:.2f}")
print("BOTTOM")
for x in rows[-14:]: print(f"  {x['symbol']:8} {x['kind']:5} {x['state']:13} 1m {x['ret1m']:6.1f} rel {x['rel1m']:6.1f} 3m {x['ret3m']:6.1f} 12-1 {x['mom12_1']:6.1f} v200 {x['vs_ma200']:6.1f} off {x['off_high']:6.1f} rsi {x['rsi14']:4.0f}")
