"""Institutional-style risk engine for the Portfolio War Room.

Run: python3 -I risk_engine.py OUT_DIR
Reads positions.json beside this file; writes {rows, meta} JSON datasets to OUT_DIR
and appends to var_ledger.csv (the live, day-by-day record of predicted vs actual).

1. Multi-factor risk model  : 24 ETF-proxy factors (market, style, sector, macro, crypto),
                               EWMA-weighted ridge regressions, EWMA factor covariance,
                               factor vs company-specific risk split.
2. Tail risk                : historical, EWMA-normal, filtered-historical and Cornish-Fisher VaR,
                               97.5% expected shortfall, stressed VaR from crisis-period factor moves.
3. VaR backtest             : 500 days of rolling out-of-sample forecasts vs hypothetical P&L,
                               Kupiec and Christoffersen tests, Basel traffic light. Plus a forward ledger.
4. Exit-rule backtest       : trailing-stop / scale-out rules vs buy-and-hold since 2019, next-open
                               execution, 10 bp per side costs, T-bill on cash. Parameters fixed in advance.
5. Option                   : Black-Scholes reprice and Greeks for the NVDX call, delta-equivalent
                               exposure fed into the factor model.
"""
import csv, json, math, os, sys, datetime as dt, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths
import warnings
# numpy 2.0 + Apple Accelerate emits spurious matmul RuntimeWarnings; results are checked for finiteness below.
warnings.filterwarnings("ignore", message=".*encountered in matmul")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read()
POS = json.load(open(paths.POSITIONS))
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
UA = {"User-Agent": "Mozilla/5.0"}
CACHE = paths.CACHE

FACTORS = [  # (id, label, group, proxy)
    ("MKT", "US market", "Market", "SPY"),
    ("SIZE", "Small caps", "Style", "IWM"), ("MOM", "Momentum", "Style", "MTUM"), ("QUAL", "Quality", "Style", "QUAL"),
    ("VAL", "Value", "Style", "VLUE"), ("LOWVOL", "Low volatility", "Style", "USMV"),
    ("TECH", "Software & tech", "Sector", "XLK"), ("SEMI", "Semiconductors", "Sector", "SMH"),
    ("COMM", "Communication", "Sector", "XLC"), ("DISC", "Consumer discretionary", "Sector", "XLY"),
    ("FIN", "Financials", "Sector", "XLF"), ("IND", "Industrials", "Sector", "XLI"), ("ENGY", "Energy", "Sector", "XLE"),
    ("UTIL", "Utilities", "Sector", "XLU"), ("HLTH", "Health care", "Sector", "XLV"), ("STPL", "Consumer staples", "Sector", "XLP"),
    ("MATL", "Materials", "Sector", "XLB"), ("REIT", "Real estate", "Sector", "XLRE"),
    ("RATES", "Long Treasuries", "Macro", "TLT"), ("GOLD", "Gold", "Macro", "GLD"), ("USD", "US dollar", "Macro", "UUP"),
    ("OIL", "Crude oil", "Macro", "USO"), ("BTC", "Bitcoin", "Crypto", "BTC-USD"), ("ETH", "Ether", "Crypto", "ETH-USD"),
]
# Holdings whose early history belongs to a different business: use data from this date only.
HISTORY_START = {"BMNR": dt.date(2025, 7, 1)}


def fetch(sym):
    path = os.path.join(CACHE, sym.replace("^", "_").replace("=", "_") + ".json")
    if os.path.exists(path) and (dt.datetime.now().timestamp() - os.path.getmtime(path)) < 6 * 3600:
        return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}"
           f"?period1=1546300800&period2={int(dt.datetime.now().timestamp())}&interval=1d")
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                d = json.load(r)["chart"]["result"][0]
            break
        except Exception:
            if i == 3:
                raise
    q = d["indicators"]["quote"][0]
    adj = d["indicators"].get("adjclose", [{}])[0].get("adjclose") or q["close"]
    rows = {}
    for t, o, h, l, c, a in zip(d["timestamp"], q["open"], q["high"], q["low"], q["close"], adj):
        if c is None and h is not None and t == d["timestamp"][-1]:
            c = d["meta"].get("regularMarketPrice")
        if a is None:
            a = c
        if None in (o, h, l, c, a) or c <= 0:
            continue
        f = a / c  # adjust OHLC for splits/dividends
        rows[dt.datetime.fromtimestamp(t, dt.timezone.utc).date()] = {"o": o * f, "h": h * f, "l": l * f, "c": a}
    json.dump({k.isoformat(): v for k, v in rows.items()}, open(path, "w"))
    return rows


def write(name, rows, note=None):
    meta = [{"label": "risk_engine.py", "value": SRC, "type": "code", "lang": "python"},
            {"label": "Computed", "value": NOW},
            {"label": "Positions", "value": POS["source"] + " · synced " + POS["syncedAt"]},
            {"label": "Prices", "value": "Yahoo Finance daily OHLC since 2019, split/dividend adjusted"}]
    if note:
        meta.append({"label": "Method", "value": note})
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump({"rows": rows, "meta": meta}, f, allow_nan=False)


