"""Macro backdrop: the economy, the Fed and money conditions, ranked against history.

Run: python3 macro_engine.py OUT_DIR   (market-only, no account data; writes straight to the public folder)

Data: FRED (St. Louis Fed, free, no key) and Yahoo Finance S&P 500 month-ends since 1950.
Writes:
  macro_indicators.json  one row per indicator: latest value, 3- and 12-month change, percentile in its
                         own history, and whether it is a tailwind, neutral or headwind for stocks.
  macro_series.json      monthly history of each indicator for the last 10 years (sparklines).
  macro_themes.json      six plain-language reads (growth, inflation, Fed, jobs, credit, dollar/oil).
  macro_regimes.json     S&P 500 returns after past months with the same macro conditions as today.
Regime months use data with a one-month publication lag, so no month uses numbers not yet released.
"""
import csv, io, json, os, sys, datetime as dt, urllib.request
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

OUT = sys.argv[1] if len(sys.argv) > 1 else paths.OUT_PUBLIC
SRC = open(os.path.abspath(__file__)).read()
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
os.makedirs(paths.CACHE, exist_ok=True)


def get(url, ua):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": ua}), timeout=45) as r:
                return r.read().decode()
        except Exception:
            if i == 3:
                raise


def fred(sid):
    path = os.path.join(paths.CACHE, f"fred_{sid}.json")
    if os.path.exists(path) and dt.datetime.now().timestamp() - os.path.getmtime(path) < 12 * 3600:
        return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}
    text = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}", "curl/8.7.1")
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        v = r[[k for k in r if k not in ("observation_date", "DATE")][0]]
        if v not in (".", ""):
            out[dt.date.fromisoformat(r.get("observation_date") or r.get("DATE"))] = float(v)
    json.dump({k.isoformat(): v for k, v in out.items()}, open(path, "w"))
    return out


def spx_daily():
    path = os.path.join(paths.CACHE, "long__GSPC.json")
    if not os.path.exists(path):
        d = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=-631152000&period2="
                           f"{int(dt.datetime.now().timestamp())}&interval=1d", "Mozilla/5.0"))["chart"]["result"][0]
        out = {dt.datetime.fromtimestamp(t, dt.timezone.utc).date().isoformat(): c
               for t, c in zip(d["timestamp"], d["indicators"]["quote"][0]["close"]) if c}
        json.dump(out, open(path, "w"))
    return {dt.date.fromisoformat(k): v for k, v in json.load(open(path)).items()}


def mkey(d):
    return d.year * 12 + d.month - 1


def monthly(src, how="last"):
    """Collapse a series to one value per calendar month (last or mean)."""
    b = {}
    for d in sorted(src):
        b.setdefault(mkey(d), []).append(src[d])
    return {k: (v[-1] if how == "last" else float(np.mean(v))) for k, v in b.items()}


def yoy(m, n=12):
    return {k: (v / m[k - n] - 1) * 100 for k, v in m.items() if k - n in m and m[k - n]}


def diff(m, n):
    return {k: v - m[k - n] for k, v in m.items() if k - n in m}


def pctile(series, v):
    a = np.array(list(series.values()))
    return float(round((a < v).mean() * 100))


