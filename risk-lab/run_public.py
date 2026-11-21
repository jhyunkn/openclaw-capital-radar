"""Risk lab, public stage: market-wide analysis for the operating loop.

Writes only outputs/risk-lab/*.json (gauges vs history, analogs, S&P levels, momentum, sector history,
price outlook, macro backdrop). Intermediate files land in risk-lab/out-private (git-ignored).
Exits 0 with a warning if numpy is unavailable, so the rest of the pipeline is never blocked.
"""
import os, subprocess, sys, time

ENG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "engines")
sys.path.insert(0, ENG)
try:
    import numpy  # noqa: F401
except ImportError:
    print("RISK_LAB_SKIP numpy not installed; run `pip install numpy` to enable the risk lab stage")
    sys.exit(0)
import paths

STEPS = [("build_positions.py", []), ("market_brief.py", [paths.OUT_PRIVATE]), ("build_positions.py", []), ("market_history.py", [paths.OUT_PRIVATE]),
         ("price_outlook.py", [paths.OUT_PRIVATE]), ("make_public.py", []), ("macro_engine.py", [paths.OUT_PUBLIC])]
for script, args in STEPS:
    t = time.time()
    r = subprocess.run([sys.executable, os.path.join(ENG, script), *args], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"RISK_LAB_FAIL {script}\n{r.stdout[-1500:]}\n{r.stderr[-3000:]}")
        sys.exit(r.returncode)
    print(f"risk-lab {script} ok ({time.time() - t:.0f}s)")
print("risk-lab public stage complete ->", os.path.relpath(paths.OUT_PUBLIC, paths.REPO))