def rnd(x, n=2):
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) or math.isinf(x) else round(x, n)


def chi2_sf1(x):  # survival function of chi-square with 1 dof
    return math.erfc(math.sqrt(max(x, 0) / 2))


def ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def ninv(p):  # Acklam's inverse normal
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    if p < 0.02425:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    if p > 1 - 0.02425:
        return -ninv(1 - p)
    q = p - 0.5; r = q * q
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


# ------------------------------------------------------------------ data
held = [p for p in POS["positions"] if p["yahoo"]]
opt = next((p for p in POS["positions"] if p.get("option")), None)
need = sorted({p["yahoo"] for p in held} | {f[3] for f in FACTORS} | {"NVDX", "NVDA", "TSLA", "COIN", "QQQ", "^IRX"})
H = {s: fetch(s) for s in need}
cal = sorted(H["SPY"])
T = len(cal)


def series(sym, field="c"):
    out, prev = np.full(T, np.nan), None
    h = H[sym]
    for i, d_ in enumerate(cal):
        if d_ in h:
            prev = h[d_][field]
        out[i] = prev if prev is not None else np.nan
    return out


C = {s: series(s) for s in need}
Rt = {s: np.r_[np.nan, C[s][1:] / C[s][:-1] - 1] for s in need}  # simple daily returns on SPY calendar
rf = np.nan_to_num(series("^IRX") / 100 / 252, nan=0.0)
for p in held:  # blank out history that belongs to a different business
    start = HISTORY_START.get(p["symbol"])
    if start:
        Rt[p["yahoo"]][np.array([d_ < start for d_ in cal])] = np.nan

# ------------------------------------------------------------------ 1. factor model
# Factor returns: market = SPY; every other factor = its ETF's return net of its full-sample SPY beta.
mkt = Rt["SPY"]
Fr = np.zeros((T, len(FACTORS)))
for k, (fid, _, _, px) in enumerate(FACTORS):
    r = Rt[px]
    if fid == "MKT":
        Fr[:, k] = r
    else:
        ok = ~np.isnan(r) & ~np.isnan(mkt)
        beta = np.cov(r[ok], mkt[ok])[0, 1] / np.var(mkt[ok])
        Fr[:, k] = r - beta * mkt
W_EST = 504
win = np.arange(T - W_EST, T)


def ewma_w(n, halflife):
    w = 0.5 ** (np.arange(n)[::-1] / halflife)
    return w / w.sum()


def ridge_fit(y, X, w, lam):
    sd = X.std(axis=0) + 1e-12
    Xs = X / sd
    Wm = np.sqrt(w)[:, None]
    A = (Xs * Wm).T @ (Xs * Wm) + lam * np.eye(X.shape[1])
    b = np.linalg.solve(A, (Xs * Wm).T @ (y * Wm[:, 0]))
    return b / sd


def fit_asset(r):
    idx = win[~np.isnan(r[win]) & ~np.isnan(Fr[win]).any(axis=1)]
    y, X = r[idx], Fr[idx]
    w = ewma_w(len(idx), 252)
    # choose ridge penalty on a time-ordered holdout (last 20%)
    cut = int(len(idx) * 0.8)
    best, best_err = 1.0, 1e18
    for lam in (0.01, 0.1, 0.3, 1, 3, 10, 30):
        b = ridge_fit(y[:cut], X[:cut], ewma_w(cut, 252), lam)
        e = np.mean((y[cut:] - X[cut:] @ b) ** 2)
        if e < best_err:
            best, best_err = lam, e
    b = ridge_fit(y, X, w, best)
    resid = y - X @ b
    spec_var = float(np.sum(ewma_w(len(resid), 63) * resid ** 2))
    r2 = 1 - np.sum(w * resid ** 2) / np.sum(w * (y - np.sum(w * y)) ** 2)
    return b, spec_var, float(r2), len(idx), best


assets = []  # (symbol, dollar value, returns key)
for p in held:
    assets.append({"symbol": p["symbol"], "value": p["qty"] * p["price"], "key": p["yahoo"], "name": p["name"]})
if opt:
    o = opt["option"]
    delta_dollars = o["delta"] * opt["qty"] * opt.get("multiplier", 100) * o["underlying_price"]
    assets.append({"symbol": opt["symbol"], "value": delta_dollars, "key": "NVDX", "name": opt["name"] + " (delta-equivalent)"})
total = sum(p["qty"] * p["price"] * p.get("multiplier", 1) for p in POS["positions"]) + POS["cash"]

B = np.zeros((len(assets), len(FACTORS))); S = np.zeros(len(assets)); R2 = []
for i, a in enumerate(assets):
    b, sv, r2, n, lam = fit_asset(Rt[a["key"]])
    B[i], S[i] = b, sv
    a.update({"r2": r2, "obs": n, "lambda": lam})
wv = np.array([a["value"] for a in assets])

Fw = Fr[win]
fw = ewma_w(W_EST, 63)
Fm = (fw[:, None] * Fw).sum(axis=0)
Fcov = ((Fw - Fm) * fw[:, None]).T @ (Fw - Fm)  # EWMA factor covariance (daily)