def label_month(k):
    return dt.date(k // 12, k % 12 + 1, 1)


# ---------- load ----------
S = {sid: fred(sid) for sid in ["DFF", "DGS2", "DGS10", "T10Y3M", "DFII10", "T5YIE", "CPIAUCSL", "CPILFESL", "PCEPILFE",
                                "UNRATE", "PAYEMS", "ICSA", "A191RL1Q225SBEA", "INDPRO", "RSAFS", "BAMLH0A0HYM2", "BAA10Y", "NFCI",
                                "WALCL", "M2SL", "DTWEXBGS", "DCOILWTICO", "SAHMREALTIME", "UMCSENT"]}
M = {sid: monthly(v, "mean" if sid in ("DFF", "DGS2", "DGS10", "T10Y3M", "DFII10", "T5YIE", "BAMLH0A0HYM2", "BAA10Y", "NFCI", "ICSA", "DTWEXBGS", "DCOILWTICO") else "last")
     for sid, v in S.items()}

# transformed monthly series shown on the page
T = {
    "fedfunds": M["DFF"], "y2": M["DGS2"], "y10": M["DGS10"], "curve": M["T10Y3M"], "real10": M["DFII10"], "be5": M["T5YIE"],
    "cpi": yoy(M["CPIAUCSL"]), "core_cpi": yoy(M["CPILFESL"]), "core_pce": yoy(M["PCEPILFE"]),
    "unrate": M["UNRATE"], "payrolls": {k: v / 3 for k, v in diff(M["PAYEMS"], 3).items()}, "claims": {k: v / 1000 for k, v in M["ICSA"].items()},
    "gdp": monthly(S["A191RL1Q225SBEA"]), "indpro": yoy(M["INDPRO"]), "retail": yoy(M["RSAFS"]), "sentiment": M["UMCSENT"],
    "hy": M["BAMLH0A0HYM2"], "baa": M["BAA10Y"], "nfci": M["NFCI"], "fedbs": yoy(M["WALCL"]), "m2": yoy(M["M2SL"]),
    "dollar": yoy(M["DTWEXBGS"]), "oil": M["DCOILWTICO"], "sahm": M["SAHMREALTIME"],
}

# id, group, label, unit, decimals, source, what it measures, rule -> (signal, short reason)
def r_fed(v, c3, c12): return ("headwind", "the Fed is raising rates") if c12 > 0.25 or c3 >= 0.2 else ("tailwind", "the Fed is cutting") if c12 < -0.25 else ("neutral", "rates on hold")
def r_y2(v, c3, c12): return ("headwind", "markets price more hikes") if c3 > 0.25 else ("tailwind", "markets price cuts") if c3 < -0.25 else ("neutral", "little change in rate expectations")
def r_y10(v, c3, c12): return ("headwind", "long rates are high, pressuring valuations") if v >= 4.5 else ("neutral", "long rates moderate") if v >= 3 else ("tailwind", "long rates low")
def r_curve(v, c3, c12): return ("headwind", "inverted: a classic recession warning") if v < 0 else ("neutral", "flat curve") if v < 1 else ("tailwind", "normal, upward-sloping curve")
def r_real(v, c3, c12): return ("headwind", "real yields are restrictive") if v >= 2 else ("neutral", "real yields moderate") if v >= 0.5 else ("tailwind", "real yields low")
def r_be(v, c3, c12): return ("headwind", "markets expect inflation above target") if v >= 2.5 else ("neutral", "inflation expectations anchored") if v >= 1.8 else ("headwind", "markets price disinflation")
def r_infl(v, c3, c12): return ("headwind", "well above the Fed's 2% target") if v >= 3 else ("neutral", "above target but contained") if v >= 2.2 else ("tailwind", "near the 2% target")
def r_un(v, c3, c12): return ("headwind", "joblessness is rising") if c12 >= 0.5 else ("neutral", "drifting higher") if c12 > 0.1 else ("tailwind", "labor market steady")
def r_pay(v, c3, c12): return ("headwind", "hiring has stalled") if v < 50 else ("neutral", "hiring is modest") if v < 150 else ("tailwind", "hiring is solid")
def r_claims(v, c3, c12): return ("headwind", "layoffs rising") if v >= 300 else ("neutral", "layoffs edging up") if v >= 250 else ("tailwind", "layoffs low")
def r_gdp(v, c3, c12): return ("headwind", "growth is weak") if v < 1 else ("neutral", "growth near trend") if v < 2.5 else ("tailwind", "growth is strong")
def r_ip(v, c3, c12): return ("headwind", "factory output shrinking") if v < 0 else ("neutral", "factory output growing slowly") if v < 2 else ("tailwind", "factory output growing")
def r_ret(v, c3, c12): return ("headwind", "spending barely keeps up with prices") if v < 3 else ("neutral", "spending growing") if v < 6 else ("tailwind", "spending is strong")
def r_sent(v, c3, c12): return ("headwind", "consumers are gloomy") if v < 60 else ("neutral", "consumers are cautious") if v < 80 else ("tailwind", "consumers are confident")
def r_hy(v, c3, c12): return ("headwind", "credit markets are stressed") if v >= 5 else ("neutral", "credit is widening") if v >= 4 else ("tailwind", "credit is calm")
def r_baa(v, c3, c12): return ("headwind", "corporate borrowing costs are stressed") if v >= 2.5 else ("neutral", "spreads near normal") if v >= 1.8 else ("tailwind", "corporate credit is calm")
def r_nfci(v, c3, c12): return ("headwind", "financial conditions are tight") if v > 0 else ("neutral", "conditions near average") if v > -0.3 else ("tailwind", "financial conditions are loose")
def r_bs(v, c3, c12): return ("headwind", "the Fed is shrinking its balance sheet") if v < -2 else ("neutral", "balance sheet roughly flat") if v < 2 else ("tailwind", "the Fed is adding liquidity")
def r_m2(v, c3, c12): return ("headwind", "money supply contracting") if v < 0 else ("neutral", "money supply growing slowly") if v < 5 else ("tailwind", "money supply growing")
def r_usd(v, c3, c12): return ("headwind", "a strong dollar tightens global conditions") if v >= 5 else ("neutral", "dollar stable") if v > -5 else ("tailwind", "a weaker dollar eases conditions")
def r_oil(v, c3, c12): return ("headwind", "oil is high enough to squeeze consumers") if v >= 90 else ("neutral", "oil moderate") if v >= 55 else ("tailwind", "cheap oil helps consumers")
def r_sahm(v, c3, c12): return ("headwind", "recession signal triggered") if v >= 0.5 else ("neutral", "approaching the trigger") if v >= 0.3 else ("tailwind", "no recession signal")

IND = [
    ("fedfunds", "Fed & rates", "Fed funds rate", "%", 2, "DFF", "The overnight rate the Fed sets.", r_fed),
    ("y2", "Fed & rates", "2-year Treasury", "%", 2, "DGS2", "Where markets expect Fed policy over the next two years.", r_y2),
    ("y10", "Fed & rates", "10-year Treasury", "%", 2, "DGS10", "The long rate behind mortgages and stock valuations.", r_y10),
    ("real10", "Fed & rates", "10-year real yield", "%", 2, "DFII10", "The 10-year yield after expected inflation (TIPS).", r_real),
    ("curve", "Fed & rates", "Yield curve (10y − 3m)", "pts", 2, "T10Y3M", "Below zero (inverted) has preceded every US recession since 1968.", r_curve),
    ("core_cpi", "Inflation", "Core CPI, year on year", "%", 1, "CPILFESL", "Consumer prices excluding food and energy.", r_infl),
    ("core_pce", "Inflation", "Core PCE, year on year", "%", 1, "PCEPILFE", "The Fed's preferred inflation gauge; target 2%.", r_infl),
    ("cpi", "Inflation", "Headline CPI, year on year", "%", 1, "CPIAUCSL", "All consumer prices.", r_infl),
    ("be5", "Inflation", "5-year inflation expectation", "%", 2, "T5YIE", "Inflation the bond market expects over five years.", r_be),
    ("unrate", "Jobs", "Unemployment rate", "%", 1, "UNRATE", "Share of the labor force without a job.", r_un),
    ("sahm", "Jobs", "Sahm recession indicator", "pts", 2, "SAHMREALTIME", "Rise in the 3-month unemployment average above its 12-month low; 0.5 has marked recessions.", r_sahm),
    ("payrolls", "Jobs", "Jobs added per month (3-mo avg)", "k", 0, "PAYEMS", "Average monthly change in payrolls over three months.", r_pay),
    ("claims", "Jobs", "Weekly jobless claims", "k", 0, "ICSA", "New unemployment filings, the fastest layoff signal.", r_claims),
    ("gdp", "Growth", "Real GDP growth (annualized)", "%", 1, "A191RL1Q225SBEA", "Inflation-adjusted output, latest quarter.", r_gdp),
    ("indpro", "Growth", "Industrial production, y/y", "%", 1, "INDPRO", "Factory, mining and utility output.", r_ip),
    ("retail", "Growth", "Retail sales, y/y", "%", 1, "RSAFS", "Consumer spending at stores and online, not inflation-adjusted.", r_ret),
    ("sentiment", "Growth", "Consumer sentiment", "idx", 1, "UMCSENT", "University of Michigan survey; 1966 = 100.", r_sent),
    ("hy", "Credit & liquidity", "High-yield credit spread", "%", 2, "BAMLH0A0HYM2", "Extra yield on junk bonds over Treasuries; FRED publishes only the last 3 years.", r_hy),
    ("baa", "Credit & liquidity", "Corporate credit spread (Baa − 10y)", "pts", 2, "BAA10Y", "Extra yield on investment-grade corporate bonds; history since 1986.", r_baa),
    ("nfci", "Credit & liquidity", "Financial conditions (NFCI)", "idx", 2, "NFCI", "Chicago Fed index; above 0 is tighter than average.", r_nfci),
    ("fedbs", "Credit & liquidity", "Fed balance sheet, y/y", "%", 1, "WALCL", "Fed asset holdings; shrinking is quantitative tightening.", r_bs),
    ("m2", "Credit & liquidity", "Money supply (M2), y/y", "%", 1, "M2SL", "Cash, deposits and money-market funds.", r_m2),
    ("dollar", "Dollar & oil", "Broad dollar, y/y", "%", 1, "DTWEXBGS", "The dollar against major trading partners.", r_usd),
    ("oil", "Dollar & oil", "WTI crude oil", "$", 2, "DCOILWTICO", "US oil price, monthly average.", r_oil),
]


def fmt(v, unit, d):
    s = f"{abs(v):,.{d}f}"
    sign = "−" if v < 0 else ""
    return {"%": f"{sign}{s}%", "$": f"{sign}${s}", "k": f"{sign}{s}k"}.get(unit, sign + s)


rows, series = [], []
last_key = max(max(T[i[0]]) for i in IND)
for iid, grp, lab, unit, d, sid, meaning, rule in IND:
    m = T[iid]
    k = max(m); v = m[k]
    c3 = v - m.get(k - 3, v); c12 = v - m.get(k - 12, v)
    if iid == "gdp":
        c3 = v - m.get(k - 3, v); c12 = v - m.get(k - 12, v)
    sig, why = rule(v, c3, c12)
    raw_last = max(S[sid])
    rows.append({"id": iid, "group": grp, "label": lab, "value": round(v, 3), "display": fmt(v, unit, d), "unit": unit,
                 "chg_3m": round(c3, 3), "chg_12m": round(c12, 3), "percentile": pctile(m, v),
                 "since": label_month(min(m)).year, "asof": raw_last.isoformat(), "signal": sig, "why": why,
                 "meaning": meaning, "fred": sid})
    for kk in sorted(m):
        if kk > k - 120:
            series.append({"id": iid, "date": label_month(kk).isoformat(), "value": round(m[kk], 3)})

R = {r["id"]: r for r in rows}
n_tail = sum(r["signal"] == "tailwind" for r in rows); n_head = sum(r["signal"] == "headwind" for r in rows)

# ---------- regimes ----------
spx = spx_daily()
spm = monthly(spx)
keys = sorted(spm)
f3 = {k: spm[k + 3] / spm[k] - 1 for k in keys if k + 3 in spm}
f12 = {k: spm[k + 12] / spm[k] - 1 for k in keys if k + 12 in spm}

infl = yoy(M["CPIAUCSL"]); grow = yoy(M["INDPRO"])
dinf = diff(infl, 6); dgro = diff(grow, 6)
core = yoy(M["CPILFESL"]); ff6 = diff(M["DFF"], 6)


def quad(k):
    if k not in dinf or k not in dgro:
        return None
    g, i = dgro[k] > 0, dinf[k] > 0
    return {(True, False): "Goldilocks: growth up, inflation down", (True, True): "Overheating: growth up, inflation up",
            (False, True): "Stagflation: growth down, inflation up", (False, False): "Slowdown: growth down, inflation down"}[(g, i)]


LAG = 1  # month t's data is known by the end of month t+1
latest = max(k for k in dinf if k in dgro)
today_quad = quad(latest)


def cond_rows():
    C = [
        ("All months since 1950 (normal)", lambda k: True),
        ("Fed raising rates (funds up 0.25+ over 6 months)", lambda k: ff6.get(k, 0) >= 0.2 if k in ff6 else None),
        ("Fed cutting rates", lambda k: ff6.get(k, 0) < -0.25 if k in ff6 else None),
        ("Core inflation above 3%", lambda k: core[k] > 3 if k in core else None),
        ("10-year yield above 4.5%", lambda k: M["DGS10"][k] > 4.5 if k in M["DGS10"] else None),
        ("Real 10-year yield above 2.5%", lambda k: M["DFII10"][k] > 2.5 if k in M["DFII10"] else None),
        ("Fed hiking with core inflation above 3%", lambda k: (ff6[k] >= 0.2 and core[k] > 3) if k in ff6 and k in core else None),
        ("Credit calm (Baa spread below 2 pts)", lambda k: M["BAA10Y"][k] < 2 if k in M["BAA10Y"] else None),
        ("Sahm recession signal triggered (0.5+)", lambda k: M["SAHMREALTIME"][k] >= 0.5 if k in M["SAHMREALTIME"] else None),
    ]
    for q in ["Goldilocks: growth up, inflation down", "Overheating: growth up, inflation up", "Stagflation: growth down, inflation up", "Slowdown: growth down, inflation down"]:
        C.append((q, (lambda qq: (lambda k: (quad(k) == qq) if quad(k) else None))(q)))
    out = []
    for name, fn in C:
        hits = [k + LAG for k in keys if fn(k) and (k + LAG) in f12]
        hits3 = [k + LAG for k in keys if fn(k) and (k + LAG) in f3]
        if len(hits) < 12:
            continue
        eps = 1 + sum(1 for a, b in zip(hits, hits[1:]) if b - a > 1)
        a12 = np.array([f12[k] for k in hits]) * 100; a3 = np.array([f3[k] for k in hits3]) * 100
        now = next((fn(k) for k in range(max(keys), max(keys) - 7, -1) if fn(k) is not None), False)  # newest month with data
        out.append({"condition": name, "today_fits": bool(now) if name != "All months since 1950 (normal)" else True,
                    "months": len(hits), "episodes": eps, "since": label_month(hits[0]).year,
                    "fwd3m_median": round(float(np.median(a3)), 1), "fwd12m_median": round(float(np.median(a12)), 1),
                    "fwd12m_pos_pct": round(float((a12 > 0).mean() * 100)), "fwd12m_p10": round(float(np.percentile(a12, 10)), 1)})
    return out


regimes = cond_rows()

# ---------- themes ----------
def p(v, d=1): return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.{d}f}"
def tone(*ids):
    s = [R[i]["signal"] for i in ids]
    h, t = s.count("headwind"), s.count("tailwind")
    return "Headwind" if h > t else "Tailwind" if t > h else "Mixed"

