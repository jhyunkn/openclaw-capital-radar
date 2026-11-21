"""Portfolio risk & profit-taking analytics for the Portfolio War Room dashboard.

Inputs : positions.json (synced from Robinhood) in the same folder.
Prices : Yahoo Finance v8 chart API, daily OHLC since 2019.
Output : one JSON file per dataset, each {rows, meta}, into argv[1].
Run    : python3 -I analyze_portfolio.py OUT_DIR

Everything here is descriptive arithmetic on public prices. Exit levels are the
output of fixed, stated rules (ATR chandelier stops, volatility bands), not advice.
"""
import json, math, os, sys, statistics as st, datetime as dt, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read()
POS = json.load(open(paths.POSITIONS))
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
UA = {"User-Agent": "Mozilla/5.0"}


def fetch(sym):
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
            c = d["meta"].get("regularMarketPrice")  # latest bar's close not yet filled in
        if a is None:
            a = c  # today's bar has no adjusted close yet
        if None in (h, l, c, a):
            continue
        day = dt.datetime.fromtimestamp(t, dt.timezone.utc).date()
        rows[day] = {"h": h, "l": l, "c": c, "a": a}
    return rows


def write(name, rows, extra=None):
    meta = [{"label": "analyze_portfolio.py", "value": SRC, "type": "code", "lang": "python"},
            {"label": "Computed", "value": NOW},
            {"label": "Positions", "value": POS["source"] + " · synced " + POS["syncedAt"]},
            {"label": "Prices", "value": "Yahoo Finance daily OHLC (adjusted closes for returns)"}]
    if extra:
        meta.append({"label": "Note", "value": extra})
    with open(os.path.join(OUT, name + ".json"), "w") as f:
        json.dump({"rows": rows, "meta": meta}, f, allow_nan=False)


def r2(x, n=2):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(x, n)


# ---------- price history ----------
held = [p for p in POS["positions"] if p["yahoo"]]
symbols = sorted({p["yahoo"] for p in held} | {"QQQ", "BTC-USD", "SPY", "TSLA", "COIN", "NVDA", "NVDX"})
H = {s: fetch(s) for s in symbols}

# Equity trading calendar = SPY dates; crypto sampled on those dates.
cal = sorted(H["SPY"])
last = cal[-1]


def closes(sym, field="a"):
    h = H[sym]
    out, prev = [], None
    for d_ in cal:
        if d_ in h:
            prev = h[d_][field]
        out.append(prev)
    return out


A = {s: closes(s) for s in symbols}
N = 252
idx = list(range(len(cal) - N, len(cal)))


def rets(sym, ix):
    a = A[sym]
    return [math.log(a[i] / a[i - 1]) if a[i] and a[i - 1] else None for i in ix]


def ols2(y, x1, x2):
    """y = a + b1 x1 + b2 x2 ; returns b1, b2, r2."""
    rows = [(a, b, c) for a, b, c in zip(y, x1, x2) if None not in (a, b, c)]
    n = len(rows)
    my = sum(r[0] for r in rows) / n; m1 = sum(r[1] for r in rows) / n; m2 = sum(r[2] for r in rows) / n
    s11 = sum((r[1] - m1) ** 2 for r in rows); s22 = sum((r[2] - m2) ** 2 for r in rows)
    s12 = sum((r[1] - m1) * (r[2] - m2) for r in rows)
    s1y = sum((r[1] - m1) * (r[0] - my) for r in rows); s2y = sum((r[2] - m2) * (r[0] - my) for r in rows)
    det = s11 * s22 - s12 ** 2
    b1 = (s1y * s22 - s2y * s12) / det
    b2 = (s2y * s11 - s1y * s12) / det
    sst = sum((r[0] - my) ** 2 for r in rows)
    sse = sum((r[0] - my - b1 * (r[1] - m1) - b2 * (r[2] - m2)) ** 2 for r in rows)
    return b1, b2, 1 - sse / sst