assert np.isfinite(Fcov).all() and np.isfinite(B).all() and np.isfinite(S).all(), "non-finite risk model"
bport = B.T @ wv  # $ exposure to each factor
fac_var = float(bport @ Fcov @ bport)
spec_var_p = float(np.sum(wv ** 2 * S))
tot_var = fac_var + spec_var_p
contrib = bport * (Fcov @ bport) / tot_var

fac_rows = []
for k, (fid, label, group, px) in enumerate(FACTORS):
    fac_rows.append({"factor": fid, "label": label, "group": group, "proxy": px,
                     "exposure": rnd(bport[k], 0), "exposure_pct": rnd(bport[k] / total * 100, 1),
                     "risk_contrib_pct": rnd(contrib[k] * 100, 1),
                     "factor_vol_pct": rnd(math.sqrt(Fcov[k, k] * 252) * 100, 1)})
fac_rows.append({"factor": "SPECIFIC", "label": "Company-specific", "group": "Specific", "proxy": "",
                 "exposure": None, "exposure_pct": None, "risk_contrib_pct": rnd(spec_var_p / tot_var * 100, 1), "factor_vol_pct": None})
fac_rows.sort(key=lambda r: -(r["risk_contrib_pct"] or 0))
write("factor_risk", fac_rows, "Each factor's dollar exposure (sum of holdings' loadings × value) and its share of total variance, b_k(Fb)_k / σ². Factors other than the market are their ETF's return net of its SPY beta, so 'Semiconductors' means semis beyond what the market explains.")

asset_rows = []
mctr = (B @ (Fcov @ bport) * wv + wv ** 2 * S) / tot_var
for i, a in enumerate(assets):
    top = np.argsort(-np.abs(B[i] * np.sqrt(np.diag(Fcov))))[:3]  # rank by risk impact, not raw coefficient
    asset_rows.append({"symbol": a["symbol"], "value": rnd(a["value"], 0),
                       "r2": rnd(a["r2"], 2), "specific_vol_pct": rnd(math.sqrt(S[i] * 252) * 100, 0),
                       "specific_share_pct": rnd(wv[i] ** 2 * S[i] / (wv[i] ** 2 * S[i] + (wv[i] * B[i]) @ Fcov @ (wv[i] * B[i])) * 100, 0),
                       "risk_contrib_pct": rnd(mctr[i] * 100, 1),
                       "beta_market": rnd(B[i][0], 2),
                       "top_loadings": "; ".join(f"{FACTORS[k][1]} {B[i][k]:+.2f}" for k in top),
                       "obs": a["obs"]})
asset_rows.sort(key=lambda r: -(r["risk_contrib_pct"] or 0))
write("asset_risk", asset_rows, "Loadings from EWMA-weighted (half-life 1 year) ridge regressions over the last 2 years; penalty chosen on a time-ordered holdout. Company-specific share = the holding's own residual variance over its total variance.")

# ------------------------------------------------------------------ 2. tail risk
# Hypothetical P&L: today's dollar positions × each past day's returns (factor-fitted where a holding lacked history).
def asset_hist_returns(i):
    r = Rt[assets[i]["key"]].copy()
    fitted = Fr @ B[i]
    miss = np.isnan(r)
    r[miss] = fitted[miss]
    return np.nan_to_num(r), miss


AR = np.zeros((T, len(assets))); proxied = {}
for i in range(len(assets)):
    AR[:, i], miss = asset_hist_returns(i)
    proxied[assets[i]["symbol"]] = int(miss[-504:].sum())
pnl = AR @ wv  # $ P&L of today's book on each historical day
pnl[0] = 0
assert np.isfinite(pnl).all(), "non-finite P&L history"
# Hand the daily series to the library-based engines (advanced_engine.py): private, never committed.
with open(os.path.join(paths.OUT_PRIVATE, "book_series.csv"), "w") as f:
    f.write("date,book_pnl,spy_ret," + ",".join(a["symbol"].replace(",", " ") for a in assets) + "\n")
    for t in range(1, T):
        f.write(cal[t].isoformat() + f",{pnl[t]:.4f},{np.nan_to_num(Rt['SPY'][t]):.6f}," + ",".join(f"{AR[t, i]:.6f}" for i in range(len(assets))) + "\n")
with open(os.path.join(paths.OUT_PRIVATE, "book_meta.json"), "w") as f:
    json.dump({"total": total, "values": {a["symbol"]: a["value"] for a in assets}}, f)
L = -pnl

def hs_var(x, a):
    return float(np.quantile(x, a))


def es(x, a):
    q = np.quantile(x, a)
    return float(x[x >= q].mean())


recent = L[-504:]
ew = 0.94
sig2 = np.var(pnl[-504:-252])
for x in pnl[-252:]:
    sig2 = ew * sig2 + (1 - ew) * x * x
sig_now = math.sqrt(sig2)
z = pnl[-504:] / np.sqrt(np.maximum([np.var(pnl[max(0, t - 60):t]) if t > 20 else np.var(pnl[-504:]) for t in range(T - 504, T)], 1e-9))
fhs99 = float(np.quantile(-z, 0.99)) * sig_now; fhs95 = float(np.quantile(-z, 0.95)) * sig_now
sk = float(((pnl[-504:] - pnl[-504:].mean()) ** 3).mean() / pnl[-504:].std() ** 3)
ku = float(((pnl[-504:] - pnl[-504:].mean()) ** 4).mean() / pnl[-504:].std() ** 4 - 3)


