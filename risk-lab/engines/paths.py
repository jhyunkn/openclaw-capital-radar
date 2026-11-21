"""Shared locations for the risk lab.

Public outputs (market-wide only) go to outputs/risk-lab/ and are committed by the operating loop.
Everything that carries account data stays under risk-lab/private and risk-lab/out-private,
which are git-ignored and never leave this machine.
"""
import os

ENGINES = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(ENGINES)
REPO = os.path.dirname(LAB)
CONFIG = os.path.join(LAB, "config")
PRIVATE = os.path.join(LAB, "private")            # git-ignored: tax lots, trades, extra accounts, ledger
OUT_PRIVATE = os.path.join(LAB, "out-private")    # git-ignored: every output with account data
OUT_PUBLIC = os.environ.get("RISK_LAB_OUT_PUBLIC") or os.path.join(REPO, "outputs", "risk-lab")  # committed: market-wide data only
CACHE = os.path.join(LAB, "cache")                # git-ignored: price downloads
CR_POSITIONS = os.path.join(REPO, "outputs", "robinhood-positions.json")
POSITIONS = os.path.join(OUT_PRIVATE, "positions.json")
ANALYST = os.path.join(CONFIG, "analyst_targets.json")
INSTRUMENTS = os.path.join(CONFIG, "instruments.json")

for d in (PRIVATE, OUT_PRIVATE, OUT_PUBLIC, CACHE):
    os.makedirs(d, exist_ok=True)
