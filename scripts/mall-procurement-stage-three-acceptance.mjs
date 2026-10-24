import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const HELP = `Stage-three real HTTP acceptance (macOS, Node 20+). No SQL, mocks, or server startup.

Required environment AFTER deploying stage three on the isolated listener:
  JAVA_API_BASE_URL=http://127.0.0.1:8095
  ACCEPTANCE_LOCAL_WRITES=1
  ACCEPTANCE_STAGE_THREE_READY=1
  ACCEPTANCE_EXPECTED_DB=srm_acceptance_20261023
  ACCEPTANCE_BACKEND_SHA256=<SHA-256 of the exact deployed executable JAR>
  ACCEPTANCE_PASSWORD=<seeded test-account password>

Optional:
  ACCEPTANCE_PLATFORM_ACCOUNT=platform.admin@example.com
  ACCEPTANCE_SUPPLIER_ACCOUNT=supplier.sales@example.com
  ACCEPTANCE_SUPPLIER_ID=ent-supplier-sunrise
  ACCEPTANCE_FOREIGN_BUYER_ACCOUNT=buyer.owner@example.com
  ACCEPTANCE_FOREIGN_TENANT=tenant-acme
  ACCEPTANCE_WINDOW_SECONDS=120 (60..600; real auction/tender wait, no clock changes)
  ACCEPTANCE_REPORT_PATH=.tmp/mall-procurement-stage-three-<runId>.json

node scripts/mall-procurement-stage-three-acceptance.mjs --check-config
  Offline configuration validation only; does not contact any service.
node scripts/mall-procurement-stage-three-acceptance.mjs
  Creates a fresh tenant, two real Flowable definitions, one admitted supplier,
  auction/single-source RFQs and a prequalified enterprise tender, then orders.
  Single-bidder auction is a private/non-statutory test, not legal quorum proof.
  Leaves evidence in the isolated database; failure is not success or auto-cleanup.
  Executable JAR must contain V223, V225 and the evaluationEligible DTO field.
  No payment, CA, guarantee, shipment, or external-platform acceptance is claimed.
`;

export function validateBase(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '8095'
    && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash,
  'Only the exact loopback origin http://127.0.0.1:8095 is permitted.');
  return url.origin;
}

export function validateDatabase(value, expected) {
  assert.ok(/^(srm_acceptance_|mall_stage3_acceptance_|procurement_stage3_acceptance_)[a-zA-Z0-9_]+$/.test(expected),
    'Expected database must be an explicitly named isolated acceptance database.');
  assert.ok(value?.startsWith('jdbc:postgresql://'), 'Listener must expose its DB_URL environment.');
  const url = new URL(value.slice(5));
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '25432'
    && url.pathname === `/${expected}` && !url.search && !url.hash && !url.username && !url.password,
  'Listener DB_URL must exactly match the isolated database on local PostgreSQL port 25432.');
  return expected;
}

export function validateHealth(payload, now = Date.now()) {
  assert.ok(payload?.success === true && payload.data?.status === 'ok'
    && payload.data.service === 'procurement-saas-backend', 'Wrong API health identity.');
  const time = Date.parse(payload.data.time);
  assert.ok(Number.isFinite(time) && Math.abs(now - time) < 30000, 'Stale health or server clock differs by 30 seconds.');
  return time;
}

export function readConfig(env = process.env) {
  const required = key => { assert.ok(env[key], `Missing ${key}`); return env[key]; };
  const base = validateBase(required('JAVA_API_BASE_URL'));
  assert.ok(env.ACCEPTANCE_LOCAL_WRITES === '1' && env.ACCEPTANCE_STAGE_THREE_READY === '1',
    'Both ACCEPTANCE_LOCAL_WRITES=1 and ACCEPTANCE_STAGE_THREE_READY=1 are required.');
  const database = required('ACCEPTANCE_EXPECTED_DB');
  validateDatabase(`jdbc:postgresql://127.0.0.1:25432/${database}`, database);
  const jarHash = required('ACCEPTANCE_BACKEND_SHA256').toLowerCase();
  assert.ok(/^[a-f0-9]{64}$/.test(jarHash), 'Expected backend SHA-256 must contain 64 hexadecimal characters.');
  const windowSeconds = Number(env.ACCEPTANCE_WINDOW_SECONDS ?? 120);
  assert.ok(Number.isInteger(windowSeconds) && windowSeconds >= 60 && windowSeconds <= 600,
    'Acceptance window must be an integer between 60 and 600 seconds.');
  return { base, database, jarHash, windowSeconds, password: required('ACCEPTANCE_PASSWORD'),
    platformAccount: env.ACCEPTANCE_PLATFORM_ACCOUNT ?? 'platform.admin@example.com',
    supplierAccount: env.ACCEPTANCE_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com',
    supplierId: env.ACCEPTANCE_SUPPLIER_ID ?? 'ent-supplier-sunrise',
    foreignAccount: env.ACCEPTANCE_FOREIGN_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
    foreignTenant: env.ACCEPTANCE_FOREIGN_TENANT ?? 'tenant-acme',
    reportPath: env.ACCEPTANCE_REPORT_PATH };
}

