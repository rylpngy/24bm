#!/usr/bin/env python3
"""Owned synthetic DB + object-store recovery into fresh destinations; never overwrite source."""
from pathlib import Path
import subprocess,os,time,json,hashlib,shlex,signal,argparse
root=Path(__file__).resolve().parents[1];stamp=str(int(time.time()));database='p6_restore_'+stamp;bucket='24bm-p6-restore-'+stamp
assert database.startswith('p6_restore_') and bucket.startswith('24bm-p6-restore-')
parser=argparse.ArgumentParser();parser.add_argument('--backup-dir',type=Path);args=parser.parse_args();folder=args.backup_dir.resolve() if args.backup_dir else root/'.p0'/('p6-recovery-'+stamp)
assert folder.parent.resolve()==(root/'.p0').resolve() and folder.name.startswith('p6-recovery-')
if not args.backup_dir:folder.mkdir(mode=0o700)
def run(args,**kw):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180,**kw).stdout
def pg(args,**kw):return run(['docker','exec','-i','24bm-p0-postgres-1',*args],**kw)
def sql(db,q):return pg(['psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','procurement','-d',db],input=q.encode()).decode().strip()
def mc(cmd,data=None):return run(['docker','exec','-i','24bm-p0-minio-1','sh','-c','export MC_HOST_p0="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; '+cmd],input=data)
def obj(target):return shlex.quote('p0/'+target)
def sha(data):return hashlib.sha256(data).hexdigest()
def save(path,data):
 path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as stream:stream.write(data)
def fingerprints(db,tables):
 return {t:sql(db,'select count(*)::text||\':\'||md5(coalesce(string_agg(md5(row_to_json(r)::text),\'\' order by md5(row_to_json(r)::text)),\'\')) from public."'+t.replace('"','""')+'" r') for t in tables}
created_db=False;created_bucket=False;stopped=False;started=time.monotonic();checks=[]
try:
 if args.backup_dir:
  snapshot=json.loads((folder/'inventory.json').read_text());before=snapshot['rows'];tables=list(before);inventory=snapshot['objects'];dump=(folder/'database.dump').read_bytes();assert sha(dump)==snapshot['databaseSha256'];checks.append('Previously captured quiesced DB/object backup verified; live source remains running and is not overwritten')
 else:
  pid=int(run(['lsof','-tiTCP:18080','-sTCP:LISTEN']).decode().strip());command=run(['ps','-p',str(pid),'-o','command=']).decode();assert 'com.procurement.ProcurementApplication' in command,'Only owned isolated application may stop'
  os.kill(pid,signal.SIGTERM);stopped=True
  for i in range(40):
   if subprocess.run(['lsof','-tiTCP:18080','-sTCP:LISTEN'],stdout=subprocess.DEVNULL).returncode==1:break
   time.sleep(.25)
  else:raise RuntimeError('Isolated writer did not stop')
  tables=json.loads(sql('procurement_agency_p0',"select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"));before=fingerprints('procurement_agency_p0',tables)
  dump=pg(['pg_dump','-U','procurement','-d','procurement_agency_p0','-Fc','--no-owner','--no-acl']);save(folder/'database.dump',dump)
  objects=[json.loads(x) for x in mc('mc ls --recursive --json p0/24bm-p0-attachments').decode().splitlines() if x];objects=[x for x in objects if x.get('type')=='file'];assert sum(x['size'] for x in objects)<512*1024*1024,'Bounded synthetic drill only'
  inventory=[]
  for x in objects:
   key=x['key'];assert not Path(key).is_absolute() and '..' not in Path(key).parts
   data=mc('mc cat '+obj('24bm-p0-attachments/'+key));save(folder/'objects'/key,data);inventory.append({'key':key,'size':len(data),'sha256':sha(data)})
  save(folder/'inventory.json',json.dumps({'databaseSha256':sha(dump),'rows':before,'objects':inventory},ensure_ascii=False).encode())
  assert fingerprints('procurement_agency_p0',tables)==before
  checks.append('Owned isolated writer quiesced; all public DB rows and attachment originals captured at one stable boundary')
 pg(['createdb','-U','procurement',database]);created_db=True;pg(['pg_restore','-U','procurement','-d',database,'--no-owner','--no-acl','--exit-on-error'],input=dump)
 assert fingerprints(database,tables)==before;checks.append('Fresh database restored with identical complete-row fingerprints across all '+str(len(tables))+' public tables')
 mc('mc mb '+obj(bucket));created_bucket=True
 for ordinal,x in enumerate(inventory,1):
  data=(folder/'objects'/x['key']).read_bytes();assert sha(data)==x['sha256'];mc('mc pipe --part-size 16MiB --concurrent 1 '+obj(bucket+'/'+x['key']),data);assert sha(mc('mc cat '+obj(bucket+'/'+x['key'])))==x['sha256']
  if ordinal%100==0:print('Restored and verified',ordinal,'of',len(inventory),'objects',flush=True)
 checks.append('Fresh bucket restored '+str(len(inventory))+' original objects with byte size and SHA256 verification')
 # Prove restored metadata resolves to restored object bytes, not merely independent inventories.
 refs=json.loads(sql(database,"select coalesce(json_agg(x),'[]'::json) from (select v.id,v.hash as file_hash,v.content_size as byte_size,a.storage_key from agency_file_versions v join attachments a on a.id=v.attachment_id where v.status='sealed') x"))
 bykey={x['key']:x for x in inventory}
 for ref in refs:
  objrow=bykey.get(ref['storage_key']);assert objrow is not None,'Restored attachment metadata has no restored object';assert objrow['sha256']==ref['file_hash'];assert objrow['size']==ref['byte_size']
 checks.append('Restored sealed agency attachment references resolve to restored bucket objects with matching persisted hashes and sizes: '+str(len(refs)))
 result={'time':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'scope':'Local synthetic cold recovery; not production RPO/RTO. Source targets never overwritten. Private backups excluded from delivery.','checks':checks,'tables':len(tables),'objects':len(inventory),'objectBytes':sum(x['size'] for x in inventory),'sealedReferences':len(refs),'elapsedSeconds':round(time.monotonic()-started,2)}
 (root/'docs/agency/evidence/p6-combined-restore.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('\n'.join('PASS '+x for x in checks),flush=True)
finally:
 try:
  if created_db:pg(['dropdb','-U','procurement',database])
  if created_bucket:mc('mc rb --force '+obj(bucket))
 finally:
  if stopped:
   log=(root/'.p0/backend-p6-office.log').open('ab');subprocess.Popen(['python3',str(root/'scripts/p6-run-backend.py')],cwd=root,stdout=log,stderr=log,start_new_session=True);log.close()
