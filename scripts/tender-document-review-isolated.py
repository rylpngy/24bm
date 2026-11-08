import hashlib, json, os, pathlib, re, shutil, socket, subprocess, time, urllib.request

src = pathlib.Path(__file__).resolve().parent.parent
assert os.environ.get('ACCEPTANCE_LOCAL_WRITES') == '1', 'Explicit isolated-write opt-in required'
release = pathlib.Path(os.environ['ACCEPTANCE_RELEASE_DIR'])
out = src / '.tmp' / ('tender-review-' + str(int(time.time())))
out.mkdir(parents=True)
cfg = json.loads((release / 'runtime.json').read_text())
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = str(sock.getsockname()[1])
base = 'http://127.0.0.1:' + port
db = 'v1_closeout_' + str(int(time.time()))
container = 'procurement-saas-postgres'
def docker(*args, **kwargs):
    return subprocess.run(['docker', 'exec', '-i', container, *args], check=True, **kwargs)
docker('createdb', '-U', 'procurement', db)
with (out / 'database.dump').open('wb') as f:
    docker('pg_dump', '-U', 'procurement', '-d', 'procurement_saas_base', '-Fc', stdout=f)
with (out / 'database.dump').open('rb') as f:
    docker('pg_restore', '-U', 'procurement', '-d', db, '--no-owner', '--no-acl', stdin=f)
# Only the isolated copy gets known demo credentials; the source remains untouched.
crypto = next(pathlib.Path('/Users/epl/.m2/repository/org/springframework/security/spring-security-crypto').glob('*/spring-security-crypto-*.jar'))
logging = next(pathlib.Path('/Users/epl/.m2/repository/commons-logging/commons-logging').glob('*/*.jar'))
hashed = subprocess.check_output(['/opt/homebrew/opt/openjdk@21/bin/java', '--class-path', str(crypto) + ':' + str(logging), str(src / 'scripts/AcceptanceHash.java')], text=True).strip()
docker('psql', '-U', 'procurement', '-d', db, '-v', 'ON_ERROR_STOP=1',
       input=("update users set password_hash='" + hashed + "' where email in ('platform.admin@example.com','supplier.sales@example.com');").encode(), stdout=subprocess.DEVNULL)
env = {**os.environ, **cfg['env'], 'DB_URL': 'jdbc:postgresql://127.0.0.1:5432/' + db,
       'SERVER_PORT': port, 'APP_SEED_LOCATIONS': '', 'MINIO_BUCKET': '24bid-v1-closeout-' + db.replace('_','-')}
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
    testenv = {**os.environ, 'JAVA_API_BASE_URL': base, 'ACCEPTANCE_LOCAL_WRITES': '1',
        'ACCEPTANCE_PASSWORD': 'demo123456', 'ACCEPTANCE_BUYER_PASSWORD': 'demo123456',
        'ACCEPTANCE_PLATFORM_PASSWORD': 'demo123456', 'ACCEPTANCE_SUPPLIER_PASSWORD': 'demo123456',
        'ACCEPTANCE_PLATFORM_ACCOUNT': 'platform.admin@example.com',
        'ACCEPTANCE_SUPPLIER_ACCOUNT': 'supplier.sales@example.com', 'ACCEPTANCE_SUPPLIER_ID': 'ent-supplier-sunrise',
        'ACCEPTANCE_FOREIGN_BUYER_ACCOUNT': 'buyer.owner@example.com', 'ACCEPTANCE_FOREIGN_TENANT': 'tenant-acme'}
    docker('psql', '-U', 'procurement', '-d', db, '-v', 'ON_ERROR_STOP=1', input=("update users set password_hash='" + hashed + "' where email='buyer.owner@example.com';").encode(), stdout=subprocess.DEVNULL)
    for script in ['tender-document-review-acceptance']:
        report = out / (script + '.json')
        r = subprocess.run(['node', 'scripts/' + script + '.mjs'], cwd=src,
            env={**testenv, 'ACCEPTANCE_REPORT_PATH': str(report), 'ACCEPTANCE_DOWNLOAD_DIR': str(out / script)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (out / (script + '.log')).write_bytes(r.stdout)
        result['reports'].append({'script': script, 'exitCode': r.returncode, 'report': str(report)})
        print(script, 'PASS' if r.returncode == 0 else 'FAIL', flush=True)
    result['passed'] = all(x['exitCode'] == 0 for x in result['reports'])
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        uiport = str(sock.getsockname()[1])
    ui = subprocess.Popen(['node', str(src/'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', uiport, '--strictPort'],
        cwd=src/'apps/tenant-portal', env={**os.environ, 'DEV_API_PROXY_TARGET': base}, stdout=log, stderr=log)
    try:
        time.sleep(3)
        br = subprocess.run(['node', 'scripts/tender-document-review-browser.mjs'], cwd=src, env={**testenv,
            'ACCEPTANCE_BROWSER_DIR': str(out), 'ACCEPTANCE_FIXTURE_PATH': str(out/'tender-document-review-acceptance.json'),
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
