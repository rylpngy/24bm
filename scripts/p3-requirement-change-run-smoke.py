#!/usr/bin/env python3
"""Run phase-one synthetic regressions on the isolated backend, preserving business history."""
from pathlib import Path
import os
import subprocess
root = Path(__file__).resolve().parents[1]
env = dict(os.environ, JAVA_API_BASE_URL="http://127.0.0.1:18080")
steps = [
    (["python3", "scripts/p3-incident-run-smoke.py"], "previous-regressions"),
    (["node", "scripts/p3-discussion-smoke.mjs"], "discussion-regression"),
    (["node", "scripts/p3-requirement-change-smoke.mjs"], "http"),
]
for command, name in steps:
    path = root / ".p0" / ("p3-requirement-change-" + name + ".log")
    with path.open("w") as log:
        result = subprocess.run(command, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    print(name + ": " + ("passed" if result.returncode == 0 else "failed"), flush=True)
    if result.returncode:
        print("Local log: " + str(path), flush=True)
        raise SystemExit(result.returncode)