RQ, RB = rets("QQQ", idx), rets("BTC-USD", idx)

# ---------- holdings ----------
total_invested = sum(p["qty"] * p["price"] * p.get("multiplier", 1) for p in POS["positions"])
total = total_invested + POS["cash"]
holdings, R = [], {}
for p in POS["positions"]:
    mult = p.get("multiplier", 1)
    value = p["qty"] * p["price"] * mult
    cost = p["qty"] * p["cost"] * mult
    row = {"symbol": p["symbol"], "name": p["name"], "bucket": p["bucket"], "qty": r2(p["qty"], 4),
           "avg_cost": p["cost"], "price": p["price"], "value": r2(value), "cost_basis": r2(cost),
           "pnl": r2(value - cost), "pnl_pct": r2((value / cost - 1) * 100, 1), "weight_pct": r2(value / total * 100, 1),
           "leverage": p["lev"]}
    if p["yahoo"]:
        y = rets(p["yahoo"], idx)
        R[p["symbol"]] = y
        bq, bb, rsq = ols2(y, RQ, RB)
        vol = st.pstdev([v for v in y if v is not None]) * math.sqrt(252) * 100
        hi = max(H[p["yahoo"]][d_]["c"] for d_ in cal[-N:] if d_ in H[p["yahoo"]])
        row.update({"beta_nasdaq": r2(bq), "beta_bitcoin": r2(bb), "r2": r2(rsq), "vol_1y_pct": r2(vol, 0),
                    "off_52w_high_pct": r2((p["price"] / hi - 1) * 100, 1),
                    "nasdaq_dollar_beta": r2(value * bq, 0), "lookthrough_value": r2(value * max(p["lev"], 1), 0)})
    else:
        row.update({"beta_nasdaq": None, "beta_bitcoin": None, "r2": None, "vol_1y_pct": None,
                    "off_52w_high_pct": None, "nasdaq_dollar_beta": 0, "lookthrough_value": r2(value, 0)})
    holdings.append(row)

# risk contribution (covariance of last-year daily log returns, current weights)
names = list(R)
w = {s: next(h["value"] for h in holdings if h["symbol"] == s) / total for s in names}
cov = {}
for a in names:
    for b in names:
        pa = [(x, y) for x, y in zip(R[a], R[b]) if x is not None and y is not None]
        ma = sum(x for x, _ in pa) / len(pa); mb = sum(y for _, y in pa) / len(pa)
        cov[a, b] = sum((x - ma) * (y - mb) for x, y in pa) / len(pa)
port_var = sum(w[a] * w[b] * cov[a, b] for a in names for b in names)
for h in holdings:
    s = h["symbol"]
    h["risk_share_pct"] = r2(w[s] * sum(w[b] * cov[s, b] for b in names) / port_var * 100, 1) if s in w else 0.0
holdings.sort(key=lambda h: -h["value"])
write("holdings", holdings)

# ---------- historical replay of today's holdings (constant shares) ----------
port_series, daily_pnl = [], []
for k, i in enumerate(idx):
    v = POS["cash"] + sum(p["qty"] * A[p["yahoo"]][i] for p in held)
    port_series.append(v)
scale = total / port_series[-1]  # align replay to today's marked value
replay = []
spy0, p0 = A["SPY"][idx[0]], port_series[0]
for k, i in enumerate(idx):
    replay.append({"date": cal[i].isoformat(), "portfolio": r2(port_series[k] / p0 * 100),
                   "spy": r2(A["SPY"][i] / spy0 * 100)})
write("replay", replay, "Today's share counts held constant over the past year, indexed to 100. Shows how this mix would have behaved, not your actual account history.")

port_rets = [port_series[k] / port_series[k - 1] - 1 for k in range(1, len(port_series))]
srt = sorted(port_rets)
var95 = -srt[int(0.05 * len(srt))] * total
worst = -srt[0] * total
peak, mdd = port_series[0], 0
for v in port_series:
    peak = max(peak, v); mdd = min(mdd, v / peak - 1)
