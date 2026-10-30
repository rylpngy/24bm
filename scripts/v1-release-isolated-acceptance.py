import hashlib, json, os, pathlib, re, socket, subprocess, time, urllib.request

src = pathlib.Path(__file__).resolve().parent.parent
assert os.environ.get('ACCEPTANCE_LOCAL_WRITES') == '1', 'Explicit isolated-write opt-in required'
release = pathlib.Path(os.environ['ACCEPTANCE_RELEASE_DIR'])
out = src / '.tmp' / ('v1-release-' + str(int(time.time())))
out.mkdir(parents=True)
cfg = json.loads((release / 'runtime.json').read_text())
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = str(sock.getsockname()[1])
base = 'http://127.0.0.1:' + port
db = 'procurement_stage3_acceptance_' + str(int(time.time()))
container = '24bid-quality-hardening-postgres'
def docker(*args, **kwargs):
    return subprocess.run(['docker', 'exec', '-i', container, *args], check=True, **kwargs)
docker('createdb', '-U', 'procurement', db)
with (out / 'database.dump').open('wb') as f:
    subprocess.run(['docker', 'exec', 'procurement-saas-postgres', 'pg_dump', '-U', 'procurement', '-d', 'procurement_saas_base', '-Fc'], stdout=f, check=True)
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
env['DB_PASSWORD'] = next(x.split('=', 1)[1] for x in json.loads(subprocess.check_output(['docker','inspect',container,'--format','{{json .Config.Env}}'], text=True)) if x.startswith('POSTGRES_PASSWORD='))
log = (out / 'backend.log').open('wb')
p = subprocess.Popen(['/opt/homebrew/opt/openjdk@21/bin/java', '-Xmx768m', '-jar', str(release / 'backend.jar')], env=env, stdout=log, stderr=log)
result = {'database': db, 'base': base, 'release': str(release), 'reports': [], 'passed': False}
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
        'ACCEPTANCE_FOREIGN_BUYER_ACCOUNT': 'buyer.owner@example.com', 'ACCEPTANCE_FOREIGN_TENANT': 'tenant-acme', 'ACCEPTANCE_API_PORT': port,
        'ACCEPTANCE_STAGE_THREE_READY': '1', 'ACCEPTANCE_EXPECTED_DB': db, 'ACCEPTANCE_WINDOW_SECONDS': '60',
        'ACCEPTANCE_BACKEND_SHA256': hashlib.sha256((release/'backend.jar').read_bytes()).hexdigest()}
    docker('psql', '-U', 'procurement', '-d', db, '-v', 'ON_ERROR_STOP=1', input=("update users set password_hash='" + hashed + "' where email='buyer.owner@example.com';").encode(), stdout=subprocess.DEVNULL)
    for script in ['mall-stage-three-acceptance', 'mall-procurement-stage-three-acceptance', 'procurement-stage-two-acceptance', 'project-procurement-acceptance']:
        report = out / (script + '.json')
        r = subprocess.run(['node', 'scripts/' + script + '.mjs'], cwd=src,
            env={**testenv, 'ACCEPTANCE_REPORT_PATH': str(report), 'ACCEPTANCE_RESULT_PATH': str(report), 'ACCEPTANCE_DOWNLOAD_DIR': str(out / script)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (out / (script + '.log')).write_bytes(r.stdout)
        result['reports'].append({'script': script, 'exitCode': r.returncode, 'report': str(report)})
        print(script, 'PASS' if r.returncode == 0 else 'FAIL', flush=True)
    result['passed'] = all(x['exitCode'] == 0 for x in result['reports'])
    finance = subprocess.run(['node', 'scripts/mall-finance-closeout-acceptance.mjs'], cwd=src, env={**testenv,
        'ACCEPTANCE_BROWSER_DIR': str(out)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
    (out/'mall-finance-closeout-acceptance.log').write_bytes(finance.stdout + finance.stderr)
    result['mallFinancePassed'] = finance.returncode == 0
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        uiport = str(sock.getsockname()[1])
    ui = subprocess.Popen(['node', str(src/'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', uiport, '--strictPort'],
        cwd=src/'apps/tenant-portal', env={**os.environ, 'DEV_API_PROXY_TARGET': base}, stdout=log, stderr=log)
    try:
        time.sleep(3)
        br = subprocess.run(['node', 'scripts/v1-rfq-browser-acceptance.mjs'], cwd=src, env={**testenv,
            'ACCEPTANCE_BROWSER_DIR': str(out), 'ACCEPTANCE_FIXTURE_PATH': str(out/'procurement-stage-two-acceptance.json'),
            'ACCEPTANCE_FRONTEND_URL': 'http://127.0.0.1:'+uiport}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
        (out/'browser.log').write_bytes(br.stdout)
        result['browserPassed'] = br.returncode == 0
        market = subprocess.run(['node', 'scripts/v1-market-browser-acceptance.mjs'], cwd=src, env={**testenv,
            'ACCEPTANCE_BROWSER_DIR': str(out)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=240)
        (out/'market-browser.log').write_bytes(market.stdout + market.stderr)
        result['marketBrowserPassed'] = market.returncode == 0
    finally:
        ui.terminate()
        ui.wait(timeout=20)
finally:
    p.terminate()
    p.wait(timeout=40)
    log.close()
    (out / 'summary.json').write_text(json.dumps(result, indent=2))
    print(str(out), flush=True)
if not result['passed'] or not result.get('browserPassed') or not result.get('marketBrowserPassed') or not result.get('mallFinancePassed'):
    raise SystemExit(1)

