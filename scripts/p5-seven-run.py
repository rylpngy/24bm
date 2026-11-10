from pathlib import Path
import os,subprocess,urllib.parse,json
root=Path(__file__).resolve().parents[1];values=dict(l.split('=',1) for l in (root/'.p0/runtime.env').read_text().splitlines() if '=' in l)
env=dict(os.environ,JAVA_API_BASE_URL='http://127.0.0.1:18080',JAVA_SMOKE_DATABASE_URL='postgresql://procurement:'+urllib.parse.quote(values['P0_DB_PASSWORD'],safe='')+'@127.0.0.1:15432/procurement_agency_p0')
rows=[]
for key,method,evaluation in [('public-lowest','公开招标','lowest_price'),('public-comprehensive','公开招标','comprehensive'),('negotiation','竞争性谈判','negotiation_price'),('consultation','竞争性磋商','comprehensive')]:
 with (root/'.p0'/('p5-seven-'+key+'.log')).open('w') as log:r=subprocess.run(['node','scripts/p5-seven-case-smoke.mjs'],cwd=root,env=dict(env,SEVEN_CASE=key,SEVEN_EVAL=evaluation,AGENCY_CASE_METHOD=method),stdout=log,stderr=subprocess.STDOUT)
 print(key+': '+('passed' if r.returncode==0 else 'failed; see private local log'),flush=True)
 if r.returncode:raise SystemExit(r.returncode)
 rows.append(json.loads((root/'.p0'/('p5-seven-'+key+'-result.json')).read_text()))
(root/'.p0/p5-seven-extra-result.json').write_text(json.dumps({'cases':rows,'scope':'Four additional synthetic method paths; combined with invitation, inquiry and sole source records forms seven technical cases, not real business acceptance'},ensure_ascii=False,indent=2))