def cf(p):
    zq = ninv(p)
    return zq + (zq ** 2 - 1) * sk / 6 + (zq ** 3 - 3 * zq) * ku / 24 - (2 * zq ** 3 - 5 * zq) * sk ** 2 / 36


sd2 = pnl[-504:].std()
model_sd = math.sqrt(tot_var)

# Stressed VaR: crisis-period factor returns × today's factor exposures, plus specific risk.
STRESS = [("COVID crash", dt.date(2020, 2, 19), dt.date(2020, 4, 30)), ("2022 bear market", dt.date(2022, 1, 3), dt.date(2022, 12, 30)),
          ("Aug 2024 unwind", dt.date(2024, 7, 10), dt.date(2024, 8, 30)), ("Apr 2025 tariff shock", dt.date(2025, 3, 25), dt.date(2025, 4, 30))]
stress_rows = []
for name, a_, b_ in STRESS:
    ix = np.array([a_ <= d_ <= b_ for d_ in cal])
    fpnl = np.nan_to_num(Fr[ix]) @ bport
    cum = float(np.prod(1 + np.nan_to_num(Fr[ix][:, 0])) - 1)
    peak, trough, run = 0.0, 0.0, 0.0
    for x in fpnl:
        run += x; peak = max(peak, run); trough = min(trough, run - peak)
    Fs = np.cov(np.nan_to_num(Fr[ix]).T)
    svar99 = 2.326 * math.sqrt(bport @ Fs @ bport + spec_var_p)
    stress_rows.append({"scenario": name, "window": f"{a_} to {b_}", "days": int(ix.sum()),
                        "market_move_pct": rnd(cum * 100, 1), "book_pnl": rnd(fpnl.sum(), 0),
                        "book_pct": rnd(fpnl.sum() / total * 100, 1), "worst_drawdown": rnd(trough, 0),
                        "worst_day": rnd(-fpnl.min(), 0), "stressed_var99": rnd(svar99, 0)})
write("stress_factor", stress_rows, "Factor returns from each crisis applied to today's factor exposures (company-specific moves excluded). Stressed VaR uses the crisis-period factor covariance, as Basel 2.5 does.")

methods = [
    {"method": "Historical simulation", "var95": hs_var(recent, .95), "var99": hs_var(recent, .99), "es975": es(recent, .975),
     "note": "Today's book replayed on the last 504 trading days."},
    {"method": "EWMA normal (RiskMetrics)", "var95": 1.645 * sig_now, "var99": 2.326 * sig_now, "es975": sig_now * math.exp(-1.96 ** 2 / 2) / math.sqrt(2 * math.pi) / 0.025,
     "note": "Volatility weighted toward recent days (λ = 0.94); assumes a normal bell curve."},
    {"method": "Filtered historical", "var95": fhs95, "var99": fhs99, "es975": None,
     "note": "Past moves rescaled to today's volatility, keeping their real shape."},
    {"method": "Cornish-Fisher", "var95": -cf(0.05) * sd2, "var99": -cf(0.01) * sd2, "es975": None,
     "note": f"Normal VaR corrected for skew ({sk:+.2f}) and fat tails (excess kurtosis {ku:.1f})."},
    {"method": "Factor model (normal)", "var95": 1.645 * model_sd, "var99": 2.326 * model_sd, "es975": None,
     "note": "From the 24-factor covariance plus company-specific variance."},
    {"method": "Stressed (2022 bear)", "var95": None, "var99": next(r["stressed_var99"] for r in stress_rows if r["scenario"].startswith("2022")), "es975": None,
     "note": "Factor-model VaR using 2022's factor covariance."},
]
for m in methods:
    for k in ("var95", "var99", "es975"):
        m[k] = rnd(m[k], 0)
    m["var99_pct"] = rnd(m["var99"] / total * 100, 2) if m["var99"] else None

# ------------------------------------------------------------------ 3. VaR backtest (out of sample)
BT = 500
bt_rows = []
exc = {"hs": [], "ewma": [], "fhs": []}
s2 = float(np.var(pnl[T - BT - 300:T - BT]))
for t in range(T - BT, T):
    hist = pnl[t - 250:t]
    v_hs95, v_hs99 = -np.quantile(hist, .05), -np.quantile(hist, .01)
    sd_t = math.sqrt(s2)
    v_ew95, v_ew99 = 1.645 * sd_t, 2.326 * sd_t
    zz = hist / np.array([max(np.std(pnl[max(0, u - 60):u]), 1e-6) for u in range(t - 250, t)])
    v_f95, v_f99 = -np.quantile(zz, .05) * sd_t, -np.quantile(zz, .01) * sd_t
    x = pnl[t]
    for k, v95, v99 in (("hs", v_hs95, v_hs99), ("ewma", v_ew95, v_ew99), ("fhs", v_f95, v_f99)):
        exc[k].append((x < -v95, x < -v99))
    bt_rows.append({"date": cal[t].isoformat(), "pnl": rnd(x, 0), "var95": rnd(v_f95, 0), "var99": rnd(v_f99, 0),
                    "breach95": bool(x < -v_f95), "breach99": bool(x < -v_f99)})
    s2 = 0.94 * s2 + 0.06 * x * x
