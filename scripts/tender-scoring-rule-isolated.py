import hashlib, json, os, pathlib, re, shutil, socket, subprocess, time, urllib.request

src = pathlib.Path(__file__).resolve().parent.parent
assert os.environ.get('ACCEPTANCE_LOCAL_WRITES') == '1', 'Explicit isolated-write opt-in required'
release = pathlib.Path(os.environ['ACCEPTANCE_RELEASE_DIR'])
out = src / '.tmp' / ('tender-scoring-' + str(int(time.time())))
out.mkdir(parents=True, mode=0o700)
cfg = json.loads((release / 'runtime.json').read_text())
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = str(sock.getsockname()[1])
base = 'http://127.0.0.1:' + port
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    uiport = str(sock.getsockname()[1])
db = 'procurement_stage3_acceptance_' + str(int(time.time()))
container = '24bid-quality-hardening-postgres'
def docker(*args, **kwargs):
    return subprocess.run(['docker', 'exec', '-i', container, *args], check=True, **kwargs)
docker('createdb', '-U', 'procurement', db)
with (out / 'database.dump').open('wb') as f:
    (out / 'database.dump').chmod(0o600)
    subprocess.run(['docker','exec','procurement-saas-postgres','pg_dump','-U','procurement','-d','procurement_saas_base','-Fc'],stdout=f,check=True)
with (out / 'database.dump').open('rb') as f:
    docker('pg_restore', '-U', 'procurement', '-d', db, '--no-owner', '--no-acl', stdin=f)
# Only the isolated copy gets known demo credentials; the source remains untouched.
crypto = next(pathlib.Path('/Users/epl/.m2/repository/org/springframework/security/spring-security-crypto').glob('*/spring-security-crypto-*.jar'))
logging = next(pathlib.Path('/Users/epl/.m2/repository/commons-logging/commons-logging').glob('*/*.jar'))
hashed = subprocess.check_output(['/opt/homebrew/opt/openjdk@21/bin/java', '--class-path', str(crypto) + ':' + str(logging), str(src / 'scripts/AcceptanceHash.java')], text=True).strip()
docker('psql', '-U', 'procurement', '-d', db, '-v', 'ON_ERROR_STOP=1',
       input=("update users set password_hash='" + hashed + "' where email in ('platform.admin@example.com','supplier.sales@example.com');").encode(), stdout=subprocess.DEVNULL)
env = {**os.environ, **cfg['env'], 'DB_URL': 'jdbc:postgresql://127.0.0.1:25432/' + db,
       'SERVER_PORT': port, 'APP_SEED_LOCATIONS': '', 'MINIO_BUCKET': '24bid-v1-closeout-' + db.replace('_','-')}