const command = (name, args) => execFileSync(name, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const environmentValue = (text, key) => {
  const values = [...text.matchAll(new RegExp(`(?:^|\\s)${key}=([^\\s]*)`, 'g'))].map(m => m[1]);
  assert.ok(values.length <= 1, `Ambiguous runtime environment: ${key}`);
  return values[0];
};

function runtimeIdentity(config) {
  const pids = [...new Set(command('lsof', ['-nP', '-iTCP:8095', '-sTCP:LISTEN', '-Fp'])
    .split('\n').filter(s => /^p\d+$/.test(s)).map(s => s.slice(1)))];
  assert.ok(pids.length === 1, 'Expected exactly one process listening on 8095.');
  const pid = pids[0];
  // ps output contains secrets. Never log, persist, or include it in assertion output.
  const processText = command('ps', ['eww', '-p', pid, '-o', 'command=']);
  assert.ok(!/--spring\.|-Dspring\.|--server\.|-Dserver\./.test(processText),
    'Runtime command-line overrides are not supported by this safety guard.');
  for (const key of ['SPRING_DATASOURCE_URL', 'SPRING_APPLICATION_JSON', 'SPRING_CONFIG_LOCATION', 'SPRING_CONFIG_ADDITIONAL_LOCATION']) {
    assert.ok(!environmentValue(processText, key), `Unsupported runtime override: ${key}`);
  }
  for (const key of ['JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS']) {
    assert.ok(!environmentValue(processText, key), `Unset ${key} on the isolated backend to make runtime identity unambiguous.`);
  }
  validateDatabase(environmentValue(processText, 'DB_URL'), config.database);
  assert.ok(environmentValue(processText, 'SERVER_PORT') === '8095', 'Runtime SERVER_PORT must explicitly be 8095.');
  const jar = processText.match(/(?:^|\s)-jar\s+(\S+\.jar)(?:\s|$)/)?.[1];
  assert.ok(jar && isAbsolute(jar), 'Only a pinned executable JAR with an absolute path is supported.');
  const path = realpathSync(jar);
  const stat = statSync(path);
  return { pid, jar: path, fingerprint: `${pid}:${path}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}` };
}

async function health(base) {
  const response = await fetch(`${base}/api/v1/health`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  assert.ok(response.status === 200, 'Isolated health request failed.');
  return validateHealth(await response.json());
}

async function initializeGuard(config) {
  const identity = runtimeIdentity(config);
  const actual = createHash('sha256').update(readFileSync(identity.jar)).digest('hex');
  assert.ok(actual === config.jarHash, 'Deployed JAR does not match the explicitly expected SHA-256.');
  const entries = command('unzip', ['-Z1', identity.jar]).split('\n');
  for (const entry of [
    'BOOT-INF/classes/db/migration/V223__mall_purchase_controls_and_checkout.sql',
    'BOOT-INF/classes/db/migration/V225__mall_after_sales_lifecycle.sql',
  ]) assert.ok(entries.includes(entry), `Deployed JAR is not stage three: missing ${entry}`);
  const dto = execFileSync('unzip', ['-p', identity.jar, 'BOOT-INF/classes/com/procurement/tender/api/TenderBidResponse.class']);
  assert.ok(dto.includes(Buffer.from('evaluationEligible')), 'Deployed tender DTO predates the stage-three eligibility fix.');
  await health(config.base);
  const verify = async () => {
    assert.ok(runtimeIdentity(config).fingerprint === identity.fingerprint, '8095 listener or pinned artifact changed; stop and restart acceptance.');
    const time = await health(config.base);
    assert.ok(runtimeIdentity(config).fingerprint === identity.fingerprint, 'Listener changed during health verification.');
    return time;
  };
  return { identity, verify };
}

async function run(config) {
  const runId = `stage3-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const report = { runId, startedAt: new Date().toISOString(), base: config.base, database: config.database,
    passed: false, records: {}, checks: [], failures: [], http: [], scope: 'auction/single-source/tender -> unified orders; no external integrations' };
  const output = resolve(config.reportPath ?? `.tmp/mall-procurement-stage-three-${runId}.json`);
  const secrets = new Set([config.password]);
  const redact = text => [...secrets].reduce((s, secret) => secret ? s.split(secret).join('[REDACTED]') : s, text);
  const checkpoint = () => {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, redact(JSON.stringify(report, null, 2)), { mode: 0o600 });
  };
  const check = name => { report.checks.push(name); checkpoint(); console.log(`PASS ${name}`); };
  const scenario = async (name, action) => {
    try { await action(); }
    catch (error) {
      const failure = { scenario: name, error: redact(error.message ?? String(error)) };
      report.failures.push(failure); checkpoint();
      console.error(`FAIL ${name}: ${failure.error}`);
    }
  };
  try {
    const guard = await initializeGuard(config);
    report.runtime = { pid: guard.identity.pid, jar: guard.identity.jar, sha256: config.jarHash };
    check('8095 health, process, isolated DB and stage-three artifact identity verified before login');
    async function api(path, token, body, method = body === undefined ? 'GET' : 'POST', expected = [200, 201], message) {
      assert.ok(/^[a-z][a-z0-9/?=&_.%-]*$/i.test(path), 'Only relative API paths are permitted.');
      await guard.verify(); // Also guards login and negative-test writes, without following redirects.
      const started = Date.now();
      const response = await fetch(`${config.base}/api/v1/${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      report.http.push({ method, path, status: response.status, elapsedMs: Date.now() - started });
      const text = await response.text();
      let payload;
      try { payload = JSON.parse(text); }
      catch { throw new Error(`${method} ${path}: HTTP ${response.status}, ${text ? 'non-JSON' : 'empty'} response`); }
      assert.ok(expected.includes(response.status), `${method} ${path}: unexpected ${response.status}: ${redact(String(payload.message ?? ''))}`);
      if (response.ok) assert.ok(payload.success === true, `${method} ${path}: unsuccessful API envelope`);
      else {
        assert.ok(payload.success === false, `${method} ${path}: expected structured rejection`);
        if (message) assert.match(payload.message ?? '', message, `${path}: rejection must be for the intended rule`);
      }
      checkpoint();
      return payload.data;
    }
    async function login(account, scope, context = {}) {
      const session = await api('auth/login', null, { account, password: config.password, scope, ...context });
      assert.ok(session?.accessToken && session.scope === scope, 'Wrong authenticated scope.');
      if (context.tenantId) assert.equal(session.tenantId, context.tenantId);
      if (context.supplierId) assert.equal(session.supplierId, context.supplierId);
      secrets.add(session.accessToken);
      return session;
    }
    const platform = await login(config.platformAccount, 'PLATFORM');
    const supplier = await login(config.supplierAccount, 'SUPPLIER', { supplierId: config.supplierId });
    const foreign = await login(config.foreignAccount, 'BUYER', { tenantId: config.foreignTenant });
    const tenantId = runId;
    const buyerAccount = `${runId}@example.com`;
    Object.assign(report, { tenantId, buyerAccount, supplierId: config.supplierId });
    await api('platform/tenants', platform.accessToken, { tenantId, enterpriseId: `ent-${runId}`, name: `Stage three ${runId}`,
      industry: '验收专用', plan: 'MVP', userLimit: 20,
      enabledFeatures: ['rfq', 'order', 'method:auction', 'method:single-source', 'method:tender'],
      adminName: '隔离验收管理员', adminEmail: buyerAccount, adminPassword: config.password });
    const buyer = await login(buyerAccount, 'BUYER', { tenantId });
    const b = buyer.accessToken, s = supplier.accessToken;
    const own = data => { assert.equal(data.tenantId, tenantId, 'Response escaped acceptance tenant'); return data; };
    const department = await api('buyer/departments', b, { name: `Acceptance ${runId}` });
    const material = await api('buyer/materials', b, { code: `MAT-${runId}`, name: '隔离验收设备', category: '验收专用', unit: '台', referencePrice: 1000 });
    report.records.departmentId = department.id; report.records.materialId = material.id;
    const role = (await api('buyer/roles', b)).find(r => r.permissions?.includes('buyer:*'));
    assert.ok(role?.id, 'Fresh tenant needs a real buyer administrator role.');
    report.records.definitions = {};
    for (const businessType of ['buyer_supplier_admission', 'rfq_award']) {
      const definition = await api('buyer/process-definitions', b, { name: `${runId} ${businessType}`, businessType, icon: 'file-text' });
      report.records.definitions[businessType] = definition.id;
      await api(`buyer/process-definitions/${definition.id}`, b, { name: definition.name, businessType, status: 'draft',
        formSchema: JSON.stringify({ fields: [] }),
        flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '实际审批', assignment: { type: 'role', roleId: role.id } }] }) }, 'PUT');
      await api(`buyer/process-definitions/${definition.id}/publish`, b, {});
    }
    async function approve(businessType, businessId) {
      const tasks = (await api('buyer/workflow/tasks', b)).filter(t => t.businessType === businessType && t.businessId === businessId);
      assert.equal(tasks.length, 1, 'Expected exactly one real assigned Flowable task, not automatic approval.');
      const result = await api(`buyer/workflow/tasks/${tasks[0].taskId}/complete`, b, { action: 'approve', comment: `隔离 HTTP 验收 ${runId}` });
      assert.equal(result.status, 'approved');
      const history = await api(`buyer/workflow/instances/business/${businessType}/${businessId}/history`, b);
      assert.equal(history.status, 'approved');
      assert.ok(history.flowableProcessInstanceId && history.events?.some(e => e.action === 'approved'), 'Missing genuine Flowable approval evidence.');
      report.records.workflows ??= [];
      report.records.workflows.push({ businessType, businessId, workflowInstanceId: history.workflowInstanceId,
        flowableProcessInstanceId: history.flowableProcessInstanceId, taskId: tasks[0].taskId, status: history.status });
    }
    const relation = own(await api('buyer/suppliers', b, { supplierId: config.supplierId, status: '待准入', level: '普通', categories: ['验收专用'] }));
    report.records.relationId = relation.id;
    await api(`buyer/suppliers/${relation.id}/submit`, b, { formData: {} });
    await approve('buyer_supplier_admission', relation.id);
    assert.equal((await api('buyer/suppliers', b)).find(r => r.id === relation.id)?.status, '已准入');
    check('fresh tenant, published Flowable definitions and actual supplier admission approval');

    const deadline = new Date((await guard.verify()) + config.windowSeconds * 1000).toISOString();
    const expectedReceiptDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const direct = { demandIds: [], invitedSupplierIds: [config.supplierId], deadlineAt: deadline, saveAsDraft: true,
      directItems: [{ materialId: material.id, quantity: 1 }], directDepartmentId: department.id, directBudget: 1200,
      evaluationMethod: '最低价', quoteRequirement: '按真实采购清单逐行报价', deliveryRequirement: '7天' };
    const auction = own(await api('buyer/rfqs', b, { ...direct, title: `${runId} private auction`, method: '竞价',
      auctionStartPrice: 1000, auctionMinDecrement: 10, auctionPlannedStart: new Date(Date.now() - 1000).toISOString(),
      auctionSoftCloseTriggerMinutes: 0, auctionSoftCloseExtendMinutes: 0, auctionShowLowest: true, auctionShowRank: true }));
    const single = own(await api('buyer/rfqs', b, { ...direct, title: `${runId} single source`, method: '单一来源',
      singleSourceReason: '隔离验收设备已有专有接口，唯一兼容供应商；仅供本次测试，不构成外部法律结论。' }));
    report.records.auction = { rfqId: auction.id }; report.records.singleSource = { rfqId: single.id };
    const rfq = async id => own((await api('buyer/rfqs', b)).find(t => t.id === id) ?? assert.fail(`Missing RFQ ${id}`));
    const quoteBody = (project, amount) => ({ amount, taxRate: 13, deliveryDays: 7,
      lineItems: project.items.map(item => ({ demandItemId: item.demandItemId, description: item.materialName,
        unit: item.unit, quantity: item.quantity, unitPrice: amount })) });
    for (const project of [auction, single]) {
      assert.equal(project.items?.length, 1, 'Real demand-backed procurement item must exist.');
      assert.equal(Number(project.items[0].quantity), 1);
      await api(`buyer/rfqs/${project.id}/publish`, b, {});
      assert.ok((await api('supplier/rfqs', s)).some(r => r.id === project.id), 'Supplier did not receive real invitation.');
    }
    const auctionQuote = await api(`supplier/rfqs/${auction.id}/quotes`, s, quoteBody(auction, 900));
    assert.equal(auctionQuote.supplierId, config.supplierId); assert.equal(Number(auctionQuote.amount), 900);
    report.records.auction.quoteId = auctionQuote.id;
    await api(`supplier/quotes/${auctionQuote.id}`, s, quoteBody(auction, 895), 'PUT', [400, 409], /降|最低|步长/);
    const reducedQuote = await api(`supplier/quotes/${auctionQuote.id}`, s, quoteBody(auction, 850), 'PUT');
    assert.equal(Number(reducedQuote.amount), 850);
    assert.equal(Number((await rfq(auction.id)).auctionLowestAmount), 850);
    assert.equal(Date.parse((await rfq(auction.id)).deadlineAt), Date.parse(deadline), 'Explicitly disabled soft close should not extend this run.');
    const singleQuote = await api(`supplier/rfqs/${single.id}/quotes`, s, quoteBody(single, 700));
    report.records.singleSource.quoteId = singleQuote.id;
    assert.equal(Number(singleQuote.amount), 700);
    assert.deepEqual((await rfq(single.id)).invitedSupplierIds, [config.supplierId]);
    await api(`buyer/rfqs/${auction.id}/open`, b, { force: true }, 'POST', [400, 409], /截止|deadline|开标/i);
    check('actual supplier auction bid/reduction, decrement rejection, no early force-open and sole-source quote');

    let tender = own(await api('buyer/tenders', b, { title: `${runId} enterprise tender`, tenderType: '邀请招标', budget: 1200,
      documentHtml: `<p>HTTP tender evidence ${runId}</p>`, evaluationMethod: '综合评分法',
      acquisitionDeadline: deadline, submissionDeadline: deadline, openingAt: deadline }));
    const tenderId = tender.id;
    report.records.tender = { tenderId };
    await api(`buyer/tenders/${tenderId}/prequalification`, b, { required: true }, 'PUT');
    await api(`buyer/tenders/${tenderId}/publish`, b, {});
    await api(`buyer/tenders/${tenderId}/distribute`, b, { supplierIds: [config.supplierId] });
    const supplierTender = async () => (await api('supplier/tenders', s)).find(t => t.id === tenderId) ?? assert.fail('Missing supplier tender');
    const buyerTender = async () => own((await api('buyer/tenders', b)).find(t => t.id === tenderId) ?? assert.fail('Missing buyer tender'));
    assert.equal((await supplierTender()).documentHtml, null);
    await api(`supplier/tenders/${tenderId}/acquire`, s, {}, 'POST', [400, 409], /预审/);
    await api(`supplier/tenders/${tenderId}/prequalification`, s, { application: `资格声明 ${runId}` });
    tender = await buyerTender();
    const application = tender.prequalifications.find(q => q.supplierId === config.supplierId);
    assert.ok(application?.id);
    await api(`buyer/tenders/${tenderId}/prequalifications/${application.id}/review`, b, { status: '已通过', reviewComment: '隔离验收材料审查通过' });
    assert.ok((await api(`supplier/tenders/${tenderId}/acquire`, s, {})).documentHtml?.includes(runId));
    const bid = await api(`supplier/tenders/${tenderId}/bids`, s, { bidAmount: 1000, documentHtml: `<p>Supplier bid ${runId}</p>` });
    report.records.tender.bidId = bid.id;
    assert.equal(bid.sealedStatus, '已密封');
    const sealed = (await buyerTender()).bids.find(item => item.id === bid.id);
    assert.equal(sealed.bidAmount, null); assert.equal(sealed.documentHtml, null);
    assert.equal(sealed.evaluationEligible, null, 'Pre-opening eligibility must not be inferred or disclosed.');
    await api(`buyer/tenders/${tenderId}/open`, b, {}, 'POST', [400, 409], /开标时间|提前/);
    check('real tender invitation/prequalification/acquisition/sealed bid; buyer cannot see bid content early');

    const cutoff = Date.parse(deadline);
    let lastLog = 0;
    while ((await guard.verify()) <= cutoff + 250) {
      if (Date.now() - lastLog > 15000) {
        console.log(`WAIT real submission/opening deadline ${deadline}`); lastLog = Date.now();
      }
      await sleep(1000);
    }
    for (const project of [auction, single]) {
      const opened = own(await api(`buyer/rfqs/${project.id}/open`, b, { force: false }));
      assert.equal(opened.status, '已开标'); assert.ok(opened.openedAt);
    }
    await api(`supplier/tenders/${tenderId}/bids`, s, { bidAmount: 900, documentHtml: 'late submission' }, 'POST', [400, 409], /截止|发售/);
    tender = own(await api(`buyer/tenders/${tenderId}/open`, b, {}));
    assert.equal(tender.status, '已开标');
    const openedBid = tender.bids.find(item => item.id === bid.id);
    assert.equal(openedBid.digestVerified, true); assert.equal(openedBid.evaluationEligible, true);
    assert.equal(Number(openedBid.bidAmount), 1000);
    check('actual deadlines elapsed; both RFQs and tender opened; fingerprint and authoritative eligibility verified');

    async function verifyOrder(order, method, amount, expectedRfq) {
      own(order);
      assert.equal(order.sourceMethod, method); assert.equal(order.supplierId, config.supplierId);
      assert.equal(Number(order.amount), amount); assert.ok(order.rfqId);
      if (expectedRfq) assert.equal(order.rfqId, expectedRfq);
      assert.equal(order.status, '待供应商确认');
      assert.equal(order.lineItems?.length, 1);
      assert.equal(Number(order.lineItems[0].lineAmount), amount);
      const matching = await api(`buyer/orders?rfqId=${order.rfqId}`, b);
      assert.equal(matching.length, 1, 'Duplicate unified orders detected.'); assert.equal(matching[0].id, order.id);
      const supplierOrder = (await api(`supplier/orders?rfqId=${order.rfqId}`, s)).find(o => o.id === order.id);
      assert.ok(supplierOrder, 'Unified order must actually be visible to winning supplier.');
      assert.equal(Number(supplierOrder.amount), amount);
      await api(`supplier/orders/${order.id}/confirm`, s, {});
      assert.equal((await api(`buyer/orders?rfqId=${order.rfqId}`, b))[0].status, '待发货');
      await api(`buyer/orders?rfqId=${order.rfqId}`, foreign.accessToken).then(rows => {
        assert.ok(!rows.some(o => o.id === order.id), 'Foreign tenant leaked the acceptance order.');
      });
    }
    for (const [project, quote, method, amount, record] of [
      [auction, auctionQuote, '竞价', 850, report.records.auction],
      [single, singleQuote, '单一来源', 700, report.records.singleSource],
    ]) {
      await scenario(method, async () => {
        const award = own(await api(`buyer/rfqs/${project.id}/award`, b, { quoteId: quote.id, reason: `真实 HTTP 定标 ${runId}`, formData: {} }));
        assert.equal(award.approvedStatus, '待审批'); assert.equal(award.supplierId, config.supplierId);
        record.awardId = award.id;
        const orderRequest = { awardId: award.id, expectedReceiptDate };
        await api('buyer/orders', b, orderRequest, 'POST', [400, 409], /[Aa]pproved|审批|通过/);
        await approve('rfq_award', award.id);
        assert.equal((await rfq(project.id)).status, '已定标');
        const attempts = await Promise.allSettled([api('buyer/orders', b, orderRequest), api('buyer/orders', b, orderRequest)]);
        record.orderIds = attempts.filter(result => result.status === 'fulfilled').map(result => result.value.id);
        const failure = attempts.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        const orders = attempts.map(result => result.value);
        assert.equal(orders[0].id, orders[1].id, 'Concurrent conversion returned different order IDs.');
        record.orderId = orders[0].id;
        await verifyOrder(orders[0], method, amount, project.id);
        check(`${method}: genuine Flowable approval, pre-approval order rejection, concurrent unified order idempotency and supplier confirmation`);
      });
    }

    await scenario('enterprise tender', async () => {
      tender = own(await api(`buyer/tenders/${tenderId}/committee`, b, { members: [
        { name: `${runId}-A`, role: '组长' }, { name: `${runId}-B`, role: '成员' }, { name: `${runId}-C`, role: '成员' },
      ] }));
      await api(`buyer/tenders/${tenderId}/inquiries`, b, { bidId: bid.id, kind: '二次报价', question: '请给出最终修订报价' });
      const inquiry = (await supplierTender()).inquiries.find(i => i.bidId === bid.id && !i.answeredAt);
      assert.ok(inquiry?.id);
      await api(`supplier/tenders/${tenderId}/inquiries/${inquiry.id}/answer`, s, { answer: '修订为800', revisedAmount: 800 });
      const awardBody = { bidId: bid.id, awardNoticeHtml: `<p>${runId} 中标通知书：最终中标价800元。</p>` };
      await api(`buyer/tenders/${tenderId}/award`, b, awardBody, 'POST', [400, 409], /完整评分/);
      assert.equal(tender.evaluators.length, 3);
      for (let i = 0; i < tender.evaluators.length; i++) {
        const evaluator = tender.evaluators[i];
        const eligible = (await buyerTender()).bids.filter(item => item.evaluationEligible === true);
        assert.deepEqual(eligible.map(item => item.id), [bid.id]);
        const scored = own(await api(`buyer/tenders/${tenderId}/scores`, b, { evaluatorId: evaluator.id,
          lines: eligible.map(item => ({ bidId: item.id, technicalScore: 80, commercialScore: 90, comment: `评审记录 ${runId}` })) }));
        assert.equal(scored.evaluators.find(e => e.id === evaluator.id).scoredCount, 1);
        assert.equal(scored.evaluationSummary.some(row => row.recommended), i === 2);
      }
      tender = own(await api(`buyer/tenders/${tenderId}/award`, b, awardBody));
      assert.equal(tender.awardedBidId, bid.id);
      assert.equal(Number(tender.evaluationSummary.find(row => row.bidId === bid.id).effectiveAmount), 800);
      assert.equal((await supplierTender()).awardNoticeHtml, awardBody.awardNoticeHtml);
      const announcements = (await api('public/procurement-announcements')).filter(a => a.rfqId === tenderId && a.type === '定标公告');
      assert.equal(announcements.length, 1); assert.equal(Number(announcements[0].awardAmount), 800);
      assert.ok(!/已电子签章送达|已电子签章/.test(announcements[0].summary), 'Notice must not falsely claim a successful signature.');
      const executeBody = { expectedReceiptDate };
      const attempts = await Promise.allSettled([
        api(`buyer/tenders/${tenderId}/execute`, b, executeBody), api(`buyer/tenders/${tenderId}/execute`, b, executeBody),
      ]);
      report.records.tender.orderIds = attempts.filter(result => result.status === 'fulfilled').map(result => result.value.executionOrderId);
      const failure = attempts.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      const executed = attempts.map(result => result.value);
      const orderId = executed[0].executionOrderId;
      assert.ok(orderId); assert.equal(executed[1].executionOrderId, orderId);
      assert.equal((await api(`buyer/tenders/${tenderId}/execute`, b, executeBody)).executionOrderId, orderId);
      report.records.tender.orderId = orderId;
      const tenderOrder = (await api('buyer/orders', b)).find(order => order.id === orderId);
      assert.ok(tenderOrder);
      report.records.tender.anchorRfqId = tenderOrder.rfqId;
      await verifyOrder(tenderOrder, '招标', 800);
      check('enterprise tender: all evaluator scores, genuine award/notice, effective requote amount, concurrent/repeated execution and supplier-visible order');
    });
    const finalOrders = await api('buyer/orders', b);
    assert.equal(finalOrders.length, 3, 'Fresh tenant must contain exactly one order per tested method.');
    assert.equal(new Set(finalOrders.map(order => order.rfqId)).size, 3);
    report.passed = report.failures.length === 0;
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    report.error = redact(error.message ?? String(error));
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    checkpoint();
    console.log(JSON.stringify({ passed: report.passed, runId, reportPath: output,
      checks: report.checks.length, failures: report.failures, records: report.records,
      ...(report.error ? { error: report.error } : {}) }, null, 2));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const flags = process.argv.slice(2);
    assert.ok(flags.every(flag => ['--help', '--check-config'].includes(flag)), 'Unknown argument; use --help.');
    if (flags.includes('--help')) console.log(HELP);
    else {
      const config = readConfig();
      if (flags.includes('--check-config')) console.log(`Configuration valid: ${config.base}, ${config.database}. No service contacted.`);
      else await run(config);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