write("var_backtest", bt_rows, "Each day's forecast uses only data before that day. Plotted forecast is filtered historical simulation; P&L is today's book on that day's returns.")


def kupiec(x, n, p):
    if x == 0:
        return chi2_sf1(-2 * n * math.log(1 - p))
    ph = x / n
    lr = -2 * ((n - x) * math.log(1 - p) + x * math.log(p) - (n - x) * math.log(1 - ph) - x * math.log(ph))
    return chi2_sf1(lr)


def christoffersen(flags):
    n00 = n01 = n10 = n11 = 0
    for a, b in zip(flags, flags[1:]):
        if not a and not b: n00 += 1
        elif not a and b: n01 += 1
        elif a and not b: n10 += 1
        else: n11 += 1
    pi0 = n01 / max(n00 + n01, 1); pi1 = n11 / max(n10 + n11, 1); pi = (n01 + n11) / max(n00 + n01 + n10 + n11, 1)
    def ll(p, a, b): return (a * math.log(1 - p) if p < 1 and a else 0) + (b * math.log(p) if p > 0 and b else 0)
    lr = -2 * (ll(pi, n00 + n10, n01 + n11) - ll(pi0, n00, n01) - ll(pi1, n10, n11))
    return chi2_sf1(lr)


names = {"hs": "Historical simulation", "ewma": "EWMA normal (RiskMetrics)", "fhs": "Filtered historical"}
bt_sum = []
for k, flags in exc.items():
    f95 = [a for a, _ in flags]; f99 = [b for _, b in flags]
    x99_250 = sum(f99[-250:])
    light = "Green" if x99_250 <= 4 else "Yellow" if x99_250 <= 9 else "Red"
    p95, p99 = kupiec(sum(f95), len(f95), .05), kupiec(sum(f99), len(f99), .01)
    bt_sum.append({"method": names[k], "days": len(flags), "breaches95": int(sum(f95)), "expected95": rnd(0.05 * len(f95), 0),
                   "kupiec95_p": rnd(p95, 3), "indep95_p": rnd(christoffersen(f95), 3),
                   "breaches99": int(sum(f99)), "expected99": rnd(0.01 * len(f99), 0), "kupiec99_p": rnd(p99, 3),
                   "breaches99_250d": int(x99_250), "basel_light": light,
                   "verdict": "Passes" if min(p95, p99) > 0.05 and light == "Green" else "Fails"})
for m in methods:
    s = next((b for b in bt_sum if b["method"] == m["method"]), None)
    m["backtest"] = s["verdict"] if s else "Not backtested"
write("var_methods", methods, "1-day loss not exceeded on 95% / 99% of days, in dollars, for today's book. Expected shortfall is the average loss on the worst 2.5% of days (the Basel FRTB measure).")
write("var_backtest_summary", bt_sum, "Kupiec tests whether the breach count matches the confidence level; Christoffersen tests whether breaches cluster. p < 0.05 fails. Basel traffic light counts 99% breaches in the last 250 days: 0–4 green, 5–9 yellow, 10+ red.")

# forward ledger: record today's forecast; fill in yesterday's actual
ledger = os.path.join(paths.PRIVATE, "var_ledger.csv")
rows = list(csv.DictReader(open(ledger))) if os.path.exists(ledger) else []
book_today = {a["symbol"]: a["value"] for a in assets}
for r in rows:
    if r["actual_pnl"] == "" and r["for_date"] <= cal[-1].isoformat():
        d_ = dt.date.fromisoformat(r["for_date"])
        if d_ in cal:
            r["actual_pnl"] = f"{pnl[cal.index(d_)]:.0f}"
            r["breach95"] = str(float(r["actual_pnl"]) < -float(r["var95"]))
            r["breach99"] = str(float(r["actual_pnl"]) < -float(r["var99"]))
nxt = cal[-1] + dt.timedelta(days=1)
while nxt.weekday() >= 5:
    nxt += dt.timedelta(days=1)
fhs_now = next(m for m in methods if m["method"] == "Filtered historical")
if not any(r["for_date"] == nxt.isoformat() for r in rows):
    rows.append({"made_on": cal[-1].isoformat(), "for_date": nxt.isoformat(), "book_value": f"{total:.0f}",
                 "var95": f"{fhs_now['var95']:.0f}", "var99": f"{fhs_now['var99']:.0f}", "actual_pnl": "", "breach95": "", "breach99": ""})
with open(ledger, "w", newline="") as f:
    wr = csv.DictWriter(f, fieldnames=["made_on", "for_date", "book_value", "var95", "var99", "actual_pnl", "breach95", "breach99"])
    wr.writeheader(); wr.writerows(rows)
write("var_ledger", rows, "Live forecast log: each run records tomorrow's filtered-historical VaR, and the next run fills in what actually happened.")

