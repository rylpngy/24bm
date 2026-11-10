#!/usr/bin/env python3
"""Run isolated synthetic phase-one HTTP/browser acceptance without printing credentials.
Requires the documented P0 runtime, an already running matching backend and the local Vite app.
Creates fresh synthetic tenants; never deploys or contacts purchasers, suppliers or banks.
"""
from pathlib import Path
import os,subprocess,urllib.parse,urllib.request,json,time,sys
root=Path(__file__).resolve().parents[1]
values=dict(l.split('=',1) for l in (root/'.p0/runtime.env').read_text().splitlines() if '=' in l)
env=dict(os.environ,JAVA_API_BASE_URL='http://127.0.0.1:18080',JAVA_SMOKE_DATABASE_URL='postgresql://procurement:'+urllib.parse.quote(values['P0_DB_PASSWORD'],safe='')+'@127.0.0.1:15432/procurement_agency_p0')
for _ in range(120):
 try:
  with urllib.request.urlopen('http://127.0.0.1:18080/actuator/health',timeout=2) as r:
   if json.load(r)['status']=='UP':break
 except Exception:pass
 time.sleep(.5)
else:raise SystemExit('Isolated backend unavailable; no acceptance claimed')
jobs=[('invitation-foundation','scripts/p3-method-case-smoke.mjs',{'AGENCY_CASE_METHOD':'邀请招标'}),('single-foundation','scripts/p3-method-case-smoke.mjs',{'AGENCY_CASE_METHOD':'单一来源'}),('inquiry-foundation','scripts/p3-method-case-smoke.mjs',{'AGENCY_CASE_METHOD':'询价'})]+[(name,path,{}) for name,path in [('recommendation-report','scripts/p3-report-smoke.mjs'),('post-award','scripts/p4-post-smoke.mjs'),('finance','scripts/p4-finance-smoke.mjs'),('archive','scripts/p4-archive-smoke.mjs'),('permissions-exceptions','scripts/p4-permissions-smoke.mjs'),('method-report-branches','scripts/p5-report-branches.mjs'),('report-independence','scripts/p5-report-independence-smoke.mjs'),('office-exports','scripts/p5-office-export-smoke.mjs'),('browser','scripts/p5-browser-smoke.mjs')]]
results=[]
for name,path,extra in jobs:
 log=root/'.p0'/('p5-'+name+'.log')
 with log.open('w') as out:r=subprocess.run(['node',path],cwd=root,env=dict(env,**extra),stdout=out,stderr=subprocess.STDOUT)
 results.append({'job':name,'passed':r.returncode==0})
 print(name+': '+('passed' if r.returncode==0 else 'failed; see private local log'),flush=True)
 if r.returncode:sys.exit(r.returncode)
(root/'.p0/p5-continuous-result.json').write_text(json.dumps({'jobs':results,'scope':'Isolated synthetic technical acceptance; real templates/business approval/production capacity and release remain separate'},ensure_ascii=False,indent=2))
