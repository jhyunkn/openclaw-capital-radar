"""Library-backed analytics for the risk lab: established open-source tools replacing or checking hand-written code.

Run after risk_engine.py (needs out-private/book_series.csv):  python advanced_engine.py OUT_DIR
Requires the risk lab's Python 3.12 environment (risk-lab/requirements-full.txt).

- arch            GJR-GARCH(1,1) with Student-t errors: a 7th loss forecast, backtested out of sample like the others
- quantstats      Professional performance statistics for today's book vs SPY, plus monthly returns
- Riskfolio-Lib   Risk-parity and minimum-CVaR mixes of today's holdings, with each mix's risk numbers
- PyPortfolioOpt  Efficient frontier with Ledoit-Wolf shrinkage, and where today's mix sits on it
- vectorbt        Independent re-run of the wide trailing-stop exit rule, compared with the hand-written backtest
- yfinance, ccxt  Independent price sources to cross-check the prices every other engine uses
"""
import json, math, os, sys, warnings, datetime as dt
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths
import numpy as np
import pandas as pd

OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read()
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
LIBS = {}


def write(name, rows, note):
    meta = [{"label": "advanced_engine.py", "value": SRC, "type": "code", "lang": "python"}, {"label": "Computed", "value": NOW},
            {"label": "Libraries", "value": ", ".join(f"{k} {v}" for k, v in LIBS.items())}, {"label": "Method", "value": note}]
    json.dump({"rows": rows, "meta": meta}, open(os.path.join(OUT, name + ".json"), "w"), allow_nan=False, default=float)


def rnd(x, n=2):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if not math.isfinite(x) else round(x, n)


bs = pd.read_csv(os.path.join(paths.OUT_PRIVATE, "book_series.csv"), parse_dates=["date"]).set_index("date")
meta = json.load(open(os.path.join(paths.OUT_PRIVATE, "book_meta.json")))
TOTAL = meta["total"]
book_ret = bs["book_pnl"] / TOTAL
spy_ret = bs["spy_ret"]
assets = [c for c in bs.columns if c not in ("book_pnl", "spy_ret")]
status = []


def step(name, fn):
    try:
        fn(); status.append({"step": name, "status": "ok", "detail": ""})
    except Exception as e:  # one library failing never blocks the others
        status.append({"step": name, "status": "failed", "detail": f"{type(e).__name__}: {str(e)[:200]}"})
        print("FAILED", name, e)


# ---------------------------------------------------------------- arch: GJR-GARCH-t VaR, backtested
def chi2_sf1(x):
    return math.erfc(math.sqrt(max(x, 0) / 2))


def kupiec(x, n, p):
    if x == 0:
        return chi2_sf1(-2 * n * math.log(1 - p))
    ph = x / n
    return chi2_sf1(-2 * ((n - x) * math.log(1 - p) + x * math.log(p) - (n - x) * math.log(1 - ph) - x * math.log(ph)))


def christoffersen(f):
    c = {(a, b): 0 for a in (0, 1) for b in (0, 1)}
    for a, b in zip(f, f[1:]):
        c[(int(a), int(b))] += 1
    p0 = c[(0, 1)] / max(c[(0, 0)] + c[(0, 1)], 1); p1 = c[(1, 1)] / max(c[(1, 0)] + c[(1, 1)], 1)
    p = (c[(0, 1)] + c[(1, 1)]) / max(sum(c.values()), 1)
    ll = lambda q, a, b: (a * math.log(1 - q) if q < 1 and a else 0) + (b * math.log(q) if q > 0 and b else 0)
    return chi2_sf1(-2 * (ll(p, c[(0, 0)] + c[(1, 0)], c[(0, 1)] + c[(1, 1)]) - ll(p0, c[(0, 0)], c[(0, 1)]) - ll(p1, c[(1, 0)], c[(1, 1)])))


