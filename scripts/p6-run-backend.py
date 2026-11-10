#!/usr/bin/env python3
from pathlib import Path
import os,runpy
root=Path(__file__).resolve().parents[1]
office_file=root/'.p0/p6-office.env'
values=dict(l.split('=',1) for l in office_file.read_text().splitlines() if '=' in l) if office_file.is_file() else {}
os.environ.update(AGENCY_OFFICE_ENABLED='true' if os.environ.get('P6_OFFICE_ENABLED')=='1' else 'false',AGENCY_OFFICE_PUBLIC_URL='http://127.0.0.1:18088',AGENCY_OFFICE_INTERNAL_URL='http://127.0.0.1:18088',AGENCY_OFFICE_BRIDGE_URL='http://host.docker.internal:18080',AGENCY_OFFICE_JWT_SECRET=values.get('OFFICE_JWT_SECRET',''))
os.environ.update(DOCUMENT_TOOLS_OCR_ENABLED='true',DOCUMENT_TOOLS_TESSERACT='/opt/homebrew/bin/tesseract',DOCUMENT_TOOLS_TESSDATA=str(root/'.p0/ocr-tessdata'),DOCUMENT_TOOLS_SOFFICE='/Applications/LibreOffice.app/Contents/MacOS/soffice')
if os.environ.get('P6_SMS_CONTRACT')=='1':
    sms=dict(l.split('=',1) for l in (root/'.p0/p6-sms.env').read_text().splitlines() if '=' in l)
    os.environ.update(AGENCY_SMS_URL='http://127.0.0.1:18089/send',AGENCY_SMS_SECRET=sms['SMS_SECRET'],AGENCY_SMS_ENCRYPTION_KEY=sms['SMS_ENCRYPTION'])
if os.environ.get('P6_SSO_CONTRACT')=='1':
    os.environ.update(KEYCLOAK_ENABLED='true',KEYCLOAK_ISSUER_URI='http://127.0.0.1:18090/realms/agency-contract',KEYCLOAK_JWK_SET_URI='http://127.0.0.1:18090/jwks',KEYCLOAK_AUDIENCE='24bm-agency',KEYCLOAK_BUYER_IDENTITY_MAPPING_REQUIRED='true')
provider_file=root/'.p0/bailian.env'
if provider_file.is_file():
    if provider_file.is_symlink():raise RuntimeError('Refuse symlink provider configuration')
    provider=dict(l.split('=',1) for l in provider_file.read_text().splitlines() if '=' in l)
    for key in ['PROCUREMENT_AI_ENABLED','PROCUREMENT_AI_ENDPOINT','PROCUREMENT_AI_API_KEY','PROCUREMENT_AI_MODEL','PROCUREMENT_AI_ENABLE_THINKING']:
        if key in provider:os.environ[key]=provider[key]
runpy.run_path(str(root/'scripts/p0-run-backend.py'),run_name='__main__')
