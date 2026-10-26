import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.JAVA_API_BASE_URL;
assert.ok(
  base &&
    ['127.0.0.1', 'localhost'].includes(new URL(base).hostname) &&
    new URL(base).port !== '8080' &&
    process.env.ACCEPTANCE_LOCAL_WRITES === '1',
  'Use an isolated database/API with explicit local write opt-in',
);
const required = (k) => {
  assert.ok(process.env[k], `Missing ${k}`);
  return process.env[k];
};
const closeoutChecks = process.env.PROJECT_CLOSEOUT_ACCEPTANCE === '1';
const marketplaceChecks = process.env.PROJECT_MARKETPLACE_ACCEPTANCE === '1';
const lifecycleChecks = process.env.PROJECT_LIFECYCLE_ACCEPTANCE === '1';
const paidCarryoverChecks =
  process.env.PROJECT_PAID_CARRYOVER_ACCEPTANCE === '1';
const cancellationChecks =
  process.env.PROJECT_ORDER_CANCELLATION_ACCEPTANCE === '1';
const packageKeys = marketplaceChecks
  ? ['rfq', 'tender', 'retry', 'auction', 'mall']
  : ['rfq', 'tender', 'retry'];
const password = required('ACCEPTANCE_PASSWORD'),
  supplierId = required('ACCEPTANCE_SUPPLIER_ID');
const runId = `packages-${Date.now()}`,
  report = {
    runId,
    tenantId: runId,
    account: `${runId}@example.com`,
    records: {},
    checks: [],
    passed: false,
  };