port_vol = math.sqrt(port_var * 252) * 100
beta_q = sum(h["nasdaq_dollar_beta"] or 0 for h in holdings) / total
beta_b = sum((h["beta_bitcoin"] or 0) * h["value"] for h in holdings) / total
gross_lookthrough = sum(h["lookthrough_value"] for h in holdings)
summary = [{"total_value": r2(total), "invested": r2(total_invested), "cash": r2(POS["cash"]),
            "cash_pct": r2(POS["cash"] / total * 100, 1),
            "unrealized_pnl": r2(sum(h["pnl"] for h in holdings)),
            "unrealized_pnl_pct": r2(sum(h["pnl"] for h in holdings) / sum(h["cost_basis"] for h in holdings) * 100, 1),
            "vol_1y_pct": r2(port_vol, 1), "beta_nasdaq": r2(beta_q), "beta_bitcoin": r2(beta_b),
            "var95_1d": r2(var95, 0), "worst_day_1y": r2(worst, 0), "max_drawdown_1y_pct": r2(mdd * 100, 1),
            "lookthrough_exposure": r2(gross_lookthrough, 0), "effective_leverage": r2(gross_lookthrough / total, 2),
            "asof": last.isoformat()}]
write("summary", summary)

# ---------- look-through exposure by theme ----------
buckets = {}
for h in holdings:
    b = buckets.setdefault(h["bucket"], {"bucket": h["bucket"], "value": 0, "lookthrough": 0, "symbols": []})
    b["value"] += h["value"]; b["lookthrough"] += h["lookthrough_value"]; b["symbols"].append(h["symbol"])
exposure = sorted(({"bucket": b["bucket"], "value": r2(b["value"], 0), "lookthrough": r2(b["lookthrough"], 0),
                    "pct_of_portfolio": r2(b["value"] / total * 100, 1), "lookthrough_pct": r2(b["lookthrough"] / total * 100, 1),
                    "symbols": ", ".join(b["symbols"])} for b in buckets.values()), key=lambda r: -r["lookthrough"])
write("exposure", exposure, "Look-through counts a 3x ETF at three times its market value, a 2x ETF at twice.")

# ---------- scenarios ----------
def window_move(sym, a, b):
    s = H[sym]
    da = max(d_ for d_ in s if d_ <= a); db = max(d_ for d_ in s if d_ <= b)
    return s[db]["a"] / s[da]["a"] - 1


def estimate(q, b):
    pnl = 0
    for h in holdings:
        if h["beta_nasdaq"] is None:
            pnl += -h["value"] if q < 0 else 0  # option: assume worthless on a selloff
            continue
        r = math.exp(h["beta_nasdaq"] * math.log(1 + q) + h["beta_bitcoin"] * math.log(1 + b)) - 1
        pnl += h["value"] * max(r, -1)
    return pnl


month_ago = cal[-22]
actual_month = sum(p["qty"] * (A[p["yahoo"]][-1] - A[p["yahoo"]][-22]) for p in held)
HIST = [("COVID crash", dt.date(2020, 2, 19), dt.date(2020, 3, 23)),
        ("2022 bear market", dt.date(2021, 11, 19), dt.date(2022, 12, 28)),
        ("Aug 2024 yen-carry unwind", dt.date(2024, 7, 10), dt.date(2024, 8, 5)),
        ("Apr 2025 tariff shock", dt.date(2025, 4, 2), dt.date(2025, 4, 8)),
        ("Last month (model check)", month_ago, last)]
scen = []
for name, a, b in HIST:
    q, bt = window_move("QQQ", a, b), window_move("BTC-USD", a, b)
    pnl = estimate(q, bt)
    row = {"scenario": name, "kind": "Historical replay", "window": f"{a.isoformat()} to {b.isoformat()}",
           "nasdaq_move_pct": r2(q * 100, 1), "bitcoin_move_pct": r2(bt * 100, 1),
           "est_pnl": r2(pnl, 0), "est_pct": r2(pnl / total * 100, 1), "actual_pnl": None}
    if name.startswith("Last month"):
        row["actual_pnl"] = r2(actual_month, 0)
    scen.append(row)