def run_garch():
    import arch
    from arch import arch_model
    LIBS["arch"] = arch.__version__
    r = (book_ret * 100).values
    BT, WIN, REFIT = 500, 1000, 21
    T = len(r); start = T - BT
    v95, v99, act = [], [], []
    for k in range(start, T, REFIT):
        seg = r[k - WIN: min(T, k + REFIT)]
        am = arch_model(seg, mean="Constant", vol="GARCH", p=1, o=1, q=1, dist="t")
        res = am.fit(last_obs=WIN, disp="off")
        fc = res.forecast(horizon=1, start=WIN - 1, reindex=False)
        sig = np.sqrt(fc.variance.values[:, 0]); mu = res.params["mu"]; nu = res.params["nu"]
        q95, q99 = am.distribution.ppf([0.05, 0.01], [nu])
        n = min(REFIT, T - k)
        for j in range(n):
            v95.append(-(mu + sig[j] * q95)); v99.append(-(mu + sig[j] * q99)); act.append(r[k + j])
    v95, v99, act = np.array(v95), np.array(v99), np.array(act)
    b95, b99 = act < -v95, act < -v99
    am = arch_model(r[-WIN:], mean="Constant", vol="GARCH", p=1, o=1, q=1, dist="t")
    res = am.fit(disp="off")
    s_next = float(np.sqrt(res.forecast(horizon=1, reindex=False).variance.values[-1, 0]))
    nu = float(res.params["nu"]); mu = float(res.params["mu"])
    q95, q99, q975 = am.distribution.ppf([0.05, 0.01, 0.025], [nu])
    var95, var99 = -(mu + s_next * q95) / 100 * TOTAL, -(mu + s_next * q99) / 100 * TOTAL
    sims = am.distribution.simulate([nu])(200000)
    tail = sims[sims <= q975]
    es975 = -(mu + s_next * tail.mean()) / 100 * TOTAL
    x99 = int(b99[-250:].sum())
    p95, p99 = kupiec(int(b95.sum()), len(b95), .05), kupiec(int(b99.sum()), len(b99), .01)
    light = "Green" if x99 <= 4 else "Yellow" if x99 <= 9 else "Red"
    write("garch_var", [{"method": "GJR-GARCH-t (arch)", "var95": rnd(var95, 0), "var99": rnd(var99, 0), "var99_pct": rnd(var99 / TOTAL * 100, 2),
                         "es975": rnd(es975, 0), "days": len(act), "breaches95": int(b95.sum()), "expected95": 25, "kupiec95_p": rnd(p95, 3),
                         "indep95_p": rnd(christoffersen(b95), 3), "breaches99": int(b99.sum()), "expected99": 5, "kupiec99_p": rnd(p99, 3),
                         "breaches99_250d": x99, "basel_light": light, "verdict": "Passes" if min(p95, p99) > 0.05 and light == "Green" else "Fails",
                         "persistence": rnd(res.params["alpha[1]"] + res.params["beta[1]"] + res.params["gamma[1]"] / 2, 3),
                         "leverage_gamma": rnd(res.params["gamma[1]"], 3), "tail_nu": rnd(nu, 1),
                         "vol_next_day_pct": rnd(s_next, 2), "vol_annual_pct": rnd(s_next * math.sqrt(252), 1)}],
          "GJR-GARCH(1,1) with Student-t errors on the book's daily returns (2-year window), refit every 21 days. Each forecast uses only earlier data. "
          "Gamma > 0 means losses raise volatility more than gains; nu is tail heaviness (lower = fatter).")


# ---------------------------------------------------------------- quantstats: performance tear sheet
def run_quantstats():
    import quantstats as qs
    LIBS["quantstats"] = qs.__version__
    r = book_ret.copy(); b = spy_ret.copy()
    r.index = pd.to_datetime(r.index); b.index = r.index
    rows = []
    for label, fn in [("CAGR", qs.stats.cagr), ("Volatility (annual)", qs.stats.volatility), ("Sharpe", qs.stats.sharpe), ("Sortino", qs.stats.sortino),
                      ("Max drawdown", qs.stats.max_drawdown), ("Calmar", qs.stats.calmar), ("Daily VaR 95%", qs.stats.value_at_risk),
                      ("Daily CVaR 95%", qs.stats.conditional_value_at_risk), ("Win rate (days)", qs.stats.win_rate),
                      ("Best day", qs.stats.best), ("Worst day", qs.stats.worst), ("Skew", qs.stats.skew), ("Kurtosis", qs.stats.kurtosis),
                      ("Tail ratio", qs.stats.tail_ratio), ("Ulcer index", qs.stats.ulcer_index)]:
        bv, sv = fn(r), fn(b)
        pct = label not in ("Sharpe", "Sortino", "Calmar", "Skew", "Kurtosis", "Tail ratio", "Ulcer index")
        rows.append({"metric": label, "book": rnd(bv * 100 if pct else bv, 2), "spy": rnd(sv * 100 if pct else sv, 2), "unit": "%" if pct else ""})
    g = qs.stats.greeks(r, b)
    rows.append({"metric": "Beta to SPY", "book": rnd(g["beta"], 2), "spy": 1.0, "unit": ""})
    rows.append({"metric": "Alpha (annual)", "book": rnd(g["alpha"] * 100, 2), "spy": 0.0, "unit": "%"})
    write("perf_stats", rows, "quantstats statistics for today's holdings replayed at constant dollar size since 2019, against SPY. A replay, not your actual account history.")
    mr = (1 + r).groupby([r.index.year, r.index.month]).prod() - 1
    ms = (1 + b).groupby([b.index.year, b.index.month]).prod() - 1
    write("monthly_returns", [{"year": int(y), "month": int(m), "key": f"{y}-{m:02d}", "book_pct": rnd(v * 100, 1), "spy_pct": rnd(ms[(y, m)] * 100, 1)} for (y, m), v in mr.items()],
          "Monthly compounded returns of the replayed book and SPY.")


