"""Where today's market sits against history, and what usually came next.

Run: python3 market_history.py OUT_DIR   (after risk_engine.py, which supplies your market exposure)

For each gauge: today's value, its percentile over the full available history, and the
S&P 500's forward 1-, 3- and 12-month price returns on past days in the same zone
(today's percentile ± 5 points). "Episodes" counts separate stretches (gaps over a month),
because overlapping days from one sell-off are not independent evidence.
"""
import csv, io, json, math, os, sys, datetime as dt, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read()
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
CACHE = paths.CACHE


def get(url, ua):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": ua}), timeout=45) as r:
                return r.read().decode()
        except Exception:
            if i == 3:
                raise


def yahoo(sym, start=-631152000):
    path = os.path.join(CACHE, "long_" + sym.replace("^", "_").replace("=", "_") + ".json")
    if os.path.exists(path) and dt.datetime.now().timestamp() - os.path.getmtime(path) < 6 * 3600:
        return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}
    d = json.loads(get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}"
                       f"?period1={start}&period2={int(dt.datetime.now().timestamp())}&interval=1d", "Mozilla/5.0"))["chart"]["result"][0]
    q = d["indicators"]["quote"][0]
    out = {}
    for t, c, h in zip(d["timestamp"], q["close"], q["high"]):
        if c is None and h is not None and t == d["timestamp"][-1]:
            c = d["meta"].get("regularMarketPrice")
        if c:
            out[dt.datetime.fromtimestamp(t, dt.timezone.utc).date()] = c
    json.dump({k.isoformat(): v for k, v in out.items()}, open(path, "w"))
    return out


def fred(sid):
    text = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}", "curl/8.7.1")
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        v = r[[k for k in r if k not in ("observation_date", "DATE")][0]]
        if v not in (".", ""):
            out[dt.date.fromisoformat(r.get("observation_date") or r.get("DATE"))] = float(v)
    return out


spx = yahoo("^GSPC")
cal = sorted(spx)
px = np.array([spx[d] for d in cal])
T = len(cal)


def on_cal(src):
    """Forward-fill a series onto the S&P calendar; NaN before it starts."""
    out, prev, keys, j = np.full(T, np.nan), None, sorted(src), 0
    for i, d in enumerate(cal):
        while j < len(keys) and keys[j] <= d:
            prev = src[keys[j]]; j += 1
        if prev is not None:
            out[i] = prev
    return out


def fwd(n):
    f = np.full(T, np.nan)
    f[:-n] = px[n:] / px[:-n] - 1
    return f


F1, F3, F12 = fwd(21), fwd(63), fwd(252)
runmax = np.maximum.accumulate(px)
dd = px / runmax - 1
ma200 = np.convolve(px, np.ones(200) / 200, "full")[:T]; ma200[:199] = np.nan
ret1m = np.full(T, np.nan); ret1m[21:] = px[21:] / px[:-21] - 1

vix = on_cal(yahoo("^VIX", 631152000))
vix3m = on_cal(yahoo("^VIX3M", 1136073600))
ndx = on_cal(yahoo("^NDX", 473385600)); ndx_dd = ndx / np.fmax.accumulate(np.nan_to_num(ndx, nan=0)) - 1
btc = on_cal(yahoo("BTC-USD", 1410912000)); btc_dd = btc / np.fmax.accumulate(np.nan_to_num(btc, nan=0)) - 1
baa = on_cal(fred("BAA10Y")); slope = on_cal(fred("T10Y2Y")); y10 = on_cal(fred("DGS10"))
ndx_dd[np.isnan(ndx)] = np.nan; btc_dd[np.isnan(btc)] = np.nan

GAUGES = [  # id, label, values, unit, higher_is_stress, plain-language meaning
    ("vix", "VIX (expected S&P volatility)", vix, "pts", True, "How much turbulence options traders are paying to protect against."),
    ("vix_ratio", "VIX vs 3-month VIX", vix / vix3m, "ratio", True, "Above 1.0 means traders fear the next month more than the next three: acute stress."),
    ("spx_dd", "S&P 500 below its all-time high", dd * 100, "%", False, "How far the index has fallen from its peak."),
    ("spx_1m", "S&P 500 past month", ret1m * 100, "%", False, "Speed of the recent move."),
    ("spx_ma200", "S&P 500 vs its 200-day average", (px / ma200 - 1) * 100, "%", False, "Below zero is the classic line for a downtrend."),
    ("ndx_dd", "Nasdaq 100 below its high", ndx_dd * 100, "%", False, "Tech-heavy index; drives TQQQ and much of your account."),
    ("btc_dd", "Bitcoin below its high", btc_dd * 100, "%", False, "Drives BMNR, CONL and DOGE."),
    ("baa", "Corporate credit spread (Baa minus 10-yr)", baa, "pts", True, "Extra yield lenders demand from companies. Rising fast = credit stress, the signal that separates corrections from crises."),
    ("slope", "Yield curve (10-yr minus 2-yr)", slope, "pts", False, "Negative (inverted) has preceded most US recessions."),
    ("y10", "10-year Treasury yield", y10, "%", True, "The cost of money for the whole economy."),
]

first_ok = lambda a: cal[int(np.argmax(~np.isnan(a)))]
base = {"f1": np.nanmedian(F1), "f3": np.nanmedian(F3), "f12": np.nanmedian(F12),
        "pos12": np.nanmean(F12[~np.isnan(F12)] > 0) * 100}


def episodes(mask):
    idx = np.flatnonzero(mask)
    if not len(idx):
        return 0, []
    starts = [idx[0]] + [b for a, b in zip(idx, idx[1:]) if b - a > 21]
    return len(starts), [cal[s] for s in starts]


