"""Build the risk lab's position book from Capital Radar's Robinhood sync.

Input : outputs/robinhood-positions.json (Capital Radar's sync, main account)
        config/instruments.json (Yahoo ticker, leverage, theme per symbol)
        private/overrides.json (optional: other accounts, option Greeks; git-ignored)
Output: out-private/positions.json (git-ignored)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

# Use whichever sync is newer: the working tree's, or the copy the daily job pulls from origin/main.
_cands = [paths.CR_POSITIONS, os.path.join(paths.PRIVATE, "cr-positions-latest.json")]
cr = max((json.load(open(c)) for c in _cands if os.path.exists(c)), key=lambda d: d.get("syncedAt", ""))
inst = json.load(open(paths.INSTRUMENTS))["instruments"]
ov = json.load(open(os.path.join(paths.PRIVATE, "overrides.json"))) if os.path.exists(os.path.join(paths.PRIVATE, "overrides.json")) else {}

book = {}
for p in cr["positions"]:
    s = p["symbol"]
    meta = inst.get(s)
    if not meta:
        print(f"risk-lab: no instrument metadata for {s}; add it to config/instruments.json", file=sys.stderr)
        meta = {"yahoo": s, "name": s, "lev": 1, "underlying": s, "bucket": "Other"}
    q, c = float(p["quantity"]), float(p["avgCostPrice"])
    book[s] = {"symbol": s, **meta, "qty": q, "cost": c, "price": float(p["livePrice"])}
    if p.get("note") and "stop" in p.get("note", "").lower():
        book[s]["note"] = p["note"]
for x in ov.get("extra_positions", []):          # merge other accounts at weighted average cost
    b = book.get(x["symbol"])
    if b:
        tq = b["qty"] + x["qty"]
        b["cost"] = round((b["qty"] * b["cost"] + x["qty"] * x["cost"]) / tq, 4); b["qty"] = tq
for x in ov.get("stops", []):
    if x["symbol"] in book:
        book[x["symbol"]].update({k: x[k] for k in ("stop", "limit") if k in x})

# Reprice to the latest daily close in the lab's price caches when it is newer than the sync
# (Capital Radar's sync can run intraday; every risk number should use the same closing prices).
import datetime as _dt
sync_day = cr["syncedAt"][:10]
repriced = []
for p in book.values():
    best = None
    for f in (f"brief_{p['yahoo']}", p["yahoo"]):
        fp = os.path.join(paths.CACHE, f.replace("^", "_").replace("=", "_") + ".json")
        if os.path.exists(fp):
            d = json.load(open(fp)); k = max(d); v = d[k]
            close = v["c"] if isinstance(v, dict) else v
            if best is None or k > best[0]:
                best = (k, close)
    if best and best[0] >= sync_day and best[1]:
        p["price_sync"] = p["price"]; p["price"] = round(float(best[1]), 6); p["priceBasis"] = f"daily close {best[0]}"
        repriced.append(p["symbol"])
positions = list(book.values()) + ov.get("options", [])
cash = float(cr["portfolio"]["cash"]) + float(ov.get("extra_cash", 0))
out = {"syncedAt": cr["syncedAt"], "source": cr["source"] + ("; plus private overrides" if ov else ""),
       "cash": round(cash, 2), "positions": positions}
json.dump(out, open(paths.POSITIONS, "w"), indent=1)
print(f"risk-lab: {len(positions)} positions, cash ${cash:,.0f}, synced {cr['syncedAt']}, repriced to close: {', '.join(repriced) or 'none'}")
