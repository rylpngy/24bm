#!/usr/bin/env python3
"""Create credentials once and launch the dedicated local P0 infrastructure."""
from pathlib import Path
import secrets, subprocess, os
root=Path(__file__).resolve().parents[1]
runtime=root/".p0"
runtime.mkdir(exist_ok=True)
f=runtime/"runtime.env"
if not f.exists():
    fd=os.open(f,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,"w") as out:
        for key in ("P0_DB_PASSWORD","P0_MINIO_PASSWORD","JWT_SECRET"):
            out.write(key+"="+secrets.token_hex(32)+"\n")
subprocess.run(["docker","compose","--env-file",str(f),"-f",str(root/"infra/p0/compose.yml"),"up","-d"],check=True)
