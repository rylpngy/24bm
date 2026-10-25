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
    'purchase_demand',
    'budget_change',
    'buyer_supplier_admission',
    'rfq_award',
    'contract_approval',
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
            quantity: 6,
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
    const method = type === 'tender' ? 'tender' : 'rfq';
    lot = await api(
      'buyer/projects/' +
        p.project.id +
        '/packages/' +
        lot.info.id +
        '/execution',
      b,
      { revision: lot.info.revision, type: method, reason: '按分包独立下发' },
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
  async function fulfill(type, d, order, rfqId) {
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
      amount,
      evidenceNo: `凭据-${type}`,
    });
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
        deadlineAt: future(7),
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
    const quote = await api(`supplier/rfqs/${rfqId}/quotes`, s, {
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
    });
    await api(`buyer/rfqs/${rfqId}/open`, b, { force: true });
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
            quantity: 9,
            unitPrice: 400,
            purpose: '办公',
          },
        ],
      },
    },
  );
  assert.equal(
    (await api('buyer/projects/' + shared.project.id, b)).project.plannedAmount,
    2400,
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
    3600,
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
  assert.equal(report.records.rfq.planVersion, 1);
  assert.equal(report.records.tender.planVersion, 2);
  assert.equal(report.records.retry.planVersion, 2);
  const final = await api('buyer/projects/' + shared.project.id + '/budget', b);
  assert.equal(final.paidAmount, 2700);
  assert.equal(final.committed, 2700);
  assert.equal(final.releasedAmount, 900);
  const summary = await api(
    'buyer/projects/' + shared.project.id + '/execution',
    b,
  );
  assert.equal(summary.canClose, true, JSON.stringify(summary.warnings));
  assert.equal(summary.orderAmount, 2700);
  assert.equal(summary.paidAmount, 2700);
  assert.equal(
    summary.documents.filter((d) => d.module === 'demands').length,
    3,
  );
  const fresh = await api('buyer/projects/' + shared.project.id, b);
  assert.equal(
    (
      await api('buyer/projects/' + shared.project.id + '/close', b, {
        revision: fresh.project.revision,
        reason: '全部采购包完整结项',
      })
    ).project.status,
    'closed',
  );
  for (const key of ['rfq', 'tender', 'retry']) {
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
    'three independent packages aggregate once; 3600 demand budget, 2700 paid, 900 released; whole-project close reuses immutable archives',
  );
  const page = await api('buyer/projects?page=1&pageSize=1', b);
  assert.equal(page.total, 1);
  const changePage = await api(
    'buyer/projects/' + shared.project.id + '/changes?page=1&pageSize=1',
    b,
  );
  assert.equal(changePage.total, 1);
  assert.equal(changePage.pending, false);
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