const future = (d) => new Date(Date.now() + d * 86400000).toISOString();
async function api(
  path,
  token,
  body,
  method = body === undefined ? 'GET' : 'POST',
  expected = [200, 201],
  errorPattern,
) {
  const r = await fetch(`${base}/api/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(45000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await r.json();
  assert.ok(
    expected.includes(r.status),
    `${method} ${path}: ${r.status} ${value.message}`,
  );
  if (errorPattern) assert.match(value.message, errorPattern);
  return value.data;
}
const login = (account, scope, context = {}) =>
  api('auth/login', null, { account, password, scope, ...context });
const check = (name) => {
  report.checks.push(name);
  console.log(`PASS ${name}`);
};
async function decide(token, type, id, action = 'approve') {
  const task = (await api('buyer/workflow/tasks', token)).find(
    (t) => t.businessType === type && t.businessId === id,
  );
  assert.ok(task, `Missing real task ${type}/${id}`);
  return api(`buyer/workflow/tasks/${task.taskId}/complete`, token, {
    action,
    comment: `项目验收 ${action}`,
  });
}
try {
  const platform = await login(
    required('ACCEPTANCE_PLATFORM_ACCOUNT'),
    'PLATFORM',
  );
  const supplier = await login(
    required('ACCEPTANCE_SUPPLIER_ACCOUNT'),
    'SUPPLIER',
    { supplierId },
  );
  const s = supplier.accessToken;
  await api('platform/tenants', platform.accessToken, {
    tenantId: runId,
    enterpriseId: `ent-${runId}`,
    name: `项目贯通 ${runId}`,
    industry: '通用采购',
    plan: 'MVP',
    userLimit: 20,
    enabledFeatures: [
      'rfq',
      'finance',
      'order',
      'method:compare',
      'method:tender',
      ...(marketplaceChecks ? ['mall', 'method:mall', 'method:auction'] : []),
    ],
    adminName: '项目负责人',
    adminEmail: report.account,
    adminPassword: password,
  });
  const buyer = await login(report.account, 'BUYER', { tenantId: runId });
  const b = buyer.accessToken;
  report.buyerId = buyer.userId;
  const dept = await api('buyer/departments', b, { name: '项目采购部' });
  report.departmentId = dept.id;
  const role = (await api('buyer/roles', b)).find((r) =>
    r.permissions.includes('buyer:*'),
  );
  assert.ok(role);
  report.reviewerAccount = `review-${runId}@example.com`;
  const reviewerUser = await api('buyer/users', b, {
    name: '独立立项审批人',
    email: report.reviewerAccount,
    status: 'active',
    departmentId: dept.id,
    roleId: role.id,
    initialPassword: password,
  });
  const reviewer = await login(report.reviewerAccount, 'BUYER', {
    tenantId: runId,
  });
  const r = reviewer.accessToken;
  const options = await api('buyer/projects/options', b);
  assert.ok(options.users.some((u) => u.id === reviewerUser.id));
  assert.ok(options.users.every((u) => !u.email && !u.permissions));
  const material = await api('buyer/materials', b, {
    code: `MAT-${runId}`,
    name: '项目贯通设备',
    category: '通用采购',
    unit: '套',
    referencePrice: 400,
    specification: '8核 / 16G',
  });
  report.materialId = material.id;
  for (const type of [
    'project_initiation',
    'project_change',
    'project_carryover',
    'project_liquidation',
    'purchase_demand',
    'budget_change',
    'buyer_supplier_admission',
    'rfq_award',
    'contract_approval',
    'order_settlement',
    'payment_request',
    'payment_batch',
  ]) {
    const d = await api('buyer/process-definitions', b, {
      name: `项目审批 ${type}`,
      businessType: type,
      icon: 'file-text',
    });
    await api(
      `buyer/process-definitions/${d.id}`,
      b,
      {
        name: d.name,
        businessType: type,
        status: 'draft',
        formSchema: '{"fields":[]}',
        flowSchema: JSON.stringify({
          steps: [
            {
              id: 'review',
              type: 'approver',
              title: '独立业务审核',
              assignment: { type: 'role', roleId: role.id },
            },
          ],
        }),
      },
      'PUT',
    );
    await api(`buyer/process-definitions/${d.id}/publish`, b, {});
  }
  const year = String(new Date().getFullYear());
  const budget = await api('buyer/budgets/requests', b, {
    departmentId: dept.id,
    period: year,
    kind: 'initial',
    targetAmount: 10000,
    title: '年度采购预算',
    reason: '隔离项目验收',
  });
  await api(`buyer/budgets/requests/${budget.id}/submit`, b, { formData: {} });
  await decide(r, 'budget_change', budget.id);
  assert.equal((await api('buyer/budgets/policy', b)).mode, 'warning');
  const relation = await api('buyer/suppliers', b, {
    supplierId,
    status: '待准入',
    level: '普通',
    categories: ['通用采购'],
  });
  const qualificationName = `证照-${runId}.pdf`;
  const qualificationTicket = await api(
    'supplier/qualifications/upload-ticket',
    s,
    { fileName: qualificationName },
  );
  const qualificationUpload = await fetch(
    `${base}${qualificationTicket.uploadUrl}&contentType=application%2Fpdf`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${s}`,
        'Content-Type': 'application/octet-stream',
      },
      body: Buffer.from('%PDF-1.4\nPROJECT ACCEPTANCE\n%%EOF'),
    },
  );
  assert.ok(qualificationUpload.ok);
  await api('supplier/qualifications', s, {
    qualificationType: '营业执照',
    certificateNo: runId,
    expiresAt: future(365),
    fileName: qualificationName,
    storageKey: qualificationTicket.storageKey,
  });
  await api(`buyer/suppliers/${relation.id}/submit`, b, { formData: {} });
  await decide(r, 'buyer_supplier_admission', relation.id);
  const attachmentBytes = Buffer.from(`立项原始材料 ${runId}`, 'utf8');
  let shared;
  async function project(type) {
    if (!shared) {
      shared = await api('buyer/projects', b, {
        title: '多执行项目 ' + runId,
        departmentId: dept.id,
        ownerId: reviewer.userId,
        period: year,
        fundingSource: '年度预算',
        purpose: '分批采购设备',
        revision: 0,
        lines: [
          {
            materialId: material.id,
            quantity: marketplaceChecks ? 12 : 6,
            unitPrice: 400,
            purpose: '办公',
          },
        ],
      });
      const body = {
        ownerType: 'procurement_project',
        ownerId: shared.project.id,
        fileName: '项目立项原件.txt',
        visibility: 'buyer_internal',
      };
      const ticket = await api('buyer/attachments/upload-ticket', b, body);
      const uploaded = await fetch(base + ticket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: attachmentBytes,
      });
      assert.ok(uploaded.ok);
      await api('buyer/attachments', b, {
        ...body,
        storageKey: ticket.storageKey,
      });
      await api('buyer/projects/' + shared.project.id + '/submit', b, {
        revision: shared.project.revision,
        reason: '独立审核项目立项',
        formData: {},
      });
      await decide(r, 'project_initiation', shared.project.id);
      assert.equal(
        (await api('buyer/projects/' + shared.project.id + '/budget', b))
          .committed,
        0,
      );
    }
    if (closeoutChecks && !report.records.cancelled) {
      const endpoint = 'buyer/projects/' + shared.project.id;
      const current = await api(endpoint, b);
      let cancel = await api(endpoint + '/packages', b, {
        projectRevision: current.project.revision,
        revision: 0,
        title: '受控重编及终止采购包',
        lines: [{ materialId: material.id, quantity: 1 }],
      });
      cancel = await api(
        endpoint + '/packages/' + cancel.info.id + '/create-demand',
        b,
        { revision: cancel.info.revision, reason: '真实生成取消前需求' },
      );
      const demand = cancel.demands[0].id;
      await api('buyer/demands/' + demand + '/submit', b, { formData: {} });
      await api(
        endpoint + '/packages/' + cancel.info.id + '/rework',
        r,
        { revision: cancel.info.revision, reason: '非发起人不允许绕过审批' },
        'POST',
        [403],
      );
      assert.equal((await api(endpoint + '/adjustments', b)).total, 0);
      await api(endpoint + '/packages/' + cancel.info.id + '/rework', b, {
        revision: cancel.info.revision,
        reason: '原发起人撤回并重编',
      });
      assert.equal((await api('buyer/demands/' + demand, b)).status, '草稿');
      assert.equal(
        (await api('buyer/workflow/tasks', r)).some(
          (t) => t.businessId === demand,
        ),
        false,
      );
      assert.equal((await api(endpoint + '/budget', b)).committed, 0);
      await api('buyer/demands/' + demand + '/submit', b, { formData: {} });
      await decide(r, 'purchase_demand', demand);
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      for (let n = 0; n < 12; n++) {
        cancel = (await api(endpoint + '/packages', b)).find(
          (l) => l.info.id === cancel.info.id,
        );
        await api(endpoint + '/packages/' + cancel.info.id + '/milestones', b, {
          revision: cancel.info.revision,
          milestone: 'order',
          dueDate: yesterday,
          reason: '实施计划调整 ' + n,
        });
      }
      assert.equal((await api(endpoint + '/monitor', b)).overdueCount, 1);
      assert.ok(
        (await api(endpoint + '/adjustments?page=2&pageSize=10', b)).items
          .length > 0,
      );
      cancel = (await api(endpoint + '/packages', b)).find(
        (l) => l.info.id === cancel.info.id,
      );
      await api(endpoint + '/packages/' + cancel.info.id + '/stop', b, {
        revision: cancel.info.revision,
        reason: '项目采购范围调整，终止尚未执行的包',
      });
      assert.equal((await api(endpoint + '/budget', b)).committed, 0);
      assert.equal((await api('buyer/demands/' + demand, b)).status, '已取消');
      assert.equal((await api(endpoint + '/monitor', b)).overdueCount, 0);
      await api(
        'buyer/demands/' + demand + '/submit',
        b,
        { formData: {} },
        'POST',
        [400, 409],
      );
      report.records.cancelled = {
        packageId: cancel.info.id,
        demandId: demand,
      };
      check(
        'real pending withdrawal enforces initiator and rollback; fresh approval, dated milestones, server history pagination, cancellation releases exposure and retains original records',
      );
    }
    const p = await api('buyer/projects/' + shared.project.id, b);
    let lot = await api('buyer/projects/' + p.project.id + '/packages', b, {
      projectRevision: p.project.revision,
      revision: 0,
      title: type + '采购包',
      lines: [{ materialId: material.id, quantity: 3 }],
      demandIds: [],
    });
    assert.equal(lot.info.amount, 1200);
    await api(
      'buyer/projects/' + p.project.id + '/packages',
      b,
      {
        projectRevision: p.project.revision,
        revision: 0,
        title: '过期版本不能覆盖',
        lines: [{ materialId: material.id, quantity: 99 }],
      },
      'POST',
      [400, 409],
    );
    lot = await api(
      'buyer/projects/' +
        p.project.id +
        '/packages/' +
        lot.info.id +
        '/create-demand',
      b,
      { revision: lot.info.revision, reason: '按包生成需求' },
    );
    const demand = lot.demands[0];
    assert.equal(demand.budget, 1200);
    await api(
      'buyer/projects/' +
        p.project.id +
        '/packages/' +
        lot.info.id +
        '/execution',
      b,
      { revision: lot.info.revision, type: 'rfq', reason: '审批前禁止下发' },
      'POST',
      [400, 409],
    );
    await api('buyer/demands/' + demand.id + '/submit', b, { formData: {} });
    await decide(r, 'purchase_demand', demand.id);
    if (type === 'mall') {
      report.records[type] = {
        projectId: p.project.id,
        packageId: lot.info.id,
        demandId: demand.id,
        planVersion: lot.info.projectRevision,
      };
      return { ...p, lot };
    }
    const method =
      type === 'tender' ? 'tender' : type === 'auction' ? 'auction' : 'rfq';
    lot = await api(
      'buyer/projects/' +
        p.project.id +
        '/packages/' +
        lot.info.id +
        '/execution',
      b,
      {
        revision: lot.info.revision,
        type: method,
        reason: '按分包独立下发',
        ...(type === 'auction'
          ? { softCloseTriggerMinutes: 0, softCloseExtendMinutes: 0 }
          : {}),
      },
    );
    const original = lot.runs.find((x) => x.status === 'active');
    await api(
      'buyer/projects/' +
        p.project.id +
        '/packages/' +
        lot.info.id +
        '/execution',
      b,
      { revision: lot.info.revision, type: method, reason: '禁止重复' },
      'POST',
      [400, 409],
    );
    if (type === 'retry') {
      await api('buyer/rfqs/' + original.executionId + '/abort', b, {
        kind: '废标',
        reason: '保留失败历史，重新寻源',
      });
      lot = await api(
        'buyer/projects/' +
          p.project.id +
          '/packages/' +
          lot.info.id +
          '/retry',
        b,
        {
          revision: lot.info.revision,
          type: 'rfq',
          reason: '修正采购条件后重采',
        },
      );
      assert.equal(lot.runs.length, 2);
      assert.equal(
        lot.runs.find((x) => x.executionId === original.executionId).status,
        'abandoned',
      );
    }
    const active = lot.runs.find((x) => x.status === 'active');
    report.records[type] = {
      projectId: p.project.id,
      packageId: lot.info.id,
      executionId: active.executionId,
      demandId: demand.id,
      planVersion: lot.info.projectRevision,
    };
    check(
      type +
        ': scoped package, independently approved demand, one active execution and retained retry history',
    );
    return { ...p, lot };
  }
  async function fulfill(type, d, order, rfqId, carryover = false) {
    if (closeoutChecks) {
      const endpoint = 'buyer/projects/' + d.project.id;
      const lot = (await api(endpoint + '/packages', b)).find(
        (l) => l.info.id === d.lot.info.id,
      );
      await api(
        endpoint + '/packages/' + lot.info.id + '/stop',
        b,
        { revision: lot.info.revision, reason: '有订单禁止直接终止' },
        'POST',
        [400, 409],
      );
      const parent = await api(endpoint, b);
      await api(
        endpoint + '/terminate',
        b,
        { revision: parent.project.revision, reason: '有订单禁止整项目终止' },
        'POST',
        [400, 409],
      );
      assert.equal((await api(endpoint, b)).project.status, 'approved');
      const row = (await api(endpoint + '/monitor', b)).packages.find(
        (l) => l.packageId === lot.info.id,
      );
      assert.equal(row.canStop, false);
      assert.equal(row.canRework, false);
    }
    const amount = Number(order.amount),
      record = report.records[type];
    Object.assign(record, { orderId: order.id, rfqId });
    const contract = await api('buyer/contracts', b, {
      contractNo: `CON-${type}-${runId}`,
      contractName: `项目履约合同 ${type}`,
      relatedOrderId: order.id,
      amount,
      status: '草案',
      fulfillmentProgress: '待履约',
      paymentTerms: '验收后支付',
    });
    await api(`buyer/contracts/${contract.id}/approval`, b, { formData: {} });
    await decide(r, 'contract_approval', contract.id);
    await api(`supplier/orders/${order.id}/confirm`, s, {});
    const quantity = order.lineItems.reduce(
      (v, l) => v + Number(l.quantity),
      0,
    );
    await api(`supplier/orders/${order.id}/deliveries`, s, {
      carrier: '验收物流',
      trackingNo: `${type}-${runId}`,
      shippedQuantity: quantity,
      lineItems: order.lineItems.map((l) => ({
        orderLineId: l.id,
        shippedQuantity: l.quantity,
      })),
    });
    await api(`buyer/orders/${order.id}/receipts`, b, {
      result: '全部验收合格',
      receivedQuantity: quantity,
      qualifiedQuantity: quantity,
      lineItems: order.lineItems.map((l) => ({
        orderLineId: l.id,
        receivedQuantity: l.quantity,
        qualifiedQuantity: l.quantity,
      })),
    });
    const invoice = await api(`supplier/orders/${order.id}/invoices`, s, {
      amount,
      invoiceNo: `INV-${type}-${runId}`,
      taxRate: 0,
    });
    const batch = `PAY-${type}-${runId}`;
    const payment = await api('buyer/payment-requests', b, {
      invoiceId: invoice.id,
      requestStatus: '付款申请待提交',
      paymentBatchNo: batch,
      remark: '不发生真实资金划转',
    });
    await api(
      `buyer/payment-requests/${payment.id}/status`,
      b,
      { requestStatus: '付款申请审批中', formData: {} },
      'PUT',
    );
    await decide(r, 'payment_request', payment.id);
    await api(
      `buyer/payment-batches/${batch}/status`,
      b,
      { batchStatus: '审批中', formData: {} },
      'PUT',
    );
    await decide(r, 'payment_batch', batch);
    await api(`buyer/invoices/${invoice.id}/payment-ledger`, b, {
      idempotencyKey: `${type}-${runId}`,
      amount: carryover ? 300 : amount,
      evidenceNo: `凭据-${type}`,
    });
    if (carryover) {
      const endpoint = 'buyer/projects/' + d.project.id;
      const existing = await api('buyer/budgets/positions', b);
      const baseAt = (n) =>
        existing.find(
          (x) =>
            x.departmentId === dept.id && x.period === String(Number(year) + n),
        ) || { committed: 0, paidAmount: 0, releasedAmount: 0 };
      record.budgetBeforeCarry = { next: baseAt(1), latest: baseAt(2) };
      const carry = async (target) => {
        const fresh = await api(endpoint, b);
        const c = await api(endpoint + '/lifecycle', b, {
          revision: fresh.project.revision,
          kind: 'carryover',
          targetPeriod: String(target),
          reason: '已支付留原年度，仅承接未支付责任',
          formData: {},
        });
        await decide(r, 'project_carryover', c.id);
        return c;
      };
      await carry(Number(year) + 1);
      let position = await api(endpoint + '/budget', b);
      assert.equal(position.committed - baseAt(1).committed, 900);
      assert.equal(position.paidAmount - baseAt(1).paidAmount, 0);
      const ledgerPath = `buyer/invoices/${invoice.id}/payment-ledger`;
      const originalEntry = (await api(ledgerPath, b)).entries.find(
        (e) => e.amount === 300,
      );
      await api(
        ledgerPath + '/' + originalEntry.id + '/reverse',
        b,
        {
          idempotencyKey: 'frozen-' + runId,
          reason: 'Cannot reverse frozen expense',
        },
        'POST',
        [400, 409],
        /跨年度承接/,
      );
      await api(ledgerPath, b, {
        idempotencyKey: 'new-period-' + runId,
        amount: 200,
        evidenceNo: 'NEW-YEAR-200',
      });
      let active = (await api(ledgerPath, b)).entries.find(
        (e) => e.amount === 200,
      );
      await api(ledgerPath + '/' + active.id + '/reverse', b, {
        idempotencyKey: 'current-reverse-' + runId,
        reason: '更正本年度未冻结登记',
      });
      assert.equal((await api(endpoint + '/budget', b)).paidAmount, 0);
      await api(ledgerPath, b, {
        idempotencyKey: 'new-period-corrected-' + runId,
        amount: 200,
        evidenceNo: 'NEW-YEAR-CORRECTED',
      });
      await carry(Number(year) + 2);
      position = await api(endpoint + '/budget', b);
      assert.equal(position.committed - baseAt(2).committed, 700);
      assert.equal(position.paidAmount - baseAt(2).paidAmount, 0);
      await api(ledgerPath, b, {
        idempotencyKey: 'final-period-' + runId,
        amount: 400,
        evidenceNo: 'FINAL-YEAR-400',
      });
      const preview = await api(endpoint + '/lifecycle/preview', b);
      assert.equal(preview.paidAmount, 900);
      assert.equal(preview.transferAmount, 300);
      const byYear = Object.fromEntries(
        preview.sources.map((s) => [s.period, s]),
      );
      assert.equal(byYear[year].paidAmount, 300);
      assert.equal(byYear[String(Number(year) + 1)].paidAmount, 200);
      assert.equal(byYear[String(Number(year) + 2)].paidAmount, 400);
      report.records.paidcarry = {
        ...record,
        invoiceId: invoice.id,
        annualPaid: [300, 200, 400],
      };
      check(
        'Paid carryover twice retains 300/200 historical expense, records 400 in current year, allows current unfrozen reversal and blocks frozen original reversal',
      );
    }
    await api(
      `buyer/contracts/${contract.id}/archive-status`,
      b,
      { archiveStatus: '已归档' },
      'PUT',
    );
    const trace = await api(
      `buyer/projects/${d.project.id}/packages/${d.lot.info.id}/execution`,
      b,
    );
    assert.equal(trace.canClose, true, JSON.stringify(trace.warnings));
    assert.equal(trace.orderAmount, amount);
    assert.equal(trace.paidAmount, amount);
    assert.equal(
      trace.documents.filter((x) => x.module === 'demands').length,
      1,
    );
    const before = await api(`buyer/rfqs/${rfqId}/execution`, b);
    const currentLot = (
      await api('buyer/projects/' + d.project.id + '/packages', b)
    ).find((l) => l.info.id === d.lot.info.id);
    const closed = await api(
      'buyer/projects/' +
        d.project.id +
        '/packages/' +
        d.lot.info.id +
        '/close',
      b,
      { revision: currentLot.info.revision, reason: '分包履约财务核验归档' },
    );
    assert.equal(closed.info.status, 'closed');
    const after = await api(`buyer/rfqs/${rfqId}/execution`, b);
    assert.equal(after.archives.length, before.archives.length + 1);
    assert.equal(after.archives[0].stale, false);
    const archive = after.archives[0];
    record.archiveId = archive.id;
    const response = await fetch(
      `${base}/api/v1/buyer/rfqs/${rfqId}/execution/archives/${archive.id}/download`,
      { headers: { Authorization: `Bearer ${b}` } },
    );
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    const output =
      process.env.ACCEPTANCE_DOWNLOAD_DIR || '/tmp/project-packages-acceptance';
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/${type}-project.zip`, bytes);
    writeFileSync(`${output}/expected-original.txt`, attachmentBytes);
    report.downloadDirectory = output;
    check(
      `${type}: real order, contract, shipment, receipt, invoice, approved payment, project close and original attachment ZIP`,
    );
  }
  async function purchaseRfq(type) {
    const rfqProject = await project(type),
      rfqId = rfqProject.lot.runs.find(
        (x) => x.status === 'active',
      ).executionId;
    await api(
      `buyer/rfqs/${rfqId}`,
      b,
      {
        title: rfqProject.project.title,
        deadlineAt:
          type === 'auction'
            ? new Date(Date.now() + 25000).toISOString()
            : future(7),
        invitedSupplierIds: [supplierId],
        quoteRequirement: '逐行报价',
        deliveryRequirement: '按期交货',
      },
      'PUT',
    );
    await api(`buyer/rfqs/${rfqId}/publish`, b, {});
    const demand = (await api('buyer/demands', b)).find(
      (x) => x.id === report.records[type].demandId,
    );
    const quoteBody = {
      amount: 900,
      taxRate: 13,
      deliveryDays: 3,
      lineItems: demand.lineItems.map((l) => ({
        demandItemId: l.id,
        description: material.name,
        unit: '套',
        quantity: l.quantity,
        unitPrice: 300,
      })),
    };
    let quote;
    if (type === 'auction') {
      assert.equal(
        (await api('buyer/rfqs', b)).find((r) => r.id === rfqId).method,
        '竞价',
      );
      await api(
        `supplier/rfqs/${rfqId}/quotes`,
        s,
        {
          ...quoteBody,
          amount: 1302,
          lineItems: quoteBody.lineItems.map((l) => ({ ...l, unitPrice: 434 })),
        },
        'POST',
        [400, 409],
        /起拍价/,
      );
      const initial = await api(`supplier/rfqs/${rfqId}/quotes`, s, {
        ...quoteBody,
        amount: 960,
        lineItems: quoteBody.lineItems.map((l) => ({ ...l, unitPrice: 320 })),
      });
      await api(
        `supplier/quotes/${initial.id}`,
        s,
        {
          ...quoteBody,
          amount: 990,
          lineItems: quoteBody.lineItems.map((l) => ({ ...l, unitPrice: 330 })),
        },
        'PUT',
        [400, 409],
        /最低价/,
      );
      quote = await api(`supplier/quotes/${initial.id}`, s, quoteBody, 'PUT');
      await api(
        `buyer/rfqs/${rfqId}/open`,
        b,
        { force: true },
        'POST',
        [400, 409],
        /deadline/,
      );
      const deadline = (await api('buyer/rfqs', b)).find(
        (r) => r.id === rfqId,
      ).deadlineAt;
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.max(0, Date.parse(deadline) - Date.now() + 1000),
        ),
      );
    } else quote = await api(`supplier/rfqs/${rfqId}/quotes`, s, quoteBody);
    await api(`buyer/rfqs/${rfqId}/open`, b, { force: type !== 'auction' });
    const award = await api(`buyer/rfqs/${rfqId}/award`, b, {
      quoteId: quote.id,
      reason: '合格报价',
      formData: {},
    });
    await decide(r, 'rfq_award', award.id);
    const order = await api('buyer/orders', b, {
      awardId: award.id,
      expectedReceiptDate: future(14).slice(0, 10),
    });
    await fulfill(type, rfqProject, order, rfqId);
    return rfqProject;
  }
  const first = await purchaseRfq('rfq');
  assert.equal(
    (await api('buyer/projects/' + shared.project.id + '/execution', b))
      .canClose,
    false,
  );
  const previous = await api('buyer/projects/' + shared.project.id, b);
  const change = await api(
    'buyer/projects/' + shared.project.id + '/changes',
    b,
    {
      projectRevision: previous.project.revision,
      revision: 0,
      reason: '新增第三采购包',
      proposal: {
        title: previous.project.title,
        departmentId: dept.id,
        ownerId: reviewer.userId,
        period: year,
        fundingSource: '追加年度预算',
        purpose: '增加设备数量',
        revision: previous.project.revision,
        lines: [
          {
            materialId: material.id,
            quantity: marketplaceChecks ? 15 : 9,
            unitPrice: 400,
            purpose: '办公',
          },
        ],
      },
    },
  );
  assert.equal(
    (await api('buyer/projects/' + shared.project.id, b)).project.plannedAmount,
    marketplaceChecks ? 4800 : 2400,
  );
  const changeBytes = Buffer.from('变更证明原件 ' + runId);
  const proof = {
    ownerType: 'procurement_project_change',
    ownerId: change.id,
    fileName: '变更证明.txt',
    visibility: 'buyer_internal',
  };
  const ticket = await api('buyer/attachments/upload-ticket', b, proof);
  assert.ok(
    (
      await fetch(base + ticket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: changeBytes,
      })
    ).ok,
  );
  await api('buyer/attachments', b, {
    ...proof,
    storageKey: ticket.storageKey,
  });
  const pending = await api(
    'buyer/projects/' + shared.project.id + '/changes/' + change.id + '/submit',
    b,
    { revision: change.revision, reason: '提交追加立项', formData: {} },
  );
  await api(
    'buyer/projects/' + shared.project.id + '/packages',
    b,
    {
      projectRevision: previous.project.revision,
      revision: 0,
      title: '在审禁止新增',
      lines: [{ materialId: material.id, quantity: 3 }],
    },
    'POST',
    [400, 409],
  );
  assert.equal(
    (await api('buyer/workflow/tasks', b)).some(
      (t) => t.businessId === change.id,
    ),
    false,
  );
  await decide(r, 'project_change', change.id);
  assert.equal(
    (await api('buyer/projects/' + shared.project.id, b)).project.plannedAmount,
    marketplaceChecks ? 6000 : 3600,
  );
  const oldView = await api(
    'buyer/rfqs/' + report.records.rfq.rfqId + '/execution',
    b,
  );
  assert.equal(oldView.archives[0].stale, false);
  report.records.changeId = change.id;
  report.records.sharedProjectId = shared.project.id;
  check(
    'approved plan changes only after independent review; pending changes freeze new work and prior ZIP remains current',
  );
  const tenderProject = await project('tender'),
    tenderId = tenderProject.lot.runs.find(
      (x) => x.status === 'active',
    ).executionId;
  const acquire = new Date(Date.now() + 25000).toISOString(),
    submit = new Date(Date.now() + 40000).toISOString(),
    opening = new Date(Date.now() + 45000).toISOString();
  await api(
    `buyer/tenders/${tenderId}`,
    b,
    {
      title: tenderProject.project.title,
      tenderType: '邀请招标',
      budget: 1200,
      documentHtml: '<p>真实招标验收文件</p>',
      evaluationMethod: '综合评分法',
      bidBondAmount: 0,
      acquisitionDeadline: acquire,
      submissionDeadline: submit,
      openingAt: opening,
    },
    'PUT',
  );
  await api(`buyer/tenders/${tenderId}/publish`, b, {});
  await api(`buyer/tenders/${tenderId}/distribute`, b, {
    supplierIds: [supplierId],
  });
  await api(`supplier/tenders/${tenderId}/acquire`, s, {});
  const bid = await api(`supplier/tenders/${tenderId}/bids`, s, {
    bidAmount: 900,
    documentHtml: '<p>真实应标文件</p>',
  });
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, Date.parse(opening) - Date.now() + 1000)),
  );
  await api(`buyer/tenders/${tenderId}/open`, b, {});
  const tender = await api(`buyer/tenders/${tenderId}/committee`, b, {
    members: [
      { name: '评审甲', role: '组长' },
      { name: '评审乙', role: '成员' },
      { name: '评审丙', role: '成员' },
    ],
  });
  for (const evaluator of tender.evaluators)
    await api(`buyer/tenders/${tenderId}/scores`, b, {
      evaluatorId: evaluator.id,
      lines: [
        {
          bidId: bid.id,
          technicalScore: 80,
          commercialScore: 90,
          comment: '完整评审',
        },
      ],
    });
  await api(`buyer/tenders/${tenderId}/award`, b, {
    bidId: bid.id,
    awardNoticeHtml: '<p>中标金额900元</p>',
  });
  const executed = await api(`buyer/tenders/${tenderId}/execute`, b, {
    expectedReceiptDate: future(14).slice(0, 10),
  });
  const tenderOrder = (await api('buyer/orders', b)).find(
    (o) => o.id === executed.executionOrderId,
  );
  assert.ok(tenderOrder);
  const position = await api(
    `buyer/projects/${tenderProject.project.id}/budget`,
    b,
  );
  assert.equal(
    position.committed,
    2100,
    'Closed RFQ 900 + tender demand 1200, not demand plus standalone order',
  );
  await fulfill('tender', tenderProject, tenderOrder, tenderOrder.rfqId);
  await purchaseRfq('retry');
  if (marketplaceChecks) {
    await purchaseRfq('auction');
    const mallProject = await project('mall'),
      endpoint =
        'buyer/projects/' +
        shared.project.id +
        '/packages/' +
        mallProject.lot.info.id;
    const listing = await api('buyer/mall/listings', b, {
      supplierId,
      materialId: material.id,
      price: 300,
      unit: '套',
    });
    report.skuId = listing.id;
    const request = {
      revision: mallProject.lot.info.revision,
      requestKey: 'project-checkout-' + runId,
      reason: '按批准目录选型下单',
      items: [{ skuId: listing.id, quantity: 3 }],
    };
    await api(
      endpoint + '/mall-checkout',
      b,
      { ...request, items: [{ skuId: listing.id, quantity: 4 }] },
      'POST',
      [400, 409],
    );
    const before = await api(
      'buyer/projects/' + shared.project.id + '/budget',
      b,
    );
    const selected = await api(endpoint + '/mall-checkout', b, request);
    assert.equal(
      (await api(endpoint + '/mall-checkout', b, request)).orderId,
      selected.orderId,
    );
    await api(
      endpoint + '/mall-checkout',
      b,
      { ...request, requestKey: 'duplicate-' + runId },
      'POST',
      [400, 409],
    );
    assert.equal(
      (await api('buyer/projects/' + shared.project.id + '/budget', b))
        .committed,
      before.committed,
    );
    assert.equal(
      (await api(endpoint + '/mall-selection', b)).orderId,
      selected.orderId,
    );
    const order = (await api('buyer/orders', b)).find(
      (o) => o.id === selected.orderId,
    );
    assert.ok(order);
    assert.equal(order.amount, 900);
    report.records.mall.executionId = selected.rfqId;
    await fulfill('mall', mallProject, order, selected.rfqId);
    check(
      'auction uses real competitive bids and rejects over-start/increasing bids; mall bound checkout is idempotent and preserves approved quantity, source budget and SKU snapshot',
    );
  }
  assert.equal(report.records.rfq.planVersion, 1);
  assert.equal(report.records.tender.planVersion, 2);
  assert.equal(report.records.retry.planVersion, 2);
  const final = await api('buyer/projects/' + shared.project.id + '/budget', b);
  assert.equal(final.paidAmount, packageKeys.length * 900);
  assert.equal(final.committed, packageKeys.length * 900);
  assert.equal(final.releasedAmount, packageKeys.length * 300);
  const summary = await api(
    'buyer/projects/' + shared.project.id + '/execution',
    b,
  );
  assert.equal(summary.canClose, true, JSON.stringify(summary.warnings));
  assert.equal(summary.orderAmount, packageKeys.length * 900);
  assert.equal(summary.paidAmount, packageKeys.length * 900);
  assert.equal(
    summary.documents.filter(
      (d) => d.module === 'demands' && d.status !== '已取消',
    ).length,
    packageKeys.length,
  );
  const fresh = await api('buyer/projects/' + shared.project.id, b);
  if (lifecycleChecks) {
    const path = 'buyer/projects/' + shared.project.id + '/lifecycle';
    const preview = await api(path + '/preview', b);
    assert.deepEqual(preview.liquidationBlockers, []);
    assert.deepEqual(preview.carryoverBlockers, []);
    assert.equal(preview.paidAmount, packageKeys.length * 900);
    assert.equal(preview.transferAmount, 0);
    const request = await api(path, b, {
      revision: fresh.project.revision,
      kind: 'liquidation',
      reason: '原订单全部履约结清，终止尚未实施计划范围',
      formData: {},
    });
    assert.equal(
      (await api('buyer/projects/' + shared.project.id, b)).project.status,
      'approved',
    );
    await decide(r, 'project_liquidation', request.id);
    assert.equal(
      (await api('buyer/projects/' + shared.project.id, b)).project.status,
      'terminated',
    );
    assert.equal((await api(path, b)).items[0].status, 'approved');
    const invoices = await api('buyer/invoices', b);
    const invoice = invoices.find(
      (i) => i.orderId === report.records.rfq.orderId,
    );
    assert.ok(invoice);
    const ledger = await api(
      'buyer/invoices/' + invoice.id + '/payment-ledger',
      b,
    );
    const paidEntry = ledger.entries.find((e) => e.amount > 0);
    assert.ok(paidEntry);
    await api(
      'buyer/invoices/' +
        invoice.id +
        '/payment-ledger/' +
        paidEntry.id +
        '/reverse',
      b,
      {
        idempotencyKey: 'after-liquidation-' + runId,
        reason: 'Cannot rewrite liquidation',
      },
      'POST',
      [400, 409],
      /终止清算/,
    );
    check(
      'Existing orders independently liquidated after actual receipts, invoices, payment approvals, net payment and package archives; source orders retained',
    );
  } else {
    assert.equal(
      (
        await api('buyer/projects/' + shared.project.id + '/close', b, {
          revision: fresh.project.revision,
          reason: '全部采购包完整结项',
        })
      ).project.status,
      'closed',
    );
  }
  for (const key of packageKeys) {
    const run = report.records[key],
      view = await api('buyer/rfqs/' + run.rfqId + '/execution', b);
    assert.equal(
      view.archives.length,
      1,
      'Root close must reuse package archives',
    );
    assert.equal(view.archives[0].stale, false);
  }
  const output = report.downloadDirectory;
  writeFileSync(output + '/change-original.txt', changeBytes);
  check(
    `${packageKeys.length} independent packages aggregate once; ${packageKeys.length * 1200} demand budget, ${packageKeys.length * 900} paid, ${packageKeys.length * 300} released; whole-project close reuses immutable archives`,
  );
  if (closeoutChecks) {
    const endpoint = 'buyer/projects/' + shared.project.id;
    const response = await fetch(
      base + '/api/v1/' + endpoint + '/archive/download',
      { headers: { Authorization: 'Bearer ' + b } },
    );
    assert.equal(response.status, 200);
    writeFileSync(
      report.downloadDirectory + '/overall-project.zip',
      Buffer.from(await response.arrayBuffer()),
    );
    const pendingRoot = await api('buyer/projects', b, {
      title: '未采购项目受控终止',
      departmentId: dept.id,
      ownerId: reviewer.userId,
      period: year,
      fundingSource: '年度预算',
      purpose: '真实终止核验',
      revision: 0,
      lines: [
        {
          materialId: material.id,
          quantity: 1,
          unitPrice: 400,
          purpose: '办公',
        },
      ],
    });
    await api('buyer/projects/' + pendingRoot.project.id + '/submit', b, {
      revision: pendingRoot.project.revision,
      reason: '独立立项',
      formData: {},
    });
    await decide(r, 'project_initiation', pendingRoot.project.id);
    let current = await api('buyer/projects/' + pendingRoot.project.id, b);
    let cancel = await api(
      'buyer/projects/' + current.project.id + '/packages',
      b,
      {
        projectRevision: current.project.revision,
        revision: 0,
        title: '终止前待审采购包',
        lines: [{ materialId: material.id, quantity: 1 }],
      },
    );
    cancel = await api(
      'buyer/projects/' +
        current.project.id +
        '/packages/' +
        cancel.info.id +
        '/create-demand',
      b,
      { revision: cancel.info.revision, reason: '生成终止前需求' },
    );
    await api('buyer/demands/' + cancel.demands[0].id + '/submit', b, {
      formData: {},
    });
    current = await api('buyer/projects/' + current.project.id, b);
    const stopped = await api(
      'buyer/projects/' + current.project.id + '/terminate',
      b,
      {
        revision: current.project.revision,
        reason: '撤回在审需求并终止未采购项目',
      },
    );
    assert.equal(stopped.project.status, 'terminated');
    assert.equal(
      (await api('buyer/demands/' + cancel.demands[0].id, b)).status,
      '已取消',
    );
    assert.equal(
      (await api('buyer/workflow/tasks', r)).some(
        (t) => t.businessId === cancel.demands[0].id,
      ),
      false,
    );
    const archive = await fetch(
      base +
        '/api/v1/buyer/projects/' +
        current.project.id +
        '/archive/download',
      { headers: { Authorization: 'Bearer ' + b } },
    );
    assert.equal(archive.status, 200);
    writeFileSync(
      report.downloadDirectory + '/terminated-project.zip',
      Buffer.from(await archive.arrayBuffer()),
    );
    report.records.terminatedProjectId = current.project.id;
    check(
      'orders block package/project termination; closed project exports original package ZIPs, pending-demand project terminates through real workflow withdrawal and exports audit archive',
    );
  }
  const page = await api('buyer/projects?page=1&pageSize=1', b);
  assert.equal(page.total, closeoutChecks ? 2 : 1);
  if (lifecycleChecks) {
    let carry = await api('buyer/projects', b, {
      title: '跨年度承接真实核验',
      departmentId: dept.id,
      ownerId: reviewer.userId,
      period: year,
      fundingSource: '年度预算',
      purpose: '未支付采购责任的跨年度承接',
      revision: 0,
      lines: [
        {
          materialId: material.id,
          quantity: 1,
          unitPrice: 400,
          purpose: '办公',
        },
      ],
    });
    const id = carry.project.id,
      endpoint = 'buyer/projects/' + id;
    await api(endpoint + '/submit', b, {
      revision: carry.project.revision,
      reason: '独立立项',
      formData: {},
    });
    await decide(r, 'project_initiation', id);
    carry = await api(endpoint, b);
    await api(endpoint + '/create-demand', b, {
      revision: carry.project.revision,
      reason: '生成原始需求',
    });
    const ds = await api(endpoint + '/demands', b),
      demand = ds[0];
    await api('buyer/demands/' + demand.id + '/submit', b, { formData: {} });
    await decide(r, 'purchase_demand', demand.id);
    const original = await api('buyer/demands/' + demand.id, b);
    carry = await api(endpoint, b);
    const payload = {
      revision: carry.project.revision,
      kind: 'carryover',
      targetPeriod: String(Number(year) + 1),
      reason: '将未支付采购责任承接至下一年度',
      formData: {},
    };
    const before = await api(endpoint + '/budget', b);
    let request = await api(endpoint + '/lifecycle', b, payload);
    assert.equal((await api(endpoint + '/budget', b)).period, year);
    await api(
      endpoint + '/lifecycle',
      b,
      payload,
      'POST',
      [409, 400],
      /重复提交/,
    );
    await api(endpoint + '/lifecycle/' + request.id + '/withdraw', b, {
      revision: request.revision,
      reason: '核对后重提',
    });
    request = await api(endpoint + '/lifecycle', b, payload);
    await decide(r, 'project_carryover', request.id, 'reject');
    assert.equal(
      (await api(endpoint + '/budget', b)).committed,
      before.committed,
    );
    request = await api(endpoint + '/lifecycle', b, payload);
    await decide(r, 'project_carryover', request.id);
    const after = await api(endpoint + '/budget', b);
    assert.equal(after.period, String(Number(year) + 1));
    assert.equal(after.committed, 400);
    assert.equal((await api(endpoint, b)).project.period, year);
    const unchanged = await api('buyer/demands/' + demand.id, b);
    assert.equal(unchanged.createdAt, original.createdAt);
    assert.equal(unchanged.budget, original.budget);
    const history = await api(endpoint + '/lifecycle?page=1&pageSize=1', b);
    assert.equal(history.total, 3);
    assert.equal(history.items.length, 1);
    report.records.carryoverProjectId = id;
    check(
      'Unpaid carryover uses real Flowable approval/rejection/withdrawal, duplicate protection, target-year occupancy and paginated history without rewriting source project/demand',
    );
  }
  const changePage = await api(
    'buyer/projects/' + shared.project.id + '/changes?page=1&pageSize=1',
    b,
  );
  assert.equal(changePage.total, 1);
  assert.equal(changePage.pending, false);
  if (paidCarryoverChecks) {
    let paid = await api('buyer/projects', b, {
      title: '已付款跨年度真实核验',
      departmentId: dept.id,
      ownerId: reviewer.userId,
      period: year,
      fundingSource: '年度预算',
      purpose: '按支付事实分年度核算',
      revision: 0,
      lines: [
        {
          materialId: material.id,
          quantity: 3,
          unitPrice: 400,
          purpose: '办公',
        },
      ],
    });
    const endpoint = 'buyer/projects/' + paid.project.id;
    await api(endpoint + '/submit', b, {
      revision: paid.project.revision,
      reason: '立项',
      formData: {},
    });
    await decide(r, 'project_initiation', paid.project.id);
    paid = await api(endpoint, b);
    let lot = await api(endpoint + '/packages', b, {
      projectRevision: paid.project.revision,
      revision: 0,
      title: '分年度付款包',
      lines: [{ materialId: material.id, quantity: 3 }],
    });
    lot = await api(
      endpoint + '/packages/' + lot.info.id + '/create-demand',
      b,
      { revision: lot.info.revision, reason: '生成需求' },
    );
    await api('buyer/demands/' + lot.demands[0].id + '/submit', b, {
      formData: {},
    });
    await decide(r, 'purchase_demand', lot.demands[0].id);
    const checkout = await api(
      endpoint + '/packages/' + lot.info.id + '/mall-checkout',
      b,
      {
        revision: lot.info.revision,
        requestKey: 'paid-' + runId,
        reason: '按批准物料选型',
        items: [{ skuId: report.skuId, quantity: 3 }],
      },
    );
    const order = (await api('buyer/orders', b)).find(
      (o) => o.id === checkout.orderId,
    );
    report.records.paidcarry = {
      projectId: paid.project.id,
      packageId: lot.info.id,
    };
    await fulfill('paidcarry', { ...paid, lot }, order, checkout.rfqId, true);
    const position = await api(endpoint + '/budget', b);
    assert.equal(
      position.committed -
        report.records.paidcarry.budgetBeforeCarry.latest.committed,
      400,
    );
    assert.equal(
      position.paidAmount -
        report.records.paidcarry.budgetBeforeCarry.latest.paidAmount,
      400,
    );
    assert.equal(
      position.releasedAmount -
        report.records.paidcarry.budgetBeforeCarry.latest.releasedAmount,
      300,
    );
    paid = await api(endpoint, b);
    await api(endpoint + '/close', b, {
      revision: paid.project.revision,
      reason: '分年度责任全部核验完成',
    });
    const root = await fetch(
      base + '/api/v1/' + endpoint + '/archive/download',
      { headers: { Authorization: 'Bearer ' + b } },
    );
    assert.equal(root.status, 200);
    writeFileSync(
      report.downloadDirectory + '/paidcarry-root.zip',
      Buffer.from(await root.arrayBuffer()),
    );
    check(
      'Cross-year settlement conserves 900 paid/300 released and archives original order, source payments, approved carryovers and annual allocation',
    );
  }
  if (cancellationChecks) {
    assert.ok(
      marketplaceChecks && report.skuId,
      'Cancellation acceptance requires real marketplace fixture',
    );
    async function makeCancellation(title) {
      let p = await api('buyer/projects', b, {
        title,
        departmentId: dept.id,
        ownerId: reviewer.userId,
        period: year,
        fundingSource: '年度预算',
        purpose: '核验未履行订单取消',
        revision: 0,
        lines: [
          {
            materialId: material.id,
            quantity: 3,
            unitPrice: 400,
            purpose: '办公',
          },
        ],
      });
      const endpoint = 'buyer/projects/' + p.project.id;
      await api(endpoint + '/submit', b, {
        revision: p.project.revision,
        reason: '独立立项',
        formData: {},
      });
      await decide(r, 'project_initiation', p.project.id);
      p = await api(endpoint, b);
      let lot = await api(endpoint + '/packages', b, {
        projectRevision: p.project.revision,
        revision: 0,
        title: '取消协商采购包',
        lines: [{ materialId: material.id, quantity: 3 }],
      });
      lot = await api(
        endpoint + '/packages/' + lot.info.id + '/create-demand',
        b,
        { revision: lot.info.revision, reason: '生成需求' },
      );
      await api('buyer/demands/' + lot.demands[0].id + '/submit', b, {
        formData: {},
      });
      await decide(r, 'purchase_demand', lot.demands[0].id);
      const checkout = await api(
        endpoint + '/packages/' + lot.info.id + '/mall-checkout',
        b,
        {
          revision: lot.info.revision,
          requestKey: 'cancel-' + lot.info.id,
          reason: '按批准目录采购',
          items: [{ skuId: report.skuId, quantity: 3 }],
        },
      );
      return {
        projectId: p.project.id,
        packageId: lot.info.id,
        orderId: checkout.orderId,
        rfqId: checkout.rfqId,
      };
    }
    const c = await makeCancellation('双方取消与原单归档验证'),
      path = 'buyer/orders/' + c.orderId + '/cancellations',
      sp = 'supplier/orders/' + c.orderId + '/cancellations';
    let entry = await api(path, b, {
      requestKey: 'first',
      reason: '计划调整，协商取消',
    });
    assert.equal(
      (
        await api(path, b, {
          requestKey: 'first',
          reason: '计划调整，协商取消',
        })
      ).id,
      entry.id,
    );
    await api(
      'supplier/orders/' + c.orderId + '/confirm',
      s,
      {},
      'POST',
      [409, 400],
    );
    await api(
      path + '/' + entry.id,
      b,
      { action: 'accept', reason: '不得由采购方替供应商确认' },
      'POST',
      [400, 409],
    );
    await api(sp + '/' + entry.id, s, {
      action: 'reject',
      reason: '先核实采购计划',
    });
    assert.equal(
      (await api('buyer/orders', b)).find((o) => o.id === c.orderId).status,
      '待供应商确认',
    );
    entry = await api(path, b, { requestKey: 'second', reason: '撤回核对' });
    await api(
      path + '/' + entry.id,
      r,
      { action: 'withdraw', reason: '非发起人不能撤回' },
      'POST',
      [409, 400],
    );
    await api(path + '/' + entry.id, b, {
      action: 'withdraw',
      reason: '补充资料后再提交',
    });
    entry = await api(path, b, {
      requestKey: 'third',
      reason: '双方确认不再采购',
    });
    const accepted = await api(sp + '/' + entry.id, s, {
      action: 'accept',
      reason: '确认未发货、无合同及财务责任，同意取消',
    });
    assert.equal(accepted.status, 'accepted');
    await api(sp + '/' + entry.id, s, { action: 'accept', reason: '幂等重试' });
    const history = await api(path + '?page=2&size=1', b);
    assert.equal(history.total, 3);
    assert.equal(history.items.length, 1);
    const order = (await api('buyer/orders', b)).find(
      (o) => o.id === c.orderId,
    );
    assert.equal(order.status, '已取消');
    assert.equal(order.amount, 900);
    assert.equal(order.lineItems[0].quantity, 3);
    const endpoint = 'buyer/projects/' + c.projectId;
    const before = await api(endpoint + '/budget', b);
    const lot = (await api(endpoint + '/packages', b)).find(
      (l) => l.info.id === c.packageId,
    );
    await api(endpoint + '/packages/' + c.packageId + '/close', b, {
      revision: lot.info.revision,
      reason: '核验双方取消台账后结清',
    });
    const after = await api(endpoint + '/budget', b);
    assert.equal(before.committed - after.committed, 1200);
    assert.equal(before.orderAmount - after.orderAmount, 0);
    const fresh = await api(endpoint, b);
    await api(endpoint + '/close', b, {
      revision: fresh.project.revision,
      reason: '原单和双方记录完整归档',
    });
    const zip = await fetch(
      base + '/api/v1/' + endpoint + '/archive/download',
      { headers: { Authorization: 'Bearer ' + b } },
    );
    assert.equal(zip.status, 200);
    writeFileSync(
      report.downloadDirectory + '/cancelled-root.zip',
      Buffer.from(await zip.arrayBuffer()),
    );
    report.records.cancellation = c;
    report.records.cancellationUi =
      await makeCancellation('浏览器两端取消办理验证');
    if (process.env.PROJECT_ORDER_SETTLEMENT_ACCEPTANCE === '1') {
      async function proof(order, name) {
        const body = {
          ownerType: 'order_settlement_document',
          ownerId: order,
          fileName: name + '.txt',
          visibility: 'buyer_internal',
        };
        const ticket = await api('buyer/attachments/upload-ticket', b, body);
        const bytes = Buffer.from('双方清算协议与凭证 ' + runId + ' ' + name);
        const result = await fetch(base + ticket.uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + b,
            'Content-Type': 'application/octet-stream',
          },
          body: bytes,
        });
        assert.ok(result.ok);
        return (
          await api('buyer/attachments', b, {
            ...body,
            storageKey: ticket.storageKey,
          })
        ).id;
      }
      async function settlementCase(kind) {
        const quality = kind.startsWith('quality-');
        let qualityReceipt;
        const c = await makeCancellation('合同清算 ' + kind);
        const order = (await api('buyer/orders', b)).find(
          (o) => o.id === c.orderId,
        );
        const contract = await api('buyer/contracts', b, {
          contractNo: 'SET-' + kind + '-' + runId,
          contractName: '清算合同 ' + kind,
          relatedOrderId: order.id,
          amount: order.amount,
          status: '草案',
          fulfillmentProgress: '待履约',
          paymentTerms: '验收后支付',
        });
        if (kind !== 'void') {
          await api(`buyer/contracts/${contract.id}/approval`, b, {
            formData: {},
          });
          await decide(r, 'contract_approval', contract.id);
          await api(`supplier/orders/${order.id}/confirm`, s, {});
          const qty = kind === 'partial' ? 1 : 3;
          await api(`supplier/orders/${order.id}/deliveries`, s, {
            carrier: '清算物流',
            trackingNo: 'SET-' + kind + '-' + runId,
            shippedQuantity: qty,
            lineItems: [
              { orderLineId: order.lineItems[0].id, shippedQuantity: qty },
            ],
          });
          qualityReceipt = await api(`buyer/orders/${order.id}/receipts`, b, {
            result: quality ? '到货部分不合格，按批次退换' : '全部验收合格',
            receivedQuantity: qty,
            qualifiedQuantity: quality ? qty - 1 : qty,
            ...(quality
              ? {
                  disposition: '退货换货',
                  qualityNote: '到货质量异常，保留原始质检记录',
                }
              : {}),
            lineItems: [
              {
                orderLineId: order.lineItems[0].id,
                receivedQuantity: qty,
                qualifiedQuantity: quality ? qty - 1 : qty,
              },
            ],
          });
        }
        let invoice;
        async function invoiceAndPay() {
          invoice = await api(`supplier/orders/${order.id}/invoices`, s, {
            amount: order.amount,
            invoiceNo: 'REF-' + kind + '-' + runId,
            taxRate: 0,
          });
          const batch = 'SET-BATCH-' + kind + '-' + runId;
          const pay = await api('buyer/payment-requests', b, {
            invoiceId: invoice.id,
            requestStatus: '付款申请待提交',
            paymentBatchNo: batch,
            remark: '隔离清算验收',
          });
          await api(
            `buyer/payment-requests/${pay.id}/status`,
            b,
            { requestStatus: '付款申请审批中', formData: {} },
            'PUT',
          );
          await decide(r, 'payment_request', pay.id);
          await api(
            `buyer/payment-batches/${batch}/status`,
            b,
            { batchStatus: '审批中', formData: {} },
            'PUT',
          );
          await decide(r, 'payment_batch', batch);
          await api(`buyer/invoices/${invoice.id}/payment-ledger`, b, {
            idempotencyKey: 'original-' + runId,
            amount: 900,
            evidenceNo: 'ORIGINAL-' + runId,
          });
        }
        if (['refund', 'physical-return', 'physical-exchange'].includes(kind))
          await invoiceAndPay();
        if (kind.startsWith('physical-') || quality) {
          const type = ['physical-return', 'quality-return'].includes(kind)
            ? '退货'
            : '换货';
          await api('buyer/mall/after-sales', b, {
            orderId: order.id,
            orderLineId: order.lineItems[0].id,
            type,
            quantity: 1,
            reason: '按实物交接核验退换货',
          });
          const a = (await api('buyer/mall/after-sales', b)).find(
            (x) => x.orderId === order.id,
          );
          if (kind === 'physical-ui') {
            report.records.physicalUi = { ...c, afterSalesId: a.id };
            return;
          }
          await api(
            'supplier/mall/after-sales/' + a.id,
            s,
            { status: '处理中', reply: '受理实物交接' },
            'PUT',
          );
          const payload = (key, k) => ({
            requestKey: key,
            kind: k,
            quantity: 1,
            referenceNo: 'PHYSICAL-' + key,
            note: '签收、复验实际凭证',
            fileName: key + '.txt',
            fileBase64: Buffer.from(
              'physical proof ' + runId + ' ' + key,
            ).toString('base64'),
          });
          await api(
            'supplier/mall/after-sales/' + a.id,
            s,
            {
              status: '已完成',
              reply: '缺少实物不能完成',
              evidenceNo: 'INVALID',
            },
            'PUT',
            [400, 409],
            /退货|复验/,
          );
          const first = payload('dispatch', 'return_dispatch');
          await api('buyer/mall/after-sales/' + a.id + '/physical', b, first);
          assert.equal(
            (
              await api(
                'buyer/mall/after-sales/' + a.id + '/physical',
                b,
                first,
              )
            ).events.length,
            1,
          );
          await api(
            'supplier/mall/after-sales/' + a.id + '/physical',
            s,
            payload('receipt', 'return_receipt'),
          );
          if (type === '换货') {
            await api(
              'supplier/mall/after-sales/' + a.id + '/physical',
              s,
              payload('replacement', 'replacement_dispatch'),
            );
            await api(
              'buyer/mall/after-sales/' + a.id + '/physical',
              b,
              payload('bad', 'inspection_fail'),
            );
            assert.deepEqual(
              (await api('supplier/mall/after-sales/' + a.id + '/physical', s))
                .actions,
              [],
            );
            await api(
              'buyer/mall/after-sales/' + a.id + '/physical',
              b,
              payload('dispatch2', 'return_dispatch'),
            );
            await api(
              'supplier/mall/after-sales/' + a.id + '/physical',
              s,
              payload('receipt2', 'return_receipt'),
            );
            await api(
              'supplier/mall/after-sales/' + a.id + '/physical',
              s,
              payload('replacement2', 'replacement_dispatch'),
            );
            await api(
              'buyer/mall/after-sales/' + a.id + '/physical',
              b,
              payload('pass', 'inspection_pass'),
            );
          }
          await api(
            'supplier/mall/after-sales/' + a.id,
            s,
            {
              status: '已完成',
              reply: '实物证据齐全',
              evidenceNo: 'PHYS-' + a.id,
            },
            'PUT',
          );
          await api('buyer/mall/after-sales/' + a.id + '/confirm', b, {
            note: '核对全部实物记录',
          });
          const physical = await api(
            'buyer/mall/after-sales/' + a.id + '/physical',
            b,
          );
          for (const e of physical.events) {
            const downloaded = await fetch(
              base +
                '/api/v1/supplier/mall/after-sales/' +
                a.id +
                '/physical/' +
                e.id +
                '/file',
              { headers: { Authorization: 'Bearer ' + s } },
            );
            assert.equal(downloaded.status, 200);
            assert.ok((await downloaded.text()).includes(runId));
          }
          report.records[kind] = {
            ...c,
            afterSalesId: a.id,
            events: physical.events,
          };
          if (quality) {
            const path = `buyer/receipts/${qualityReceipt.id}/quality-resolutions`,
              before = await api(path, b);
            assert.equal(before.lines[0].unresolvedQuantity, 1);
            assert.equal(
              (await api(`buyer/orders/${order.id}/settlements`, b)).preview
                .blockers.length > 0,
              true,
            );
            if (kind === 'quality-ui') {
              report.records.qualityUi = {
                ...c,
                afterSalesId: a.id,
                receiptId: qualityReceipt.id,
                receiptLineId: before.lines[0].receiptLineId,
              };
              return;
            }
            const request = {
              receiptLineId: before.lines[0].receiptLineId,
              afterSalesId: a.id,
              reason: '核对原始验收与退换货凭证，按批次核销',
            };
            const resolved = await api(path, b, request);
            assert.equal(resolved.lines[0].unresolvedQuantity, 0);
            assert.equal((await api(path, b, request)).resolutions.length, 1);
            await api(
              path,
              b,
              { ...request, reason: '禁止覆盖既有核销' },
              'POST',
              [400, 409],
              /不得覆盖/,
            );
            const original = (await api('buyer/receipts', b)).find(
              (x) => x.id === qualityReceipt.id,
            );
            assert.equal(original.qualifiedQuantity, 2);
            assert.equal(original.inspectionConclusion, '部分合格');
            report.records[kind].receiptId = qualityReceipt.id;
            report.records[kind].qualityResolution = resolved.resolutions[0];
            if (type === '换货') await invoiceAndPay();
          }
          if (type === '换货') {
            const ep = `buyer/projects/${c.projectId}`,
              lot = (await api(ep + '/packages', b)).find(
                (l) => l.info.id === c.packageId,
              );
            const trace = await api(`buyer/rfqs/${c.rfqId}/execution`, b);
            assert.equal(
              trace.canArchive,
              true,
              JSON.stringify(trace.blockers),
            );
            assert.equal(trace.orderAmount, 900);
            await api(ep + '/packages/' + c.packageId + '/close', b, {
              revision: lot.info.revision,
              reason: '换货复验完成，原财务记录不变',
            });
            const parent = await api(ep, b);
            await api(ep + '/close', b, {
              revision: parent.project.revision,
              reason: '换货完成并归档全部实物原件',
            });
            const zip = await fetch(
              base + '/api/v1/' + ep + '/archive/download',
              { headers: { Authorization: 'Bearer ' + b } },
            );
            assert.equal(zip.status, 200);
            writeFileSync(
              report.downloadDirectory + '/' + kind + '.zip',
              Buffer.from(await zip.arrayBuffer()),
            );
            check(
              'Physical exchange: failed inspection loops through return and replacement, verified original downloads, unchanged order amount, project close and ZIP',
            );
            return;
          }
        }
        const attachment = await proof(order.id, kind + '-agreement');
        const path = `buyer/orders/${order.id}/settlements`,
          sp = `supplier/orders/${order.id}/settlements`;
        let entry = await api(path, b, {
          requestKey: 'settlement-' + kind,
          reason: '双方核对已履行数量和最终价款',
          compensation: 0,
          agreementId: attachment,
          prices:
            kind === 'refund'
              ? [{ lineId: order.lineItems[0].id, unitPrice: 200 }]
              : [],
        });
        const agreement = await fetch(
          base + '/api/v1/' + sp + '/' + entry.id + '/agreement',
          { headers: { Authorization: 'Bearer ' + s } },
        );
        assert.equal(agreement.status, 200);
        assert.ok((await agreement.text()).includes(runId));
        if (kind === 'ui') {
          report.records.settlementUi = {
            ...c,
            settlementId: entry.id,
            contractId: contract.id,
            attachmentId: attachment,
          };
          return;
        }
        const act = (token, action, e, scope = path) =>
          api(scope + '/' + e.id + '/actions', token, {
            revision: e.revision,
            action,
            reason: '核对清算协议及真实原件',
            formData: {},
          });
        entry = await act(s, 'accept', entry, sp);
        entry = await act(b, 'submit', entry);
        assert.ok(
          !(await api('buyer/workflow/tasks', b)).some(
            (t) => t.businessId === entry.id,
          ),
          'initiator must not approve',
        );
        await decide(r, 'order_settlement', entry.id);
        entry = (await api(path + '/' + entry.id, b)).record;
        if (kind !== 'void') {
          const evidence = async (k, amount) =>
            api(path + '/' + entry.id + '/evidence', b, {
              requestKey: k + '-' + runId,
              kind: k,
              amount,
              evidenceNo: k + '-' + kind + '-' + runId,
              attachmentId: attachment,
              remark: '已核验清算原件',
            });
          await act(b, 'complete', entry, path).then(
            () => assert.fail('Must require financial evidence'),
            () => {},
          );
          if (kind === 'quality-return') await evidence('payment', 600);
          else if (kind === 'partial') await evidence('payment', 300);
          else await evidence('refund', 300);
          await evidence('invoice', kind === 'partial' ? 300 : 600);
        }
        entry = await act(b, 'complete', entry);
        assert.equal(entry.status, 'settled');
        const now = (await api('buyer/orders', b)).find(
          (o) => o.id === order.id,
        );
        assert.equal(now.amount, 900);
        assert.equal(now.lineItems[0].quantity, 3);
        assert.equal(now.status, '已清算');
        const detail = await api(path + '/' + entry.id, b);
        assert.equal(
          detail.netPaid,
          kind === 'void' ? 0 : kind === 'partial' ? 300 : 600,
        );
        assert.deepEqual(detail.blockers, []);
        if (invoice) {
          const original = (await api('buyer/invoices', b)).find(
            (i) => i.id === invoice.id,
          );
          assert.equal(original.amount, 900);
          assert.equal(original.paymentStatus, '已清算');
        }
        const ep = `buyer/projects/${c.projectId}`,
          lot = (await api(ep + '/packages', b)).find(
            (l) => l.info.id === c.packageId,
          );
        const trace = await api(`buyer/rfqs/${c.rfqId}/execution`, b);
        assert.equal(trace.canArchive, true, JSON.stringify(trace.blockers));
        assert.equal(trace.orderAmount, detail.netPaid);
        await api(ep + '/packages/' + c.packageId + '/close', b, {
          revision: lot.info.revision,
          reason: '合同清算凭证完整，归档并释放余额',
        });
        const parent = await api(ep, b);
        await api(ep + '/close', b, {
          revision: parent.project.revision,
          reason: '核对原始履约、Flowable、实际收付款和协议原件',
        });
        const zip = await fetch(base + '/api/v1/' + ep + '/archive/download', {
          headers: { Authorization: 'Bearer ' + b },
        });
        assert.equal(zip.status, 200);
        writeFileSync(
          report.downloadDirectory + '/settlement-' + kind + '.zip',
          Buffer.from(await zip.arrayBuffer()),
        );
        report.records['settlement_' + kind] = {
          ...c,
          settlementId: entry.id,
          contractId: contract.id,
          netPaid: detail.netPaid,
        };
        check(
          'Contract ' +
            kind +
            ': real supplier consent, independent Flowable, actual evidence, frozen originals, net closeout and downloadable ZIP',
        );
      }
      for (const kind of ['void', 'partial', 'refund', 'ui'])
        await settlementCase(kind);
      if (process.env.PROJECT_PHYSICAL_AFTER_SALES_ACCEPTANCE === '1')
        for (const kind of [
          'physical-return',
          'physical-exchange',
          'physical-ui',
        ])
          await settlementCase(kind);
      if (process.env.PROJECT_RECEIPT_QUALITY_ACCEPTANCE === '1')
        for (const kind of ['quality-return', 'quality-exchange', 'quality-ui'])
          await settlementCase(kind);
    }
    check(
      'Bilateral cancellation validates rejection, withdrawal ownership, pause, idempotent agreement, original amount/quantity, paginated history and 1200 responsibility release only after closeout',
    );
  }
  report.passed = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (process.env.ACCEPTANCE_REPORT_PATH)
    writeFileSync(
      process.env.ACCEPTANCE_REPORT_PATH,
      JSON.stringify(report, null, 2),
    );
  console.log(JSON.stringify(report, null, 2));
}