for name, q, bt in [("Nasdaq −10%, Bitcoin −20%", -.10, -.20), ("Nasdaq −20%, Bitcoin −40%", -.20, -.40),
                    ("Nasdaq +10%, Bitcoin +25% (relief rally)", .10, .25), ("Nasdaq +20%, Bitcoin +50% (melt-up)", .20, .50)]:
    pnl = estimate(q, bt)
    scen.append({"scenario": name, "kind": "Hypothetical", "window": "instant shock",
                 "nasdaq_move_pct": q * 100, "bitcoin_move_pct": bt * 100,
                 "est_pnl": r2(pnl, 0), "est_pct": r2(pnl / total * 100, 1), "actual_pnl": None})
write("scenarios", scen, "Each holding's move = its 1-year Nasdaq and Bitcoin sensitivities applied to the factor moves (log-linear, so leveraged ETFs compound). Company-specific news is not modelled.")

# ---------- exit & profit-taking rules ----------
def atr(sym, n=14):
    s = H[sym]; ds = [d_ for d_ in cal if d_ in s][-(n * 4):]
    trs = []
    for a, b in zip(ds, ds[1:]):
        trs.append(max(s[b]["h"] - s[b]["l"], abs(s[b]["h"] - s[a]["c"]), abs(s[b]["l"] - s[a]["c"])))
    v = sum(trs[:n]) / n
    for t in trs[n:]:
        v = (v * (n - 1) + t) / n  # Wilder smoothing
    return v


def ncdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


exits = []
for p in held:
    s, c = p["yahoo"], [A[p["yahoo"]][i] for i in range(len(cal))]
    raw = [H[s][d_]["c"] for d_ in cal if d_ in H[s]]
    a14 = atr(s)
    hi22 = max(raw[-22:])
    price = p["price"]
    ma50, ma200 = sum(raw[-50:]) / 50, sum(raw[-200:]) / 200
    sig_m = st.pstdev([v for v in R[p["symbol"]] if v is not None]) * math.sqrt(21)
    stop2, stop3 = hi22 - 2 * a14, hi22 - 3 * a14
    t1, t2 = price * math.exp(sig_m), price * math.exp(2 * sig_m)
    gain = price - p["cost"]
    locked = None
    if gain > 0:
        locked = max(0.0, min(1.0, (min(stop3, price) - p["cost"]) / gain)) * 100
    status = ("Below wide stop" if price < stop3 else "Below tight stop" if price < stop2 else "Above stops")
    trend = ("Uptrend" if price > ma50 > ma200 else "Downtrend" if price < ma50 < ma200 else "Mixed")
    exits.append({"symbol": p["symbol"], "price": price, "avg_cost": p["cost"], "atr14": r2(a14, 3),
                  "atr_pct": r2(a14 / price * 100, 1), "high_22d": r2(hi22, 3),
                  "stop_tight": r2(stop2, 3), "stop_tight_dist_pct": r2((stop2 / price - 1) * 100, 1),
                  "stop_wide": r2(stop3, 3), "stop_wide_dist_pct": r2((stop3 / price - 1) * 100, 1),
                  "ma50": r2(ma50, 2), "ma200": r2(ma200, 2), "trend": trend, "stop_status": status,
                  "mom_3m_pct": r2((raw[-1] / raw[-64] - 1) * 100, 1),
                  "target_1sd": r2(t1, 3), "target_2sd": r2(t2, 3),
                  "p_touch_1sd_pct": r2(2 * (1 - ncdf(1)) * 100, 0), "p_touch_2sd_pct": r2(2 * (1 - ncdf(2)) * 100, 0),
                  "gain_locked_pct": r2(locked, 0), "open_stop": p.get("stop"), "open_limit": p.get("limit"),
                  "stop_order_dist_pct": r2((p["stop"] / price - 1) * 100, 2) if p.get("stop") else None})
