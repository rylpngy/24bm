#!/usr/bin/env python3
"""Create private local contract keys; preserve existing values and never print secrets."""
from pathlib import Path
import os,secrets,base64
root=Path(__file__).resolve().parents[1]/'.p0';root.mkdir(exist_ok=True)
values={'p6-office.env':{'OFFICE_JWT_SECRET':secrets.token_urlsafe(48)},'p6-sms.env':{'SMS_SECRET':secrets.token_urlsafe(48),'SMS_ENCRYPTION':base64.b64encode(secrets.token_bytes(32)).decode()}}
for name,config in values.items():
 path=root/name
 try:fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 except FileExistsError:print('Preserved private local key file:',name);continue
 with os.fdopen(fd,'w') as stream:stream.write('\n'.join(k+'='+v for k,v in config.items())+'\n')
 print('Created private local key file:',name)
