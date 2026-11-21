"""AI analyst desk: TradingAgents (multi-agent LLM research) on a free local model via Ollama.

Run in the agents environment:  risk-lab/.venv-agents/bin/python risk-lab/engines/agents_engine.py OUT_DIR [N]
Needs a local Ollama server (`ollama serve`) with the model in MODEL pulled. No API keys, no per-call cost.

For each of Capital Radar's top-N triple-alignment candidates, a team of AI agents (market/technical,
news, fundamentals analysts; bull vs bear researchers; trader; risk team; portfolio manager) debates
the stock using free data (Yahoo Finance, SEC EDGAR) and returns a rating. These are opinions from a
14B local model, not measurements: the dashboard shows them beside the risk lab's backtested checks.
Results are cached per ticker per trading day, so a rerun the same day costs nothing.
"""
import json, os, re, sys, time, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paths

OUT = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5
MODEL = os.environ.get("RISK_LAB_AGENT_MODEL", "qwen2.5:14b")
SRC = open(os.path.abspath(__file__)).read()
CACHE_DIR = os.path.join(paths.OUT_PRIVATE, "agents"); os.makedirs(CACHE_DIR, exist_ok=True)

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
import importlib.metadata as md

cfg = dict(DEFAULT_CONFIG)
cfg.update({"llm_provider": "ollama", "deep_think_llm": MODEL, "quick_think_llm": MODEL,
            "backend_url": "http://localhost:11434/v1", "max_debate_rounds": 1, "max_risk_discuss_rounds": 1,
            "results_dir": CACHE_DIR, "checkpoint_enabled": False})

ta_state = json.load(open(os.path.join(paths.REPO, "outputs", "triple-alignment-state.json")))
cands = [x["ticker"] for x in ta_state["aligned"]][:N]
asof = json.load(open(os.path.join(paths.OUT_PUBLIC, "spx_stats.json")))["rows"][0]["asof"]

RATINGS = ["STRONG BUY", "STRONG SELL", "OVERWEIGHT", "UNDERWEIGHT", "BUY", "SELL", "HOLD"]


def rating_of(text):
    t = str(text).upper()
    for r in RATINGS:
        if re.search(r"\b" + r + r"\b", t):
            return r.title()
    return "Unclear"


def first_para(text, n=420):
    t = re.sub(r"[#*`>|]+", " ", str(text or "")); t = re.sub(r"\s+", " ", t).strip()
    return t[:n] + ("…" if len(t) > n else "")


rows = []
for tk in cands:
    cache = os.path.join(CACHE_DIR, f"{tk}_{asof}.json")
    if os.path.exists(cache):
        rows.append(json.load(open(cache))); print("cached", tk); continue
    t0 = time.time()
    try:
        g = TradingAgentsGraph(selected_analysts=["market", "news", "fundamentals"], debug=False, config=cfg)
        state, decision = g.propagate(tk, asof)
        inv = state.get("investment_debate_state") or {}
        row = {"ticker": tk, "date": asof, "model": MODEL, "rating": rating_of(decision), "decision_raw": first_para(decision, 200),
               "market": first_para(state.get("market_report")), "news": first_para(state.get("news_report")),
               "fundamentals": first_para(state.get("fundamentals_report")),
               "bull": first_para(inv.get("bull_history")), "bear": first_para(inv.get("bear_history")),
               "trader_plan": first_para(state.get("trader_investment_plan")), "final": first_para(state.get("final_trade_decision"), 600),
               "seconds": round(time.time() - t0), "status": "ok"}
    except Exception as e:
        row = {"ticker": tk, "date": asof, "model": MODEL, "rating": "Failed", "status": f"{type(e).__name__}: {str(e)[:200]}", "seconds": round(time.time() - t0)}
    json.dump(row, open(cache, "w"))
    rows.append(row); print(tk, row["rating"], row["seconds"], "s")

meta = [{"label": "agents_engine.py", "value": SRC, "type": "code", "lang": "python"},
        {"label": "Framework", "value": f"TradingAgents {md.version('tradingagents')} (TauricResearch, Apache-2.0)"},
        {"label": "Model", "value": f"{MODEL} via local Ollama: free, runs on this machine"},
        {"label": "Method", "value": "Market, news and fundamentals analysts; one bull/bear debate round; trader; one risk-team round; portfolio manager. Free data: Yahoo Finance and SEC EDGAR. AI opinions, not measurements or advice."}]
json.dump({"rows": rows, "meta": meta}, open(os.path.join(OUT, "agent_views.json"), "w"), allow_nan=False)
print("wrote", len(rows), "agent views")