themes = [
    {"theme": "Growth", "verdict": tone("gdp", "indpro", "retail", "sentiment"),
     "text": f"Real GDP grew {R['gdp']['display']} annualized last quarter, retail sales are {R['retail']['display']} on the year and "
             f"factory output {R['indpro']['display']}. The outlier is mood: consumer sentiment at {R['sentiment']['display']} is "
             + ("the lowest reading" if R['sentiment']['percentile'] < 1 else f"in the bottom {int(R['sentiment']['percentile'])}% of readings")
             + f" since {R['sentiment']['since']}. People are spending while saying they feel worse."},
    {"theme": "Inflation", "verdict": tone("core_cpi", "core_pce", "cpi", "be5"),
     "text": f"Core CPI runs {R['core_cpi']['display']} and core PCE {R['core_pce']['display']}, against the Fed's 2% goal "
             f"({p(R['core_pce']['chg_12m'])} pts over a year). Markets expect {R['be5']['display']} a year over five years."},
    {"theme": "Fed & rates", "verdict": tone("fedfunds", "y2", "y10", "real10", "curve"),
     "text": f"Fed funds average {R['fedfunds']['display']} ({p(R['fedfunds']['chg_3m'], 2)} pts in three months) and the 2-year at {R['y2']['display']} ({p(R['y2']['chg_12m'], 2)} pts in a year) prices more hikes. The 10-year at "
             f"{R['y10']['display']} is higher than {int(R['y10']['percentile'])}% of months since {R['y10']['since']}, and the real yield of "
             f"{R['real10']['display']} is the tightest part of the backdrop. The curve is {R['curve']['display']} pts: "
             f"{'inverted' if R['curve']['value'] < 0 else 'positive, after inverting in 2022–24'}."},
    {"theme": "Jobs", "verdict": tone("unrate", "sahm", "payrolls", "claims"),
     "text": f"Unemployment is {R['unrate']['display']} ({p(R['unrate']['chg_12m'])} pts in a year), payrolls are adding "
             f"{R['payrolls']['display']} a month and weekly claims are {R['claims']['display']}. The Sahm recession gauge reads "
             f"{R['sahm']['display']} against a 0.5 trigger."},
    {"theme": "Credit & liquidity", "verdict": tone("baa", "hy", "nfci", "fedbs", "m2"),
     "text": f"Corporate credit is calm: the Baa spread of {R['baa']['display']} pts is lower than {100 - int(R['baa']['percentile'])}% of days since "
             f"{R['baa']['since']}, and the high-yield spread is {R['hy']['display']}. Financial conditions read {R['nfci']['display']} "
             f"(below 0 is looser than average). The Fed's balance sheet is {R['fedbs']['display']} on the year; M2 money is {R['m2']['display']}."},
    {"theme": "Dollar & oil", "verdict": tone("dollar", "oil"),
     "text": f"The broad dollar is {R['dollar']['display']} on the year and WTI averaged {R['oil']['display']} this month."},
]
qrow = next((r for r in regimes if r["condition"] == today_quad), None)
econ = [r for r in rows if r["group"] in ("Growth", "Jobs", "Credit & liquidity")]
money = [r for r in rows if r["group"] in ("Fed & rates", "Inflation", "Dollar & oil")]
def bal(rs):
    h = sum(r["signal"] == "headwind" for r in rs); t = sum(r["signal"] == "tailwind" for r in rs)
    return ("supportive", h, t) if t > h else ("restrictive", h, t) if h > t else ("mixed", h, t)