# ------------------------------------------------------------------ 4. exit-rule backtest
COST = 0.0010
BT_TICKERS = ["SPY", "QQQ", "AMZN", "META", "MA", "UBER", "VST", "VRT", "IAU", "TQQQ", "TSLA", "NVDA", "COIN", "BTC-USD", "DOGE-USD"]
for s in BT_TICKERS:
    if s not in H:
        H[s] = fetch(s)


def run_rule(sym, rule):
    h = H[sym]
    ds = [d_ for d_ in cal if d_ in h]
    if len(ds) < 300:
        return None
    o = np.array([h[d_]["o"] for d_ in ds]); hi = np.array([h[d_]["h"] for d_ in ds])
    lo = np.array([h[d_]["l"] for d_ in ds]); c = np.array([h[d_]["c"] for d_ in ds])
    rfx = np.array([rf[cal.index(d_)] for d_ in ds])
    n = len(c)
    tr = np.maximum(hi[1:] - lo[1:], np.maximum(abs(hi[1:] - c[:-1]), abs(lo[1:] - c[:-1])))
    atr = np.full(n, np.nan); atr[14] = tr[:14].mean()
    for t in range(15, n):
        atr[t] = (atr[t - 1] * 13 + tr[t - 1]) / 14
    ma50 = np.convolve(c, np.ones(50) / 50, "full")[:n]; ma200 = np.convolve(c, np.ones(200) / 200, "full")[:n]
    eq, f, pend, target, trades, wins, entry_px = 1.0, 0.0, None, None, 0, 0, None
    curve, invested = [], 0
    for t in range(1, n):
        f_prev = f
        if pend is not None:  # execute at today's open
            gap = o[t] / c[t - 1] - 1
            eq *= 1 + f_prev * gap + (1 - f_prev) * rfx[t] * 0
            eq *= 1 - COST * abs(pend - f_prev)
            if pend > f_prev:
                entry_px, target = o[t], o[t] * math.exp(np.std(np.diff(np.log(c[max(0, t - 63):t]))) * math.sqrt(21)) if t > 64 else None
                trades += 1
            elif pend == 0 and entry_px:
                wins += o[t] > entry_px
            f = pend; pend = None
            day_r = c[t] / o[t] - 1
        else:
            day_r = c[t] / c[t - 1] - 1
        if rule == "scale" and f == 1.0 and target and hi[t] >= target:
            # limit sell of one third at the target
            pre = max(target, o[t]) / (o[t] if pend is None and f_prev != f else c[t - 1]) - 1
            post = c[t] / max(target, o[t]) - 1
            eq *= (1 + pre) * (1 - COST / 3) * (1 + (2 / 3) * post + (1 / 3) * 0)
            f = 2 / 3
        else:
            eq *= 1 + f * day_r + (1 - f) * rfx[t]
        curve.append(eq); invested += f > 0
        if t < 200 or np.isnan(atr[t]):
            continue
        trend = c[t] > ma50[t] > ma200[t]
        breakout = c[t] >= c[max(0, t - 21):t + 1].max()
        if rule == "hold":
            if f == 0 and pend is None:
                pend = 1.0
            continue
        k = 2.0 if rule == "tight" else 3.0
        stop = c[max(0, t - 21):t + 1].max() - k * atr[t]
        if f == 0 and trend and breakout:
            pend = 1.0
        elif f > 0 and c[t] < stop:
            pend = 0.0
    curve = np.array(curve)
    yrs = len(curve) / 252
    dr = np.diff(np.r_[1, curve]) / np.r_[1, curve][:-1]
    sharpe = (dr.mean() - rfx[1:].mean()) / dr.std() * math.sqrt(252) if dr.std() > 0 else 0
    peak = np.maximum.accumulate(curve); mdd = (curve / peak - 1).min()
    cagr = curve[-1] ** (1 / yrs) - 1
    return {"cagr": cagr, "vol": dr.std() * math.sqrt(252), "sharpe": sharpe, "mdd": mdd,
            "calmar": cagr / abs(mdd) if mdd < 0 else None, "time_in": invested / len(curve),
            "trades": trades, "win_rate": wins / trades if trades and rule != "hold" else None,
            "start": ds[0].isoformat(), "years": yrs}


RULES = [("hold", "Buy and hold"), ("wide", "Wide trailing stop (3×ATR) + trend re-entry"),
         ("tight", "Tight trailing stop (2×ATR) + trend re-entry"), ("scale", "Sell ⅓ at +1σ, trail rest at 3×ATR")]
rb = []
for s in BT_TICKERS:
    base = run_rule(s, "hold")
    if not base:
        continue
    for rid, rname in RULES:
        m = base if rid == "hold" else run_rule(s, rid)
        rb.append({"ticker": s, "rule": rname, "rule_id": rid, "key": f"{s}|{rid}", "since": m["start"], "years": rnd(m["years"], 1),
                   "cagr_pct": rnd(m["cagr"] * 100, 1), "vol_pct": rnd(m["vol"] * 100, 1), "sharpe": rnd(m["sharpe"], 2),
                   "max_dd_pct": rnd(m["mdd"] * 100, 1), "calmar": rnd(m["calmar"], 2), "time_in_pct": rnd(m["time_in"] * 100, 0),
                   "trades": int(m["trades"]), "win_rate_pct": rnd(m["win_rate"] * 100, 0) if m["win_rate"] is not None else None,
                   "sharpe_vs_hold": rnd(m["sharpe"] - base["sharpe"], 2), "dd_vs_hold_pct": rnd((m["mdd"] - base["mdd"]) * 100, 1),
                   "cagr_vs_hold_pct": rnd((m["cagr"] - base["cagr"]) * 100, 1)})