def stats(mask):
    m1, m3, m12 = mask & ~np.isnan(F1), mask & ~np.isnan(F3), mask & ~np.isnan(F12)
    n_ep, starts = episodes(mask)
    return {"days": int(mask.sum()), "episodes": n_ep,
            "fwd1m_median": float(np.median(F1[m1]) * 100) if m1.any() else None,
            "fwd3m_median": float(np.median(F3[m3]) * 100) if m3.any() else None,
            "fwd3m_p10": float(np.quantile(F3[m3], 0.10) * 100) if m3.any() else None,
            "fwd12m_median": float(np.median(F12[m12]) * 100) if m12.any() else None,
            "fwd12m_pos_pct": float(np.mean(F12[m12] > 0) * 100) if m12.any() else None,
            "fwd12m_worst": float(F12[m12].min() * 100) if m12.any() else None,
            "recent_starts": ", ".join(d.strftime("%b %Y") for d in starts[-4:])}


def r(x, n=1):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), n)


# your account's US-market exposure, from the risk engine
mkt_exp = None
fr = os.path.join(OUT, "factor_risk.json")
if os.path.exists(fr):
    mkt_exp = next((x["exposure"] for x in json.load(open(fr))["rows"] if x["factor"] == "MKT"), None)

rows = []
for gid, label, a, unit, stress_up, meaning in GAUGES:
    ok = ~np.isnan(a)
    cur = a[ok][-1]
    hist = a[ok]
    pct = float((hist < cur).mean() * 100)
    stress_pct = pct if stress_up else 100 - pct  # 100 = most stressed reading on record
    lo, hi = max(0, pct - 5), min(100, pct + 5)
    qlo, qhi = np.percentile(hist, lo), np.percentile(hist, hi)
    mask = ok & (a >= qlo) & (a <= qhi)
    st = stats(mask)
    zone = ("Extreme stress" if stress_pct >= 95 else "High stress" if stress_pct >= 80 else
            "Elevated" if stress_pct >= 60 else "Normal" if stress_pct >= 20 else "Calm")
    rows.append({"gauge": gid, "label": label, "meaning": meaning, "current": r(cur, 2), "unit": unit,
                 "since": first_ok(a).year, "percentile": r(pct, 0), "stress_pct": r(stress_pct, 0), "zone": zone,
                 "median_hist": r(float(np.median(hist)), 2), "p10_hist": r(float(np.percentile(hist, 10)), 2), "p90_hist": r(float(np.percentile(hist, 90)), 2),
                 **{k: (r(v) if isinstance(v, float) else v) for k, v in st.items()},
                 "vs_normal_3m": r(st["fwd3m_median"] - base["f3"] * 100) if st["fwd3m_median"] is not None else None})
write_meta = lambda extra: [{"label": "market_history.py", "value": SRC, "type": "code", "lang": "python"},
                            {"label": "Computed", "value": NOW},
                            {"label": "Data", "value": "Yahoo Finance ^GSPC since 1950, ^VIX since 1990, ^VIX3M since 2006, ^NDX since 1985, BTC-USD since 2014; FRED BAA10Y, T10Y2Y, DGS10"},
                            {"label": "Method", "value": extra}]
json.dump({"rows": rows, "meta": write_meta("Percentile = share of all past days with a lower reading. Forward returns are S&P 500 price changes after past days whose reading fell within ±5 percentile points of today's.")},
          open(os.path.join(OUT, "market_gauges.json"), "w"), allow_nan=False)

# composite setups
i_now = T - 1
setups = [
    ("All days since 1950 (normal)", np.ones(T, bool)),
    ("VIX 30 or higher", vix >= 30),
    ("S&P 8–20% below its high", (dd <= -0.08) & (dd >= -0.20)),
    ("Today's setup: VIX 30+ and S&P 8–20% off its high", (vix >= 30) & (dd <= -0.08) & (dd >= -0.20)),
    ("Same, but credit spreads still calm (Baa < 2.5)", (vix >= 30) & (dd <= -0.08) & (dd >= -0.20) & (baa < 2.5)),
    ("Same, with credit stress (Baa ≥ 2.5)", (vix >= 30) & (dd <= -0.08) & (dd >= -0.20) & (baa >= 2.5)),
    ("S&P down 10%+ in one month", ret1m <= -0.10),
]
an = []
for name, mask in setups:
    mask = mask & ~np.isnan(np.where(np.isnan(vix) & ("VIX" in name), np.nan, 0))
    st = stats(mask)
    today_fits = bool(mask[i_now])
    row = {"setup": name, "today_fits": today_fits, **{k: (r(v) if isinstance(v, float) else v) for k, v in st.items()}}
    if mkt_exp and st["fwd3m_median"] is not None:
        row["your_3m_median"] = r(mkt_exp * st["fwd3m_median"] / 100, 0)
        row["your_3m_bad"] = r(mkt_exp * st["fwd3m_p10"] / 100, 0)
    an.append(row)
json.dump({"rows": an, "meta": write_meta("Your dollars = your US-market exposure from the factor model × the S&P move. Bad case = the 10th-percentile 3-month outcome. Other factors (gold, crypto, sectors) are not included in this translation.")},
          open(os.path.join(OUT, "market_analogs.json"), "w"), allow_nan=False)

for x in rows: print(x["label"], x["current"], x["percentile"], x["zone"], x["episodes"], x["fwd3m_median"], x["fwd12m_median"], x["fwd12m_pos_pct"])
for x in an: print(x)
