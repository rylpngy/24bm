from pathlib import Path
import os,subprocess,urllib.parse
root=Path(__file__).resolve().parents[1]
values=dict(l.split('=',1) for l in (root/'.p0/runtime.env').read_text().splitlines())
env=dict(os.environ,JAVA_API_BASE_URL='http://127.0.0.1:18080',JAVA_SMOKE_DATABASE_URL='postgresql://procurement:'+urllib.parse.quote(values['P0_DB_PASSWORD'],safe='')+'@127.0.0.1:15432/procurement_agency_p0')
raise SystemExit(subprocess.call(['node','scripts/p3-rounds-smoke.mjs'],cwd=root,env=env))
