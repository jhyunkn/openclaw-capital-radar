"""Tax layer, performance record and the decision queue for the Portfolio War Room.

Run after analyze_portfolio.py, risk_engine.py and market_history.py:
    python3 today.py OUT_DIR
Inputs: positions.json, tax_lots_raw.json, trades_raw.json (synced from Robinhood) and the
engines' outputs in OUT_DIR. Tax figures are informational estimates, not tax advice.
"""
import json, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
SRC = open(os.path.abspath(__file__)).read()
NOW = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
POS = json.load(open(paths.POSITIONS))
LOTS = json.load(open(os.path.join(paths.PRIVATE, "tax_lots_raw.json")))
TR = json.load(open(os.path.join(paths.PRIVATE, "trades_raw.json")))
rd = lambda name: json.load(open(os.path.join(OUT, name + ".json")))["rows"]
price = {p["symbol"]: p["price"] for p in POS["positions"]}
summary, exits, limits = rd("summary")[0], rd("exits"), rd("limits")
gauges, analogs, scen = rd("market_gauges"), rd("market_analogs"), rd("scenarios")
asof = dt.date.fromisoformat(summary["asof"])
year_end = dt.date(asof.year, 12, 31)


def write(name, rows, note=None):
    meta = [{"label": "today.py", "value": SRC, "type": "code", "lang": "python"}, {"label": "Computed", "value": NOW},
            {"label": "Inputs", "value": LOTS["source"] + "; " + TR["source"]}]
    if note:
        meta.append({"label": "Method", "value": note})
    json.dump({"rows": rows, "meta": meta}, open(os.path.join(OUT, name + ".json"), "w"), allow_nan=False)


r0 = lambda x: None if x is None else round(x)
money = lambda v: ("−$" if v < 0 else "$") + f"{abs(v):,.0f}"

# ---------------- tax lots
lots = []
for l in LOTS["lots"]:
    px = price[l["symbol"]]
    mv = l["qty"] * px
    gain = mv - l["basis"]
    od = dt.date.fromisoformat(l["open_date"]) if l["open_date"] else None
    lt_date = od.replace(year=od.year + 1) + dt.timedelta(days=1) if od else None
    days_to_lt = (lt_date - asof).days if (lt_date and l["term"] == "st") else None
    lots.append({"symbol": l["symbol"], "account": l["account"], "key": f"{l['symbol']}|{l['account']}|{l['open_date']}|{l['cost_per_share']}",
                 "open_date": l["open_date"] or "various", "term": {"lt": "Long-term", "st": "Short-term", "crypto": "Crypto"}[l["term"]],
                 "qty": round(l["qty"], 4), "cost_per_share": l["cost_per_share"], "basis": round(l["basis"], 2), "value": round(mv, 2),
                 "gain": round(gain, 2), "gain_pct": round(gain / l["basis"] * 100, 1) if l["basis"] else None,
                 "long_term_on": lt_date.isoformat() if (lt_date and l["term"] == "st") else None, "days_to_long_term": days_to_lt})
lots.sort(key=lambda x: (x["symbol"], x["open_date"]))
write("tax_lots", lots, "Unrealized gain per lot at Friday's close against its tax basis. Long-term status starts the day after the one-year anniversary of the purchase.")

recent_buys = defaultdict(list)
for l in LOTS["lots"]:
    if l["open_date"] and (asof - dt.date.fromisoformat(l["open_date"])).days <= 30:
        recent_buys[l["symbol"]].append(l["open_date"])

by = defaultdict(lambda: {"lt_gain": 0, "lt_loss": 0, "st_gain": 0, "st_loss": 0, "crypto": 0, "value": 0, "basis": 0})
for l in lots:
    b = by[l["symbol"]]; g = l["gain"]; b["value"] += l["value"]; b["basis"] += l["basis"]
    if l["term"] == "Crypto": b["crypto"] += g
    elif l["term"] == "Long-term": b["lt_gain" if g >= 0 else "lt_loss"] += g
    else: b["st_gain" if g >= 0 else "st_loss"] += g
