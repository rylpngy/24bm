#!/usr/bin/env python3
"""Read-only configuration preflight. Prints check names only, never secret values."""
from pathlib import Path
import argparse,os,json,base64,shutil,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--env-file',type=Path);p.add_argument('--profile',choices=['technical','production'],default='technical');p.add_argument('--output',type=Path);a=p.parse_args();env=dict(os.environ)
if a.env_file:
 for line in a.env_file.read_text().splitlines():
  if line.strip() and not line.lstrip().startswith('#') and '=' in line:
   k,v=line.split('=',1);env[k.strip()]=v.strip()
checks=[]
def check(name,ok,detail):checks.append({'name':name,'passed':bool(ok),'detail':detail})
def enabled(name):return env.get(name,'false').lower()=='true'
def strong(name):return len(env.get(name,'').encode())>=32
def endpoint(name,https=False):
 try:u=urllib.parse.urlparse(env.get(name,''));return bool(u.hostname and not u.username and not u.fragment and (u.scheme=='https' if https else u.scheme in ('http','https')))
 except ValueError:return False
prod=a.profile=='production'
check('Database configuration',bool(env.get('DB_URL','').startswith('jdbc:postgresql://') and env.get('DB_USERNAME') and env.get('DB_PASSWORD')),'Database credentials must be provided outside source control')
check('Independent application signing secret',strong('JWT_SECRET'),'At least 32 bytes; reject demo secret')
check('Object storage configuration',endpoint('MINIO_ENDPOINT',prod) and bool(env.get('MINIO_ACCESS_KEY') and env.get('MINIO_SECRET_KEY') and env.get('MINIO_BUCKET')),'TLS required for production storage endpoint')
check('Explicit CORS origins',bool(env.get('CORS_ALLOWED_ORIGINS')) and '*' not in env.get('CORS_ALLOWED_ORIGINS',''),'Use explicit trusted portal origins')
check('Minimum temporary disk space',shutil.disk_usage(Path.cwd()).free>=int(env.get('DEPLOY_MIN_FREE_BYTES',str(1024**3))),'Local temporary workspace only; capacity planning remains operator-owned')
check('AI deferred',not enabled('AGENCY_AI_ENABLED'),'AI remains disabled until user configures service')
if enabled('AGENCY_OFFICE_ENABLED'):
 check('Office transport endpoints',all(endpoint(k,prod) for k in ['AGENCY_OFFICE_PUBLIC_URL','AGENCY_OFFICE_INTERNAL_URL','AGENCY_OFFICE_BRIDGE_URL']),'Check actual editor/callback roundtrip separately')
 check('Independent Office signing key',strong('AGENCY_OFFICE_JWT_SECRET') and env.get('AGENCY_OFFICE_JWT_SECRET')!=env.get('JWT_SECRET'),'Never reuse application signing key')
else:check('Office fallback is explicit',True,'Online editor disabled; whole DOCX download/upload retained')
if env.get('AGENCY_SMS_URL'):
 try:encrypted=len(base64.b64decode(env.get('AGENCY_SMS_ENCRYPTION_KEY',''),validate=True))==32
 except Exception:encrypted=False
 check('SMS gateway and independent keys',endpoint('AGENCY_SMS_URL',prod) and strong('AGENCY_SMS_SECRET') and encrypted and env.get('AGENCY_SMS_SECRET')!=env.get('JWT_SECRET'),'Provider contract and receipt tests required before tenant activation; no test send is performed')
else:check('SMS external sending disabled',True,'No gateway configured; no actual send is performed')
if enabled('DOCUMENT_TOOLS_OCR_ENABLED'):
 check('Local OCR executable',bool(shutil.which(env.get('DOCUMENT_TOOLS_TESSERACT','tesseract'))),'OCR binary must exist in deployed runtime')
 path=Path(env.get('DOCUMENT_TOOLS_TESSDATA','/nonexistent'));check('OCR language assets',all((path/(x+'.traineddata')).is_file() for x in ['chi_sim','eng']),'Language data must accompany binary')
if prod:
 check('Strict external identity mapping',enabled('KEYCLOAK_ENABLED') and enabled('KEYCLOAK_BUYER_IDENTITY_MAPPING_REQUIRED') and endpoint('KEYCLOAK_ISSUER_URI',True) and endpoint('KEYCLOAK_JWK_SET_URI',True) and bool(env.get('KEYCLOAK_AUDIENCE')),'Customer IdP login, account lifecycle and emergency administrator drill remain necessary')
 check('Self-issued login retired',env.get('SELF_LOGIN_ENABLED','').lower()=='false' and env.get('SELF_TOKEN_ACCEPTED','').lower()=='false','Perform only after external identity and emergency recovery verified')
 check('Header fallback disabled',not enabled('TENANT_HEADER_FALLBACK_ENABLED'),'Untrusted tenant headers cannot establish an identity')
 check('Restore evidence supplied',bool(env.get('DEPLOY_RESTORE_EVIDENCE')) and Path(env.get('DEPLOY_RESTORE_EVIDENCE','/nonexistent')).is_file(),'Review evidence and operator RPO/RTO; file existence does not certify production recovery')
result={'profile':a.profile,'ready':all(x['passed'] for x in checks),'scope':'Read-only configuration checks; no deployment, real message, production acceptance or connectivity claim','checks':checks}
if a.output:a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
for c in checks:print(('PASS ' if c['passed'] else 'PENDING ')+c['name'])
raise SystemExit(0 if result['ready'] else 2)
