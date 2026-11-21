"""Risk lab, full local run: everything, including account-level engines.

Runs on your machine only (the daily launchd job calls it). Account outputs stay in risk-lab/out-private.
Tax and performance steps run only when private/tax_lots_raw.json and private/trades_raw.json exist.
"""
import os, subprocess, sys, time

LAB = os.path.dirname(os.path.abspath(__file__)); ENG = os.path.join(LAB, "engines")
sys.path.insert(0, ENG)
import paths

VENV_PY = os.path.join(LAB, ".venv", "bin", "python")
PY = VENV_PY if os.path.exists(VENV_PY) else sys.executable  # full library stack when the lab environment exists
have_private = all(os.path.exists(os.path.join(paths.PRIVATE, f)) for f in ("tax_lots_raw.json", "trades_raw.json"))
STEPS = [("build_positions.py", []), ("market_brief.py", [paths.OUT_PRIVATE]), ("build_positions.py", []), ("analyze_portfolio.py", [paths.OUT_PRIVATE]), ("risk_engine.py", [paths.OUT_PRIVATE]),
         ("market_history.py", [paths.OUT_PRIVATE])]
if have_private:
    STEPS.append(("today.py", [paths.OUT_PRIVATE]))
STEPS += [("price_outlook.py", [paths.OUT_PRIVATE]), ("make_public.py", [])]
if os.path.exists(VENV_PY):
    STEPS.append(("advanced_engine.py", [paths.OUT_PRIVATE]))
for script, args in STEPS:
    t = time.time()
    r = subprocess.run([PY, os.path.join(ENG, script), *args], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {script}\n{r.stdout[-1500:]}\n{r.stderr[-3000:]}")
        sys.exit(r.returncode)
    print(f"{script} ok ({time.time() - t:.0f}s)")
print("done. private outputs:", paths.OUT_PRIVATE, "| public outputs:", paths.OUT_PUBLIC,
      "" if have_private else "| tax/performance skipped (no private lot/trade files)")