exits.sort(key=lambda r: r["symbol"])
write("exits", exits, "Tight stop = 22-day high minus 2×ATR(14); wide stop = minus 3×ATR. Targets = one and two 1-month standard deviations above today's price; touch probabilities assume a driftless random walk (reflection principle).")

# ---------- leveraged ETF decay ----------
decay = []
for etf, und, lev in [("TQQQ", "QQQ", 3), ("TSLT", "TSLA", 2), ("CONL", "COIN", 2), ("NVDX", "NVDA", 2)]:
    for label, days in [("1 month", 21), ("3 months", 63), ("6 months", 126), ("1 year", 252)]:
        e = A[etf][-1] / A[etf][-1 - days] - 1
        u = A[und][-1] / A[und][-1 - days] - 1
        decay.append({"etf": etf, "underlying": und, "leverage": lev, "window": label, "key": f"{etf}|{label}",
                      "etf_return_pct": r2(e * 100, 1), "underlying_return_pct": r2(u * 100, 1),
                      "naive_lev_return_pct": r2(lev * u * 100, 1), "decay_gap_pct": r2((e - lev * u) * 100, 1)})
write("decay", decay, "Decay gap = what the ETF actually returned minus leverage × the underlying's return. Negative means daily rebalancing in choppy markets cost money.")

# ---------- rule-based alerts ----------
alerts = []
def alert(sev, sym, rule, detail):
    alerts.append({"severity": sev, "symbol": sym, "rule": rule, "detail": detail, "key": f"{sym}|{rule}"})

for e in exits:
    if e["stop_order_dist_pct"] is not None and abs(e["stop_order_dist_pct"]) < 2:
        alert("High", e["symbol"], "Open stop order within 2%",
              f"Stop-market sell at ${e['open_stop']:.2f} is {abs(e['stop_order_dist_pct']):.2f}% below Friday's close of ${e['price']:.2f}; it fires on Monday if the stock trades there.")
opt = next(p for p in POS["positions"] if p.get("option"))
o = opt["option"]
dte = (dt.date.fromisoformat(o["expiry"]) - last).days
need = (o["strike"] / o["underlying_price"] - 1) * 100
alert("High", opt["symbol"], "Option far out of the money near expiry",
      f"{dte} days left; NVDX must rise {need:.0f}% to reach the ${o['strike']} strike. Marked at about ${opt['qty'] * opt['price'] * 100:.0f} against ${opt['qty'] * opt['cost'] * 100:.0f} paid.")
for h in holdings:
    if h["leverage"] and h["leverage"] > 1:
        g = [d for d in decay if d["etf"] == h["symbol"] and d["window"] == "6 months"]
        if g and g[0]["decay_gap_pct"] < -10:
            alert("Medium", h["symbol"], "Leveraged ETF decay",
                  f"Over 6 months it returned {g[0]['etf_return_pct']}% while {g[0]['leverage']}× its underlying would be {g[0]['naive_lev_return_pct']}%.")
for e in exits:
    h = next(x for x in holdings if x["symbol"] == e["symbol"])
    if e["trend"] == "Downtrend" and h["pnl_pct"] < -20:
        alert("Medium", e["symbol"], "Loss position in a downtrend",
              f"Down {abs(h['pnl_pct'])}% from cost, below both the 50- and 200-day averages.")
top = exposure[0]
if top["lookthrough_pct"] > 35:
    alert("Medium", "Portfolio", "Concentrated look-through exposure",
          f"{top['bucket']} is {top['lookthrough_pct']}% of the account once leverage is counted.")
if summary[0]["cash_pct"] < 5:
    alert("Low", "Portfolio", "Little dry powder", f"Cash is {summary[0]['cash_pct']}% of the account.")
write("alerts", alerts)
print("ok", NOW, round(total), len(holdings), len(scen), len(exits), len(decay), len(alerts))