tax_sym = []
for s, b in sorted(by.items()):
    soon = [l for l in lots if l["symbol"] == s and l["days_to_long_term"] is not None and l["gain"] > 0 and l["days_to_long_term"] <= 90]
    tax_sym.append({"symbol": s, "value": r0(b["value"]), "basis": r0(b["basis"]), "lt_gain": r0(b["lt_gain"]), "lt_loss": r0(b["lt_loss"]),
                    "st_gain": r0(b["st_gain"]), "st_loss": r0(b["st_loss"]), "crypto": r0(b["crypto"]),
                    "wash_sale_until": (max(dt.date.fromisoformat(d) for d in recent_buys[s]) + dt.timedelta(days=31)).isoformat() if s in recent_buys else None,
                    "turns_lt_soon": "; ".join(f"{l['qty']:g} sh on {l['long_term_on']} (+${l['gain']:,.0f})" for l in soon) or None})
write("tax_by_holding", tax_sym, "Wash-sale window: a loss sale before this date sits within 30 days of a purchase, so the loss could be disallowed unless all shares, including the new ones, are sold and not rebought for 31 days.")

realized = TR["realized_ytd_total"]
tot = lambda k: sum(x[k] or 0 for x in tax_sym)
free_gain = max(0.0, -realized - 3000)
tax_summary = [{"realized_ytd": round(realized, 2), "lt_unrealized_gain": tot("lt_gain"), "lt_unrealized_loss": tot("lt_loss"),
                "st_unrealized_gain": tot("st_gain"), "st_unrealized_loss": tot("st_loss"), "crypto_unrealized": tot("crypto"),
                "harvestable_losses": tot("lt_loss") + tot("st_loss") + min(0, tot("crypto")),
                "free_gain_room": round(free_gain, 2), "neutral_gain_room": round(max(0.0, -realized), 2),
                "days_to_year_end": (year_end - asof).days, "asof": asof.isoformat()}]
write("tax_summary", tax_summary, "Net capital losses offset gains first; up to $3,000 of any remaining net loss offsets ordinary income each year and the rest carries forward. 'Free' gain room = realized gains that would leave the full $3,000 deduction intact. Assumes no other accounts, prior carryovers or other gains: check with a tax professional.")

# ---------------- performance record
tr = TR["trades"]
wins = [t["realized"] for t in tr if t["realized"] > 0]; losses = [t["realized"] for t in tr if t["realized"] <= 0]
# Leveraged funds: held ones from config, traded ones from the private overrides (never committed).
_ov = json.load(open(os.path.join(paths.PRIVATE, "overrides.json"))) if os.path.exists(os.path.join(paths.PRIVATE, "overrides.json")) else {}
LEV = {p["symbol"] for p in POS["positions"] if (p.get("lev") or 1) > 1 or p.get("option")} | set(_ov.get("leveraged_symbols", []))
lev_pnl = sum(t["realized"] for t in tr if t["symbol"] in LEV)
perf = [{"trades": len(tr), "winners": len(wins), "hit_rate_pct": round(len(wins) / len(tr) * 100), "realized_ytd": round(realized, 2),
         "avg_win": round(sum(wins) / len(wins), 2) if wins else None, "avg_loss": round(sum(losses) / len(losses), 2) if losses else None,
         "profit_factor": round(sum(wins) / -sum(losses), 2) if losses else None, "largest_loss": min(t["realized"] for t in tr),
         "largest_loss_symbol": min(tr, key=lambda t: t["realized"])["symbol"], "leveraged_realized": round(lev_pnl, 2),
         "unrealized": summary["unrealized_pnl"], "asof": asof.isoformat()}]
write("performance", perf, "Leveraged and single-stock leveraged ETFs: " + ", ".join(sorted(LEV)) + ".")
bysym = defaultdict(lambda: [0.0, 0])
for t in tr:
    bysym[t["symbol"]][0] += t["realized"]; bysym[t["symbol"]][1] += 1
write("realized_by_symbol", sorted(({"symbol": s, "realized": round(v[0], 2), "trades": v[1], "leveraged": s in LEV} for s, v in bysym.items()), key=lambda x: x["realized"]))
write("trades", [{**t, "key": f"{t['date']}|{t['symbol']}|{t['realized']}"} for t in tr])

