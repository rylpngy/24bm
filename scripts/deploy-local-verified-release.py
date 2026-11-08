"""Publish built local portals with the already-verified, unchanged backend JAR.

Requires a fresh backup manifest and explicit local deployment authorization.
No migrations, seed writes, remote deployment, or database rollback is performed.
"""
import hashlib, json, os, pathlib, shutil, signal, subprocess, time, urllib.request

assert os.environ.get('LOCAL_RELEASE_AUTHORIZED') == '1'
src = pathlib.Path(__file__).resolve().parent.parent
old = pathlib.Path(os.environ['PREVIOUS_LOCAL_RELEASE'])
backup = json.loads(pathlib.Path(os.environ['LOCAL_BACKUP_MANIFEST']).read_text())
assert backup['database'] == 'procurement_saas_base'
assert time.time() - pathlib.Path(backup['root']).stat().st_mtime < 3600, 'Use a fresh backup'
subprocess.run(['git', 'diff', 'HEAD', '--quiet'], cwd=src, check=True)
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=src, text=True).strip()
cfg = json.loads((old/'runtime.json').read_text())
assert cfg['env']['DB_URL'] == 'jdbc:postgresql://127.0.0.1:5432/procurement_saas_base'
assert cfg['env']['APP_SEED_LOCATIONS'] == ''
expected = json.loads((pathlib.Path(backup['root'])/'fingerprints.json').read_text())
def compare():
    query = ' union all '.join("select '"+t+"' name,count(*)::int rows,md5(coalesce(string_agg(md5(row_to_json(r)::text),'' order by md5(row_to_json(r)::text)),'')) digest from public.\""+t+'" r' for t in expected['tables'])
    result = subprocess.check_output(['docker','exec','-i','procurement-saas-postgres','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','procurement','-d',backup['database']], input=('begin read only;select json_agg(t) from ('+query+') t;commit;').encode())
    assert {r['name']:(r['rows'],r['digest']) for r in json.loads(result)} == {r['name']:(r['rows'],r['digest']) for r in expected['rows']}, 'Business data changed; stop and reconcile'
compare()
root = old.parent / ('v1-' + sha[:12] + '-' + str(int(time.time())))
root.mkdir(mode=0o700)
for app in cfg['apps']:
    assert (src/'apps'/app/'dist/index.html').exists()
    shutil.copytree(src/'apps'/app/'dist', root/app)
for name in ['backend.jar','start.mjs','vite.config.mjs']:
    shutil.copy2(old/name, root/name)
cfg.update(root=str(root), checkout=str(src), sha=sha, vite=str(src/'node_modules/vite/bin/vite.js'))
(root/'runtime.json').write_text(json.dumps(cfg, indent=2))
(root/'runtime.json').chmod(0o600)
processes = json.loads((old/'processes.json').read_text())
def stop(owned, folder):
    for item in owned:
        p = subprocess.run(['ps','-p',str(item['pid']),'-o','command='], capture_output=True, text=True)
        if p.returncode != 0: continue
        assert str(folder) in p.stdout, 'Refuse unrelated PID'
        os.kill(item['pid'], signal.SIGTERM)
    for _ in range(40):
        if all(subprocess.run(['kill','-0',str(item['pid'])],capture_output=True).returncode != 0 for item in owned): return
        time.sleep(1)
    raise RuntimeError('Service stop timed out')
def health(url):
    for _ in range(90):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200: return
        except Exception: pass
        time.sleep(1)
    raise RuntimeError('Health check timeout')
stop(processes, old)
try:
    subprocess.run(['node', str(root/'start.mjs')], cwd=src, check=True, timeout=180)
    for port in range(5173, 5177): health('http://127.0.0.1:'+str(port)+'/')
    health('http://127.0.0.1:8080/api/v1/health')
    compare()
except Exception:
    if (root/'processes.json').exists(): stop(json.loads((root/'processes.json').read_text()), root)
    subprocess.run(['node',str(old/'start.mjs')], cwd=src, check=True, timeout=180)
    raise
result = {'sha':sha,'root':str(root),'previous':str(old),'backup':backup['root'],
    'backendReusedUnchanged':True,'backendSha256':hashlib.sha256((root/'backend.jar').read_bytes()).hexdigest(),
    'database':backup['database'],'tablesUnchanged':len(expected['tables']),'localOnly':True,'remoteMerged':False}
(root/'release.json').write_text(json.dumps(result,indent=2))
(src/'.tmp/v1-current-release.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
