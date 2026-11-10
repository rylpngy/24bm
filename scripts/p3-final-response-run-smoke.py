#!/usr/bin/env python3
"""Run isolated phase-one regressions and final-response acceptance with fresh synthetic tenants."""
from pathlib import Path
import os
import subprocess
root = Path(__file__).resolve().parents[1]
env = dict(os.environ, JAVA_API_BASE_URL="http://127.0.0.1:18080")
steps = [
    (["python3", "scripts/p3-requirement-change-run-smoke.py"], "previous-regressions"),
    (["node", "scripts/p3-final-response-smoke.mjs"], "http"),
]
for command, name in steps:
    log = root / ".p0" / ("p3-final-response-" + name + ".log")
    with log.open("w") as stream:
        result = subprocess.run(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT)
    print(name + ": " + ("passed" if result.returncode == 0 else "failed"), flush=True)
    if result.returncode:
        print("Local log: " + str(log), flush=True)
        raise SystemExit(result.returncode)