# ---------------- decision queue
Q = []
def item(pri, when, title, why, choices, tab):
    Q.append({"priority": pri, "when": when, "title": title, "why": why, "choices": choices, "tab": tab, "key": title})

for e in exits:
    if e.get("stop_order_dist_pct") is not None and abs(e["stop_order_dist_pct"]) < 3:
        s = e["symbol"]; b = next(x for x in tax_sym if x["symbol"] == s)
        item(1, "Monday's open", f"{s} stop-loss is {abs(e['stop_order_dist_pct']):.1f}% away",
             f"Your stop sells all shares at ${e['open_stop']:.2f}; Friday closed at ${e['price']:.2f}. Trend: {e['trend'].lower()}. Selling everything would realize about {money(b['st_loss'])} in short-term losses"
             + (f"; a recent purchase means rebuying before {b['wash_sale_until']} would make it a wash sale." if b["wash_sale_until"] else "."),
             "Let the stop work · Move the stop · Cancel it and decide manually", "exitsplan")
opt = next((p for p in POS["positions"] if p.get("option")), None)
if opt:
    o = opt["option"]; dte = (dt.date.fromisoformat(o["expiry"]) - asof).days
    item(1 if dte <= 30 else 2, f"Expires {o['expiry']} ({dte} days)", "NVDX call is about to expire worthless",
         f"NVDX ${o['underlying_price']} must reach ${o['strike']} (+{(o['strike'] / o['underlying_price'] - 1) * 100:.0f}%). Bid is ${o['bid']:.2f}, so nothing can be recovered by selling; letting it expire books the ${opt['qty'] * opt['cost'] * 100:,.0f} loss in {asof.year}.",
         "Let it expire (loss counts this year) · Place a sell order at the ask in case a bid appears", "account")
for l in limits:
    if l["status"] == "Breach":
        item(2, "This week", f"Limit breached: {l['limit']} at {l['utilization_pct']:.0f}% of its own normal", l["basis"],
             "Reduce the driver · Hedge it · Accept it knowingly and note why", "today")
ts = tax_summary[0]
item(2, f"By Dec 31 ({ts['days_to_year_end']} days)", "Year-end tax window",
     f"Realized {asof.year}: {money(ts['realized_ytd'])}. Harvestable unrealized losses: {money(ts['harvestable_losses'])}. Up to ${ts['free_gain_room']:,.0f} of gains could be taken this year without reducing the $3,000 loss deduction, and up to ${ts['neutral_gain_room']:,.0f} with no net capital gain."
     + (" Wash-sale windows open on: " + ", ".join(x["symbol"] for x in tax_sym if x["wash_sale_until"]) + "." if any(x["wash_sale_until"] for x in tax_sym) else ""),
     "Harvest losses (mind wash sales) · Realize gains inside the free room · Do nothing until January", "exitsplan")
for x in tax_sym:
    if x["turns_lt_soon"]:
        item(3, "Before selling", f"{x['symbol']} gain lots turn long-term soon", f"Waiting changes the tax rate on: {x['turns_lt_soon']}.",
             "Wait for long-term status before trimming · Sell now anyway", "exitsplan")
baa = next(g for g in gauges if g["gauge"] == "baa"); vix = next(g for g in gauges if g["gauge"] == "vix")
today_setup = next(a for a in analogs if a["setup"].startswith("Today's setup"))
item(3, "Daily", "Watch credit spreads: the gauge that turns a sell-off into a crisis",
     f"VIX {vix['current']} is in its {vix['percentile']:.0f}th percentile, but the Baa spread is {baa['current']} ({baa['zone'].lower()}). After {today_setup['episodes']} past setups like today the S&P's median 3-month move was {today_setup['fwd3m_median']:+.1f}%. A spread above 2.5 would change that read.",
     "No action; re-read if the spread rises past 2.5", "market")
Q.sort(key=lambda q: q["priority"])
for i, q in enumerate(Q):
    q["rank"] = i + 1
write("decisions", Q, "Built from fixed rules over the other datasets. Ranked by urgency: 1 = needs a decision before the next session, 2 = this week or before a deadline, 3 = keep in view. Choices are listed without a recommendation.")
for q in Q: print(q["priority"], q["when"], "|", q["title"], "|", q["why"][:160])
print(tax_summary, perf)
