from pathlib import Path
import os,subprocess,urllib.parse,json,urllib.request,time
root=Path(__file__).resolve().parents[1]
values=dict(l.split('=',1) for l in (root/'.p0/runtime.env').read_text().splitlines() if '=' in l)
env=dict(os.environ,JAVA_API_BASE_URL='http://127.0.0.1:18080',JAVA_SMOKE_DATABASE_URL='postgresql://procurement:'+urllib.parse.quote(values['P0_DB_PASSWORD'],safe='')+'@127.0.0.1:15432/procurement_agency_p0')
for _ in range(120):
    try:
        with urllib.request.urlopen('http://127.0.0.1:18080/actuator/health',timeout=2) as r:
            if json.load(r)['status']=='UP':break
    except Exception:pass
    time.sleep(.5)
else:raise SystemExit('Isolated backend not ready')
for key,method in [('invitation','邀请招标'),('inquiry','询价'),('single','单一来源')]:
    with (root/'.p0'/('p3-method-'+key+'.log')).open('w') as log:
        result=subprocess.run(['node','scripts/p3-method-case-smoke.mjs'],cwd=root,env=dict(env,AGENCY_CASE_METHOD=method),stdout=log,stderr=subprocess.STDOUT)
    print(key+': '+('passed' if result.returncode==0 else 'failed'),flush=True)
    if result.returncode:raise SystemExit(result.returncode)