write("rule_backtest", rb, "Signals at the close, trades at the next open, 0.10% cost per side, cash earns the 13-week T-bill. Rule parameters were fixed before testing, not tuned. Buy-and-hold enters on day 200 so both start together.")
rs = []
for rid, rname in RULES[1:]:
    xs = [r for r in rb if r["rule_id"] == rid]
    rs.append({"rule": rname, "rule_id": rid, "tickers": len(xs),
               "beat_sharpe": int(sum(r["sharpe_vs_hold"] > 0 for r in xs)),
               "shallower_dd": int(sum(r["dd_vs_hold_pct"] > 0 for r in xs)),
               "beat_cagr": int(sum(r["cagr_vs_hold_pct"] > 0 for r in xs)),
               "median_sharpe_diff": rnd(float(np.median([r["sharpe_vs_hold"] for r in xs])), 2),
               "median_dd_diff_pct": rnd(float(np.median([r["dd_vs_hold_pct"] for r in xs])), 1),
               "median_cagr_diff_pct": rnd(float(np.median([r["cagr_vs_hold_pct"] for r in xs])), 1),
               "median_time_in_pct": rnd(float(np.median([r["time_in_pct"] for r in xs])), 0)})
write("rule_summary", rs, "How each rule did against buy-and-hold across all tested tickers. Positive drawdown difference means a shallower worst fall.")

# ------------------------------------------------------------------ 5. option
opt_rows = []
if opt:
    o = opt["option"]
    S0, K = o["underlying_price"], o["strike"]
    Tt = max((dt.date.fromisoformat(o["expiry"]) - cal[-1]).days, 1) / 365
    r_ = float(rf[-1] * 252); vol = o["iv"]
    d1 = (math.log(S0 / K) + (r_ + vol * vol / 2) * Tt) / (vol * math.sqrt(Tt)); d2 = d1 - vol * math.sqrt(Tt)
    bs = S0 * ncdf(d1) - K * math.exp(-r_ * Tt) * ncdf(d2)
    pdf = math.exp(-d1 * d1 / 2) / math.sqrt(2 * math.pi)
    nv = ninv  # noqa
    contracts = opt["qty"] * opt.get("multiplier", 100)
    up20 = S0 * 1.2; d1u = (math.log(up20 / K) + (r_ + vol * vol / 2) * Tt) / (vol * math.sqrt(Tt)); d2u = d1u - vol * math.sqrt(Tt)
    bs_up20 = up20 * ncdf(d1u) - K * math.exp(-r_ * Tt) * ncdf(d2u)
    opt_rows.append({"contract": opt["name"], "contracts": opt["qty"], "days_left": round(Tt * 365), "underlying": S0, "strike": K,
                     "implied_vol_pct": rnd(vol * 100, 0), "bs_value": rnd(bs, 3), "mark": o["mark"], "bid": o["bid"], "ask": o["ask"],
                     "position_mark_value": rnd(o["mark"] * contracts, 0), "position_liquidation_value": rnd(o["bid"] * contracts, 0),
                     "cost_paid": rnd(opt["cost"] * contracts, 0),
                     "delta": rnd(ncdf(d1), 4), "rh_delta": o["delta"], "gamma": rnd(pdf / (S0 * vol * math.sqrt(Tt)), 4),
                     "theta_per_day": rnd(-(S0 * pdf * vol) / (2 * math.sqrt(Tt)) / 365, 4), "vega_per_vol_pt": rnd(S0 * pdf * math.sqrt(Tt) / 100, 4),
                     "delta_dollars": rnd(o["delta"] * contracts * S0, 0), "value_if_up_20pct": rnd(bs_up20 * contracts, 0),
                     "prob_finish_itm_pct": rnd(ncdf(d2) * 100, 2), "rh_chance_of_profit_pct": rnd(o["chance_of_profit"] * 100, 2)})
write("option_risk", opt_rows, "Black-Scholes with Robinhood's implied volatility and the 13-week T-bill rate. Liquidation value uses the bid, which was zero.")

# ------------------------------------------------------------------ 6. organic limits (from the book's own history)
H2 = 504
roll_var = np.array([-np.quantile(pnl[t - 250:t], .01) for t in range(T - H2, T + 1)])
var_now = roll_var[-1]
rv = np.array([np.std(pnl[t - 63:t]) * math.sqrt(252) / total * 100 for t in range(T - H2, T + 1)])
path = np.cumsum(pnl[T - 756:])
peak = np.maximum.accumulate(path)
ddser = (path - peak) / total * 100
dd_now = ddser[-1]
# current drawdown from the 1-year peak of the replayed book
path1 = np.cumsum(pnl[T - 252:]); dd1 = float((path1[-1] - path1.max()) / total * 100)
conc = [(a["symbol"], r["risk_contrib_pct"], a["value"] / total * 100) for a, r in
        ((a, next(x for x in asset_rows if x["symbol"] == a["symbol"])) for a in assets) if a["value"] / total > 0.01]
