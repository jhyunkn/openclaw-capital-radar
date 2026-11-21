"""Build the public Market Pulse datasets from the risk lab outputs, stripping anything personal.

Run: python3 make_public.py   (reads risk-lab/out-private, writes outputs/risk-lab)
Removed: holdings flags and ordering, account-dollar translations, and tickers that would reveal a
private portfolio (niche leveraged/crypto names). Only market-wide data remains.
"""
import json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = paths.OUT_PRIVATE; OUT = paths.OUT_PUBLIC
CODE = open(os.path.abspath(__file__)).read(); NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
# Exclude private-portfolio names that a market-wide board would not normally list: anything held that
# isn't a widely covered stock. Read from the private files at build time so no tickers are written here.
_held = {p["yahoo"] for p in json.load(open(paths.POSITIONS))["positions"] if p.get("yahoo")}
_universe = {x for g in json.load(open(os.path.join(paths.CONFIG, "outlook_universe.json")))["groups"].values() for x in g}
_covered = set(json.load(open(paths.ANALYST))["targets"]) | _universe | {"SPY", "QQQ"}
DROP = _held - _covered
rows = lambda n: json.load(open(os.path.join(SRC_DIR, n + ".json")))["rows"]


def write(name, data, method):
    meta = [{"label": "make_public.py", "value": CODE, "type": "code", "lang": "python"}, {"label": "Built", "value": NOW},
            {"label": "Data", "value": "Yahoo Finance daily prices (S&P 500 since 1950, VIX since 1990, sector ETFs since 1999); FRED BAA10Y, T10Y2Y, DGS10; Robinhood analyst consensus targets"},
            {"label": "Method", "value": method}]
    json.dump({"rows": data, "meta": meta}, open(os.path.join(OUT, name + ".json"), "w"), allow_nan=False)


g = rows("market_gauges")
PUBLIC_MEANING = {"ndx_dd": "Tech-heavy index; leads most growth and AI stocks.",
                  "btc_dd": "Drives crypto and crypto-linked stocks."}
write("gauges", [{**r, "meaning": PUBLIC_MEANING.get(r["gauge"], r["meaning"])} for r in g],
      "Each gauge's percentile over its full history; forward S&P 500 returns after past days within ±5 percentile points of today's reading.")
an = [{k: v for k, v in r.items() if not k.startswith("your_")} for r in rows("market_analogs")]
write("analogs", an, "S&P 500 forward returns after past setups; episodes count separate events (gaps over a month).")

brief = json.load(open(os.path.join(SRC_DIR, "brief.json")))
L, A = brief["levels"], brief["analog"]; now = L["close"]
lv = [
    ("All-time high", L["all_time_high"], "level"), ("50-day average", L["ma50"], "level"), ("200-day average", L["ma200"], "level"),
    ("Close", now, "now"), ("52-week low", L["low_52w"], "level"), ("Bear market (−20%)", L["bear_20"], "level"), ("−30% from high", L["bear_30"], "level"),
    ("Typical further dip", now * (1 + A["further_low_median"] / 100), "history"), ("1-in-10 further dip", now * (1 + A["further_low_p90"] / 100), "history"),
    ("3 mo, middle outcome", now * (1 + A["ret3m_med"] / 100), "history"), ("3 mo, 10th percentile", now * (1 + A["ret3m_p10"] / 100), "history"),
    ("3 mo, 90th percentile", now * (1 + A["ret3m_p90"] / 100), "history"),
    ("1 mo options range, low", brief["implied_21"]["lo68"], "options"), ("1 mo options range, high", brief["implied_21"]["hi68"], "options"),
]
write("spx_levels", [{"label": a, "price": round(b, 1), "kind": c, "pct": round((b / now - 1) * 100, 1)} for a, b, c in lv],
      f"History rows: the {A['episodes']} past setups like today (VIX 30+, S&P 8–20% below its high), each counted once. Options range: VIX-implied one-month 68% band.")
ASOF = brief["asof"]
write("spx_stats", [{"asof": ASOF, "episodes": A["episodes"], "new_high_1y_pct": round(A["pct_new_high_within_1y"]), "days_to_new_high": A["days_to_new_high_median"],
                     "worst_further_pct": round(A["further_low_worst"], 1), "close": round(now, 2), "drawdown_pct": round(L["drawdown_pct"], 1)}],
      "Counts and medians over the same past episodes.")

scr = [r for r in brief["screen"] if r["symbol"] not in DROP]
write("momentum", [{k: (round(v, 2) if isinstance(v, float) else v) for k, v in r.items()} for r in scr],
      "12-1 momentum = return from 12 months to 1 month ago. Relative 1 month = return minus the S&P 500's. State: Leader = above 200-day average and beating the S&P this month; Holding up = beating the S&P; Breaking down = below the 200-day and down more than 10% in a month.")
lvl = brief["leaders_vs_laggards"]
write("sectors_after", [{**r, "median_excess_3m_pct": round(r["median_excess_3m_pct"], 1), "beat_spx_pct": round(r["beat_spx_pct"])} for r in brief["sectors_after"]],
      f"Sector ETF return minus the S&P 500 over the 3 months after each past setup since 1999. This month's leading vs lagging sectors: laggards did better {lvl['laggards_won_pct']:.0f}% of the time.")

summ = sorted(({**{k: v for k, v in r.items() if k not in ("held", "leveraged", "action_market")},
                 "action": r.get("action_market", r.get("action")),
                 "action_why": (r.get("action_why") or "").replace("; it is a leveraged daily-reset fund, which loses value in choppy markets", "")}
                for r in rows("outlook_summary") if r["symbol"] not in DROP), key=lambda r: r["symbol"])
keep = {r["symbol"] for r in summ}
write("outlook_summary", summ, "68% (2-in-3) ranges with no assumed drift; volatility starts at today's level and fades toward its 1-year average. History path = median S&P path after past setups like today × the stock's beta. Analyst σ = distance to the mean 12-month target in 12-month standard deviations.")
write("outlook_cone", [r for r in rows("outlook_cone") if r["symbol"] in keep], "Percentile bands by trading day ahead.")
write("outlook_history", [r for r in rows("outlook_history") if r["symbol"] in keep], "Last 6 months of closes and the 50-day average.")
print("public datasets:", sorted(os.listdir(OUT)), len(summ), "stocks;", len(scr), "in momentum")
leak = [r["symbol"] for r in scr + summ if r["symbol"] in DROP]
assert not leak, leak
for f in os.listdir(OUT):
    txt = json.dumps(json.load(open(os.path.join(OUT, f)))["rows"])
    for bad in ('"held"', "your_3m", "your account", "your ", "cost_basis", "tax_lot", *(f'"{d}"' for d in DROP)):
        assert bad not in txt, (f, bad)
print("leak check passed")
