#!/usr/bin/env python3
"""Private backup/restore of the isolated synthetic database only; fresh clone is removed afterwards."""
from pathlib import Path
import subprocess,os,time,json,hashlib
root=Path(__file__).resolve().parents[1];container='24bm-p0-postgres-1';source='procurement_agency_p0';clone='p5_restore_'+str(int(time.time()));assert clone.startswith('p5_restore_')
backup=root/'.p0/p5-private-backup.dump';fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600);os.chmod(backup,0o600)
def command(args,**kw):return subprocess.run(['docker','exec',container,*args],check=True,stderr=subprocess.PIPE,**kw)
def sql(db,query):return command(['psql','-U','procurement','-d',db,'-At','-v','ON_ERROR_STOP=1','-c',query],stdout=subprocess.PIPE,text=True).stdout.strip()
tables=['agency_packages','agency_file_versions','agency_recommendations','agency_evaluation_reports','agency_report_submissions','agency_report_contributors','agency_post_results','agency_post_documents','agency_finance_accounts','agency_finance_entries','agency_archive_snapshots']
def fingerprints(db):return {table:sql(db,"select count(*)::text||':'||md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by tenant_id,id),'')) from "+table+' x') for table in tables if table!='agency_report_contributors'}|{'agency_report_contributors':sql(db,"select count(*)::text||':'||md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by tenant_id,report_id,user_id),'')) from agency_report_contributors x")}
started=time.monotonic();created=False
try:
 with os.fdopen(fd,'wb') as out:command(['pg_dump','-U','procurement','-d',source,'-Fc','--no-owner','--no-acl'],stdout=out)
 expected=fingerprints(source);command(['createdb','-U','procurement',clone],stdout=subprocess.PIPE);created=True
 with backup.open('rb') as data:subprocess.run(['docker','exec','-i',container,'pg_restore','-U','procurement','-d',clone,'--no-owner','--no-acl','--exit-on-error'],stdin=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
 actual=fingerprints(clone);assert actual==expected,'Restored immutable data differs or source changed concurrently; no restore acceptance claimed'
 result={'passed':1,'checks':['Isolated database pg_dump/pg_restore into a fresh clone preserves complete row fingerprints and counts across 11 lifecycle source, opinion/report, finance and archive tables'],'tables':{key:int(v.split(':')[0]) for key,v in actual.items()},'backupBytes':backup.stat().st_size,'elapsedSeconds':round(time.monotonic()-started,3),'scope':'Synthetic database restore only; original database not overwritten; object-store disaster recovery and production RPO/RTO remain separate'}
 (root/'.p0/p5-restore-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('PASS isolated synthetic database restore: 11 table counts and complete-row fingerprints match',flush=True)
finally:
 if created:command(['dropdb','-U','procurement',clone],stdout=subprocess.PIPE)