worst = max(conc, key=lambda c: c[1] / max(c[2], 0.1))


def lim(name, cur, limit, unit, basis, higher_bad=True):
    u = cur / limit * 100 if limit else None
    st = "Breach" if u and u > 100 else "Watch" if u and u > 80 else "OK"
    return {"limit": name, "current": rnd(cur, 2), "limit_value": rnd(limit, 2), "unit": unit, "utilization_pct": rnd(u, 0), "status": st, "basis": basis}


limits = [
    lim("1-in-100 bad day", var_now, float(np.quantile(roll_var, .9)), "$",
        f"Limit = the 90th percentile of this book's own 99% one-day loss over the last two years (median ${np.median(roll_var):,.0f})."),
    lim("Volatility (last 3 months)", rv[-1], float(np.quantile(rv, .9)), "%/yr",
        f"Limit = the 90th percentile of the book's own rolling 3-month volatility over two years (median {np.median(rv):.1f}%)."),
    lim("Drawdown from 1-year high", -dd1, float(-np.quantile(ddser, .1)), "% of account",
        "Limit = a drawdown depth the book went past on only 1 in 10 days over three years of replayed history."),
    lim("Most concentrated holding (" + worst[0] + ")", worst[1] / max(worst[2], 0.1), 2.0, "× its money share",
        f"{worst[0]} carries {worst[1]:.1f}% of risk on {worst[2]:.1f}% of the money. Limit: no holding drives more than twice its capital share."),
]
write("limits", limits, "Organic limits: each is set from this portfolio's own history, so 100% means as stretched as the book gets in a bad 1-in-10 stretch. Not imposed targets.")

# ------------------------------------------------------------------ 7. P&L attribution of today's book
yr0 = next(i for i, d_ in enumerate(cal) if d_.year == cal[-1].year)
periods = [("1 day", T - 1), ("1 week", T - 5), ("1 month", T - 21), ("3 months", T - 63), ("Year to date", yr0)]
GROUPS = ["Market", "Style", "Sector", "Macro", "Crypto"]
attr_rows, hold_rows = [], []
for pname, t0 in periods:
    sl = slice(t0, T)
    tot = float(AR[sl] @ wv @ np.ones(1)) if False else float((AR[sl] @ wv).sum())
    fac_pnl = np.nan_to_num(Fr[sl]) @ bport
    by_k = np.nan_to_num(Fr[sl]).sum(axis=0) * bport
    row = {"period": pname, "total": rnd(tot, 0)}
    for g in GROUPS:
        row[g.lower()] = rnd(sum(by_k[k] for k, f in enumerate(FACTORS) if f[2] == g), 0)
    row["specific"] = rnd(tot - float(fac_pnl.sum()), 0)
    top = sorted(((FACTORS[k][1], by_k[k]) for k in range(len(FACTORS))), key=lambda x: -abs(x[1]))[:3]
    row["top_factors"] = "; ".join(f"{n} {'+' if v >= 0 else '−'}${abs(v):,.0f}" for n, v in top)
    attr_rows.append(row)
    for i, a in enumerate(assets):
        hold_rows.append({"period": pname, "symbol": a["symbol"], "key": f"{pname}|{a['symbol']}", "pnl": rnd(float((AR[sl, i] * wv[i]).sum()), 0)})
write("attribution", attr_rows, "Today's holdings at today's dollar sizes, run through each day's actual returns. Factor P&L = each day's factor returns × the book's factor exposures; company-specific = the rest. Trades you made during the period are not reflected.")
write("attribution_holdings", hold_rows)

hs = next(m for m in methods if m["method"] == "Historical simulation")
summary = [{"total_value": rnd(total, 0), "model_vol_pct": rnd(math.sqrt(tot_var * 252) / total * 100, 1),
            "factor_share_pct": rnd(fac_var / tot_var * 100, 0), "specific_share_pct": rnd(spec_var_p / tot_var * 100, 0),
            "var99_hs": hs["var99"], "es975_hs": hs["es975"], "var99_fhs": fhs_now["var99"],
            "stressed_var99": next(m for m in methods if m["method"].startswith("Stressed"))["var99"],
            "skew": rnd(sk, 2), "excess_kurtosis": rnd(ku, 1), "factors": len(FACTORS), "asof": cal[-1].isoformat(),
            "proxied_days_bmnr": proxied.get("BMNR", 0)}]
write("risk_summary", summary)
print(json.dumps(summary[0]))
print(json.dumps(bt_sum, indent=0))
print(json.dumps(rs, indent=0))
for m in methods: print(m["method"], m["var95"], m["var99"], m["es975"], m["backtest"])
for r in fac_rows[:10]: print(r["label"], r["exposure"], r["risk_contrib_pct"])
for r in stress_rows: print(r)
print(opt_rows)
