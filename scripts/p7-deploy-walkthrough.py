#!/usr/bin/env python3
"""Deploy only the owned local walkthrough; no production host or other applications are selected."""
from pathlib import Path
import os,subprocess,json,time,signal,hashlib,shutil,urllib.request
root=Path(__file__).resolve().parents[1];runtime=root/'.p0';java='/opt/homebrew/opt/openjdk@21/bin/java'
def config(name):return dict(l.split('=',1) for l in (runtime/name).read_text().splitlines() if '=' in l)
def current(port):
 r=subprocess.run(['lsof','-tiTCP:'+str(port),'-sTCP:LISTEN'],stdout=subprocess.PIPE,text=True);return int(r.stdout.strip()) if r.returncode==0 else None
def stop_owned(port):
 pid=current(port)
 if not pid:return
 command=subprocess.check_output(['ps','-p',str(pid),'-o','command=']).decode()
 cwd=subprocess.check_output(['lsof','-a','-p',str(pid),'-d','cwd','-Fn']).decode()
 assert str(root) in command or str(root) in cwd,'Refuse to stop unowned listener'
 assert ('ProcurementApplication' in command or '.p0/releases/' in command) if port==18080 else ('vite' in command or 'p7-walkthrough-web.py' in command)
 os.kill(pid,signal.SIGTERM)
 for i in range(60):
  if not current(port):return
  time.sleep(.2)
 raise RuntimeError('Owned listener did not stop')
secrets=config('runtime.env');provider=config('bailian.env');assert provider.get('PROCUREMENT_AI_MODEL') and provider.get('PROCUREMENT_AI_API_KEY')
jar=root/'backend-java/target/procurement-saas-backend-0.1.0-SNAPSHOT.jar';digest=hashlib.sha256(jar.read_bytes()).hexdigest();releases=runtime/'releases';releases.mkdir(exist_ok=True);release=releases/('walkthrough-'+digest[:12]+'.jar')
if not release.exists():shutil.copyfile(jar,release)
web=runtime/'walkthrough-web';stop_owned(15173)
if web.exists():shutil.rmtree(web)
shutil.copytree(root/'apps/tenant-portal/dist',web);stop_owned(18080)
env=dict(os.environ,SERVER_PORT='18080',SERVER_ADDRESS='127.0.0.1',DB_URL='jdbc:postgresql://127.0.0.1:15432/procurement_agency_p0',DB_USERNAME='procurement',DB_PASSWORD=secrets['P0_DB_PASSWORD'],MINIO_ENDPOINT='http://127.0.0.1:19020',MINIO_ACCESS_KEY='p0minio',MINIO_SECRET_KEY=secrets['P0_MINIO_PASSWORD'],MINIO_BUCKET='24bm-p0-attachments',JWT_SECRET=secrets['JWT_SECRET'],APP_SEED_LOCATIONS='classpath:db/demo',ALLOW_DEMO_JWT_SECRET='false',SELF_LOGIN_ENABLED='true',CORS_ALLOWED_ORIGINS='http://localhost:15173,http://127.0.0.1:15173',AGENCY_OFFICE_ENABLED='false',KEYCLOAK_ENABLED='false',DOCUMENT_TOOLS_OCR_ENABLED='true',DOCUMENT_TOOLS_TESSERACT='/opt/homebrew/bin/tesseract',DOCUMENT_TOOLS_TESSDATA=str(runtime/'ocr-tessdata'),DOCUMENT_TOOLS_SOFFICE='/Applications/LibreOffice.app/Contents/MacOS/soffice')
for k in ['PROCUREMENT_AI_ENABLED','PROCUREMENT_AI_ENDPOINT','PROCUREMENT_AI_API_KEY','PROCUREMENT_AI_MODEL','PROCUREMENT_AI_ENABLE_THINKING']:env[k]=provider[k]
def launch(args,logname,env):
 path=runtime/logname;fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
 with os.fdopen(fd,'ab') as log:return subprocess.Popen(args,cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
backend=launch([java,'-Xms128m','-Xmx512m','-jar',str(release),'--spring.profiles.active=local'],'p7-walkthrough-backend.log',env)
for i in range(100):
 if backend.poll() is not None:raise RuntimeError('Backend exited; inspect private log')
 try:
  with urllib.request.urlopen('http://127.0.0.1:18080/actuator/health',timeout=2) as r:
   if json.load(r)['status']=='UP':break
 except Exception:pass
 time.sleep(.5)
else:raise RuntimeError('Backend health check timeout')
portal=launch(['python3',str(root/'scripts/p7-walkthrough-web.py')],'p7-walkthrough-web.log',dict(os.environ))
state={'backendPid':backend.pid,'portalPid':portal.pid,'backendSha256':digest,'url':'http://127.0.0.1:15173','scope':'local walkthrough only','model':provider['PROCUREMENT_AI_MODEL']};path=runtime/'walkthrough-service.json';path.write_text(json.dumps(state,indent=2));path.chmod(0o600);print('Walkthrough deployment ready:',state['url'],'model:',state['model'])