# ---------------------------------------------------------------- Riskfolio-Lib + PyPortfolioOpt
def holdings_returns():
    vals = meta["values"]
    keep = [a for a in assets if a in vals and vals[a] / TOTAL > 0.005]
    R = bs[keep].iloc[-504:]
    w = np.array([vals[a] for a in keep]); w = w / w.sum()
    return R, pd.Series(w, index=keep)


def run_riskfolio():
    import riskfolio as rp
    LIBS["Riskfolio-Lib"] = rp.__version__ if hasattr(rp, "__version__") else "7.x"
    R, w0 = holdings_returns()
    port = rp.Portfolio(returns=R)
    port.assets_stats(method_mu="hist", method_cov="ledoit")
    mixes = {"Current": w0}
    w_rp = port.rp_optimization(model="Classic", rm="MV", rf=0, b=None, hist=True)
    mixes["Risk parity"] = w_rp["weights"]
    w_cv = port.optimization(model="Classic", rm="CVaR", obj="MinRisk", rf=0, l=0, hist=True)
    mixes["Min CVaR"] = w_cv["weights"]
    cov = port.cov.values
    out_w, out_s = [], []
    for name, w in mixes.items():
        w = w.reindex(R.columns).fillna(0).values.flatten()
        pr = R.values @ w
        vol = math.sqrt(w @ cov @ w * 252)
        rc = w * (cov @ w) / (w @ cov @ w)
        q = np.quantile(pr, 0.05)
        out_s.append({"mix": name, "vol_pct": rnd(vol * 100, 1), "cvar95_daily_pct": rnd(-pr[pr <= q].mean() * 100, 2),
                      "max_risk_share_pct": rnd(rc.max() * 100, 1), "max_risk_holding": R.columns[int(rc.argmax())],
                      "hist_return_pct": rnd(((1 + pr).prod() ** (252 / len(pr)) - 1) * 100, 1)})
        for a, wi, ri in zip(R.columns, w, rc):
            out_w.append({"mix": name, "symbol": a, "key": f"{name}|{a}", "weight_pct": rnd(wi * 100, 1), "risk_share_pct": rnd(ri * 100, 1)})
    write("mix_weights", out_w, "Riskfolio-Lib, last 2 years of daily returns, Ledoit-Wolf covariance. Risk parity equalizes each holding's risk share; Min CVaR minimizes the average loss on the worst 5% of days. Long-only, fully invested, same holdings. These are reference mixes, not recommendations.")
    write("mix_stats", out_s, "Annual volatility, average loss on the worst 5% of days, largest single-holding risk share and historical return for each mix. Past returns are a weak guide; the risk columns are the robust part.")


def run_pypfopt():
    from pypfopt import EfficientFrontier, risk_models, expected_returns
    import pypfopt
    LIBS["PyPortfolioOpt"] = pypfopt.__version__
    R, w0 = holdings_returns()
    prices = (1 + R).cumprod()
    mu = expected_returns.mean_historical_return(prices, frequency=252)
    mu = 0.5 * mu + 0.5 * mu.mean()  # shrink noisy historical means halfway to the cross-sectional mean
    S = risk_models.CovarianceShrinkage(prices, frequency=252).ledoit_wolf()
    pts = []
    ef0 = EfficientFrontier(mu, S)
    ef0.min_volatility(); r_min, v_min, _ = ef0.portfolio_performance()
    for target in np.linspace(v_min * 1.001, float(np.sqrt(np.diag(S)).max()) * 0.95, 18):
        ef = EfficientFrontier(mu, S)
        try:
            ef.efficient_risk(target); r_, v_, _ = ef.portfolio_performance(); pts.append({"vol_pct": rnd(v_ * 100, 2), "ret_pct": rnd(r_ * 100, 2), "kind": "frontier"})
        except Exception:
            pass
    cur_v = math.sqrt(w0.values @ S.values @ w0.values); cur_r = float(w0.values @ mu.values)
    pts.append({"vol_pct": rnd(cur_v * 100, 2), "ret_pct": rnd(cur_r * 100, 2), "kind": "current"})
    ef = EfficientFrontier(mu, S); ef.efficient_risk(cur_v); r_s, v_s, _ = ef.portfolio_performance()
    pts.append({"vol_pct": rnd(v_s * 100, 2), "ret_pct": rnd(r_s * 100, 2), "kind": "same-risk frontier"})
    write("frontier", pts, "PyPortfolioOpt efficient frontier for today's holdings: Ledoit-Wolf covariance, historical mean returns shrunk halfway toward their average. Expected returns are the weakest input; read the frontier as risk-efficiency, not a return forecast.")