env['DB_PASSWORD']=next(x.split('=',1)[1] for x in json.loads(subprocess.check_output(['docker','inspect',container,'--format','{{json .Config.Env}}'],text=True)) if x.startswith('POSTGRES_PASSWORD='))
env['CORS_ALLOWED_ORIGINS']='http://127.0.0.1:'+uiport
log = (out / 'backend.log').open('wb')
jar=out/'backend.jar'
shutil.copy2(src/'backend-java/target/procurement-saas-backend-0.1.0-SNAPSHOT.jar',jar)
p = subprocess.Popen(['/opt/homebrew/opt/openjdk@21/bin/java', '-Xmx768m', '-jar', str(jar)], env=env, stdout=log, stderr=log)
result = {'database': db, 'base': base, 'release': str(release), 'reports': [], 'passed': False}
result['backendSha256'] = hashlib.sha256(jar.read_bytes()).hexdigest()
try:
    for i in range(180):
        if p.poll() is not None: raise RuntimeError('Backend exited, inspect isolated log')
        try:
            urllib.request.urlopen(base + '/api/v1/health', timeout=2)
            break
        except Exception: time.sleep(1)
    else: raise RuntimeError('Health timeout')
    print('Isolated API ' + base, flush=True)
    if os.environ.get('ACCEPTANCE_SYNC_CONTRACTS') == '1':
        subprocess.run(['node', 'scripts/export-backend-openapi.mjs'], cwd=src,
            env={**os.environ, 'BACKEND_OPENAPI_URL': base + '/v3/api-docs'}, check=True)
        subprocess.run(['pnpm', '--filter', '@24bid/api-client', 'run', 'generate'], cwd=src, check=True)
    testenv = {**os.environ, 'JAVA_API_BASE_URL': base, 'ACCEPTANCE_LOCAL_WRITES': '1',
        'ACCEPTANCE_PASSWORD': 'demo123456', 'ACCEPTANCE_BUYER_PASSWORD': 'demo123456',
        'ACCEPTANCE_PLATFORM_PASSWORD': 'demo123456', 'ACCEPTANCE_SUPPLIER_PASSWORD': 'demo123456',
        'ACCEPTANCE_PLATFORM_ACCOUNT': 'platform.admin@example.com',
        'ACCEPTANCE_SUPPLIER_ACCOUNT': 'supplier.sales@example.com', 'ACCEPTANCE_SUPPLIER_ID': 'ent-supplier-sunrise',
        'ACCEPTANCE_FOREIGN_BUYER_ACCOUNT': 'buyer.owner@example.com', 'ACCEPTANCE_FOREIGN_TENANT': 'tenant-acme','ACCEPTANCE_API_PORT':port,'ACCEPTANCE_STAGE_THREE_READY':'1','ACCEPTANCE_EXPECTED_DB':db,'ACCEPTANCE_BACKEND_SHA256':result['backendSha256'],'ACCEPTANCE_WINDOW_SECONDS':'60'}
    docker('psql', '-U', 'procurement', '-d', db, '-v', 'ON_ERROR_STOP=1', input=("update users set password_hash='" + hashed + "' where email='buyer.owner@example.com';").encode(), stdout=subprocess.DEVNULL)
    scripts = ['tender-scoring-rule-acceptance','mall-procurement-stage-three-acceptance']
    if os.environ.get('ACCEPTANCE_DELIVERY_SWEEP') == '1':
        scripts += ['budget-business-acceptance', 'srm-deepening-acceptance',
                    'procurement-stage-two-acceptance', 'project-procurement-acceptance']
    for script in scripts:
        report = out / (script + '.json')
        r = subprocess.run(['node', 'scripts/' + script + '.mjs'], cwd=src,
            env={**testenv, 'ACCEPTANCE_REPORT_PATH': str(report), 'ACCEPTANCE_RESULT_PATH': str(report), 'ACCEPTANCE_DOWNLOAD_DIR': str(out / script)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
        (out / (script + '.log')).write_bytes(r.stdout)
        result['reports'].append({'script': script, 'exitCode': r.returncode, 'report': str(report)})
        print(script, 'PASS' if r.returncode == 0 else 'FAIL', flush=True)
    result['passed'] = all(x['exitCode'] == 0 for x in result['reports'])
    ui = subprocess.Popen(['node', str(src/'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', uiport, '--strictPort'],
        cwd=src/'apps/tenant-portal', env={**os.environ, 'DEV_API_PROXY_TARGET': base}, stdout=log, stderr=log)
    try:
        time.sleep(3)
        br = subprocess.run(['node', 'scripts/tender-scoring-rule-browser.mjs'], cwd=src, env={**testenv,
            'ACCEPTANCE_BROWSER_DIR': str(out), 'ACCEPTANCE_FIXTURE_PATH': str(out/'tender-scoring-rule-acceptance.json'),
            'ACCEPTANCE_STAGE3_FIXTURE_PATH': str(out/'mall-procurement-stage-three-acceptance.json'),
            'ACCEPTANCE_FRONTEND_URL': 'http://127.0.0.1:'+uiport}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
        (out/'browser.log').write_bytes(br.stdout)
        result['browserPassed'] = br.returncode == 0
    finally:
        ui.terminate()
        ui.wait(timeout=20)
finally:
    p.terminate()
    p.wait(timeout=40)
    log.close()
    (out / 'summary.json').write_text(json.dumps(result, indent=2))
    print(str(out), flush=True)
if not result['passed'] or not result.get('browserPassed'):
    raise SystemExit(1)