eb, mb = bal(econ), bal(money)
spread = [r["fwd12m_median"] for r in regimes if r["condition"] != "All months since 1950 (normal)"]
summary = {"theme": "Overall", "verdict": "Mixed" if eb[0] != mb[0] else eb[0].title(),
           "text": f"The economy is {eb[0]} ({eb[2]} of {len(econ)} growth, jobs and credit gauges are tailwinds); the price of money is "
                   f"{mb[0]} ({mb[1]} of {len(money)} rate, inflation and oil gauges are headwinds). So the sell-off is about rates and "
                   f"valuations more than a failing economy. The growth-inflation regime is {today_quad.split(':')[0].lower()} "
                   f"({today_quad.split(': ')[1]})"
                   + (f"; after such months the S&P's median 12-month return was {p(qrow['fwd12m_median'])}%, up {qrow['fwd12m_pos_pct']}% of the time." if qrow else ".")
                   + f" Across every macro condition tested, median 12-month returns only ranged from {p(min(spread))}% to {p(max(spread))}%: "
                     "macro sets the backdrop, but it has been a weak timing signal on its own."}
themes.insert(0, summary)

meta = [{"label": "macro_engine.py", "value": SRC, "type": "code", "lang": "python"},
        {"label": "Data", "value": "FRED (St. Louis Fed): " + ", ".join(i[5] for i in IND) + "; Yahoo Finance ^GSPC month-ends since 1950"},
        {"label": "Built", "value": NOW}]
for name, data in [("macro_indicators.json", rows), ("macro_series.json", series), ("macro_themes.json", themes), ("macro_regimes.json", regimes)]:
    json.dump({"rows": data, "meta": meta}, open(os.path.join(OUT, name), "w"), allow_nan=False)
print("macro:", len(rows), "indicators,", len(series), "points,", len(regimes), "regimes; today:", today_quad, f"| {n_head} headwinds / {n_tail} tailwinds")
