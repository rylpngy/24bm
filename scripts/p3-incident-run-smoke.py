#!/usr/bin/env python3
"""Build fresh isolated synthetic fixtures; preserve earlier rounds and their 50-round cap."""
from pathlib import Path
import os
import subprocess
import time
import urllib.request
import json

root = Path(__file__).resolve().parents[1]
env = dict(os.environ, JAVA_API_BASE_URL="http://127.0.0.1:18080")
for attempt in range(120):
    try:
        with urllib.request.urlopen("http://127.0.0.1:18080/actuator/health", timeout=2) as response:
            if json.load(response).get("status") == "UP":
                break
    except Exception:
        pass
    time.sleep(0.5)
else:
    raise SystemExit("Isolated backend 18080 is not ready")

steps = [
    (["python3", "scripts/p3-opening-run-smoke.py"], "foundation-regression"),
    (["node", "scripts/p3-quote-smoke.mjs"], "initial-quote-regression"),
    (["node", "scripts/p3-final-quote-smoke.mjs"], "final-quote-regression"),
    (["node", "scripts/p3-price-smoke.mjs"], "price-regression"),
    (["node", "scripts/p3-total-smoke.mjs"], "total-regression"),
    (["node", "scripts/p3-incident-smoke.mjs"], "http"),
]
for argv, name in steps:
    log_path = root / ".p0" / ("p3-incident-" + name + ".log")
    with log_path.open("w") as log:
        result = subprocess.run(argv, cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT)
    print(name + ": " + ("passed" if result.returncode == 0 else "failed"), flush=True)
    if result.returncode:
        print("Local log: " + str(log_path), flush=True)
        raise SystemExit(result.returncode)