# ---------------------------------------------------------------- vectorbt: independent exit-rule check
def run_vectorbt():
    import vectorbt as vbt
    LIBS["vectorbt"] = vbt.__version__
    mine = {r["ticker"]: r for r in json.load(open(os.path.join(OUT, "rule_backtest.json")))["rows"] if r["rule_id"] == "wide"}
    rows = []
    for sym in mine:
        path = os.path.join(paths.CACHE, sym.replace("^", "_").replace("=", "_") + ".json")
        if not os.path.exists(path):
            continue
        d = json.load(open(path))
        df = pd.DataFrame(d).T; df.index = pd.to_datetime(df.index); df = df.sort_index().astype(float)
        c, h, l, o = df["c"], df["h"], df["l"], df["o"]
        tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
        atr = tr.ewm(alpha=1 / 14, adjust=False).mean()
        ma50, ma200 = c.rolling(50).mean(), c.rolling(200).mean()
        hi22 = c.rolling(22).max()
        entries = (c > ma50) & (ma50 > ma200) & (c >= hi22)
        exits = c < (hi22 - 3 * atr)
        entries.iloc[:200] = False
        pf = vbt.Portfolio.from_signals(o, entries.shift(1, fill_value=False), exits.shift(1, fill_value=False), fees=0.001, freq="1D")
        years = len(c) / 252
        cagr = (pf.total_return() + 1) ** (1 / years) - 1
        m = mine[sym]
        rows.append({"ticker": sym, "vbt_cagr_pct": rnd(cagr * 100, 1), "mine_cagr_pct": m["cagr_pct"], "vbt_max_dd_pct": rnd(pf.max_drawdown() * 100, 1),
                     "mine_max_dd_pct": m["max_dd_pct"], "vbt_trades": int(pf.trades.count()), "mine_trades": m["trades"],
                     "cagr_gap_pts": rnd(cagr * 100 - m["cagr_pct"], 1)})
    write("rules_crosscheck", rows, "vectorbt re-runs the wide trailing-stop rule (22-day high minus 3×ATR, trend re-entry, next-open fills, 0.10% fees) independently. "
          "vectorbt does not credit T-bill interest on idle cash, so its returns should sit slightly below the hand-written engine's; large gaps would flag a bug.")


# ---------------------------------------------------------------- yfinance + ccxt: price cross-checks
def run_datacheck():
    import yfinance as yf, ccxt
    LIBS["yfinance"] = yf.__version__; LIBS["ccxt"] = ccxt.__version__
    pos = json.load(open(paths.POSITIONS))["positions"]
    rows = []
    syms = [p["yahoo"] for p in pos if p.get("yahoo") and not p["yahoo"].endswith("-USD")]
    hist = yf.download(syms, period="5d", interval="1d", auto_adjust=False, progress=False, threads=False)["Close"]
    for p in pos:
        s = p.get("yahoo")
        if not s or s.endswith("-USD"):
            continue
        ser = hist[s].dropna()
        if len(ser):
            v = float(ser.iloc[-1]); rows.append({"symbol": p["symbol"], "source": "yfinance", "price_used": p["price"], "check_price": rnd(v, 4),
                                                   "gap_pct": rnd((p["price"] / v - 1) * 100, 2), "check_date": str(ser.index[-1].date())})
    ex = ccxt.coinbase()
    for p in pos:
        s = p.get("yahoo") or ""
        if s.endswith("-USD"):
            o = ex.fetch_ohlcv(s.replace("-USD", "/USD"), "1d", limit=3)
            v = o[-1][4]
            rows.append({"symbol": p["symbol"], "source": "ccxt · Coinbase", "price_used": p["price"], "check_price": rnd(v, 6),
                         "gap_pct": rnd((p["price"] / v - 1) * 100, 2), "check_date": dt.datetime.fromtimestamp(o[-1][0] / 1000, dt.timezone.utc).date().isoformat()})
    for r in rows:
        r["status"] = "OK" if abs(r["gap_pct"] or 0) < 1 else "Check" if abs(r["gap_pct"] or 0) < 3 else "Mismatch"
    write("data_check", rows, "Every holding's price as used by the engines, compared with an independent source: yfinance for stocks and ETFs, ccxt (Coinbase) for crypto. "
          "Gaps usually mean the position sync ran intraday while the check uses the latest close.")


step("arch GARCH", run_garch)
step("quantstats", run_quantstats)
step("Riskfolio-Lib", run_riskfolio)
step("PyPortfolioOpt", run_pypfopt)
step("vectorbt", run_vectorbt)
step("yfinance + ccxt", run_datacheck)
write("library_status", status, "Which library steps ran this build. A failed step leaves its previous output in place.")
for s in status:
    print(f"{s['status']:7} {s['step']:16} {s['detail']}")
