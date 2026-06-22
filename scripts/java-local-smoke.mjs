import { execFileSync } from 'node:child_process';

const baseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';
const localSmokeDatabaseUrl = process.env.JAVA_SMOKE_DATABASE_URL
  ?? process.env.DB_URL
  ?? 'postgresql://procurement:procurement@localhost:5432/procurement_saas';

const requestJson = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok || payload?.success === false) {
    const message = payload?.message || payload?.error?.message || response.statusText;
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${message}`);
  }

  return payload?.data;
};

const expectRequestFailure = async (path, init, expectedMessage) => {
  try {
    await requestJson(path, init);
  } catch (error) {
    if (!String(error.message).includes(expectedMessage)) {
      throw new Error(`Unexpected Java smoke failure message: ${error.message}`);
    }
    return error.message;
  }
  throw new Error(`Java payment request was not blocked before variance handling: ${path}`);
};

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

const resolveLocalSmokeSqlCommand = () => {
  try {
    execFileSync('psql', ['--version'], { stdio: 'ignore' });
    return {
      command: 'psql',
      args: [localSmokeDatabaseUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-c'],
    };
  } catch {
    return {
      command: 'docker',
      args: [
        'exec',
        '-i',
        'procurement-saas-postgres',
        'psql',
        '-U',
        'procurement',
        '-d',
        'procurement_saas',
        '-v',
        'ON_ERROR_STOP=1',
        '-q',
        '-c',
      ],
    };
  }
};

const runLocalSmokeSql = (sql) => {
  const sqlCommand = resolveLocalSmokeSqlCommand();
  execFileSync(sqlCommand.command, [...sqlCommand.args, sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

const requireItem = (items, predicate, label) => {
  const found = items.some(predicate);
  if (!found) {
    throw new Error(`Missing expected Java local seed data: ${label}`);
  }
};

const findPendingAdmissionRelation = (relations) =>
  relations.find((item) => item.status === '待准入')
    ?? relations.find((item) => item.id === (process.env.JAVA_ADMISSION_SMOKE_RELATION_ID ?? 'rel-acme-tech'));

const futureDeadline = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString();
};

const futureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date.toISOString().slice(0, 10);
};

const main = async () => {
  const platformLogin = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_PLATFORM_ACCOUNT ?? 'platform.admin@example.com',
      password: process.env.JAVA_PLATFORM_PASSWORD ?? 'demo123456',
      scope: 'PLATFORM',
    }),
  });

  const buyerLogin = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
      password: process.env.JAVA_BUYER_PASSWORD ?? 'demo123456',
      scope: 'BUYER',
      tenantId: process.env.JAVA_BUYER_TENANT_ID ?? 'tenant-acme',
    }),
  });

  const supplierLogin = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com',
      password: process.env.JAVA_SUPPLIER_PASSWORD ?? 'demo123456',
      scope: 'SUPPLIER',
      supplierId: process.env.JAVA_SUPPLIER_ID ?? 'ent-supplier-sunrise',
    }),
  });

  const platformHeaders = { Authorization: `${platformLogin.tokenType} ${platformLogin.accessToken}` };
  const authHeaders = { Authorization: `${buyerLogin.tokenType} ${buyerLogin.accessToken}` };
  const supplierHeaders = { Authorization: `${supplierLogin.tokenType} ${supplierLogin.accessToken}` };
  const [platformWorkspace, platformOverview, platformTenants, platformEnterpriseReviews] = await Promise.all([
    requestJson('/api/v1/platform/workspace', { headers: platformHeaders }),
    requestJson('/api/v1/platform/overview', { headers: platformHeaders }),
    requestJson('/api/v1/platform/tenants', { headers: platformHeaders }),
    requestJson('/api/v1/platform/enterprise-reviews', { headers: platformHeaders }),
  ]);
  const [buyerWorkspace, suppliers, materials, departments, users, demands, orders, invoices, auditLogs] = await Promise.all([
    requestJson('/api/v1/buyer/workspace', { headers: authHeaders }),
    requestJson('/api/v1/buyer/suppliers', { headers: authHeaders }),
    requestJson('/api/v1/buyer/materials', { headers: authHeaders }),
    requestJson('/api/v1/buyer/departments', { headers: authHeaders }),
    requestJson('/api/v1/buyer/users', { headers: authHeaders }),
    requestJson('/api/v1/buyer/demands', { headers: authHeaders }),
    requestJson('/api/v1/buyer/orders', { headers: authHeaders }),
    requestJson('/api/v1/buyer/invoices', { headers: authHeaders }),
    requestJson('/api/v1/buyer/audit-logs', { headers: authHeaders }),
  ]);
  const [supplierWorkspace, supplierProfile, supplierRfqs, supplierQuotes, supplierOrders, supplierInvoices] = await Promise.all([
    requestJson('/api/v1/supplier/workspace', { headers: supplierHeaders }),
    requestJson('/api/v1/supplier/profile', { headers: supplierHeaders }),
    requestJson('/api/v1/supplier/rfqs', { headers: supplierHeaders }),
    requestJson('/api/v1/supplier/quotes', { headers: supplierHeaders }),
    requestJson('/api/v1/supplier/orders', { headers: supplierHeaders }),
    requestJson('/api/v1/supplier/invoices', { headers: supplierHeaders }),
  ]);

  requireItem(suppliers, (item) => item.supplierId === 'supplier-tech', 'supplier-tech');
  requireItem(materials, (item) => item.id === 'mat-laptop', 'mat-laptop');
  requireItem(departments, (item) => item.id === 'dept-it', 'dept-it');
  requireItem(users, (item) => item.id === 'user-buyer-owner', 'user-buyer-owner');
  requireItem(demands, (item) => item.id === 'dem-local-laptop', 'dem-local-laptop');
  requireItem(platformTenants, (item) => item.id === 'tenant-acme', 'tenant-acme');
  let createdSmokeDepartment = null;
  if (process.env.JAVA_CREATE_SMOKE_DEPARTMENT === '1') {
    createdSmokeDepartment = await requestJson('/api/v1/buyer/departments', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `联调部门 ${Date.now()}`,
        parentId: 'dept-it',
      }),
    });
    if (createdSmokeDepartment.status !== 'active' || createdSmokeDepartment.parentId !== 'dept-it') {
      throw new Error('Unexpected Java created department payload');
    }
  }
  if (process.env.JAVA_DISABLE_SMOKE_DEPARTMENT === '1' && createdSmokeDepartment) {
    const disabledDepartment = await requestJson(`/api/v1/buyer/departments/${createdSmokeDepartment.id}/disable`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (disabledDepartment.status !== 'inactive') {
      throw new Error('Unexpected Java disabled department payload');
    }
  }
  if (platformOverview.scope !== 'platform') {
    throw new Error(`Unexpected Java platform overview scope: ${platformOverview.scope}`);
  }
  if (platformWorkspace.overview?.scope !== 'platform' || !Array.isArray(platformWorkspace.tenants)) {
    throw new Error('Unexpected Java platform workspace aggregate payload');
  }
  const buyerTenant = platformTenants.find((item) => item.id === buyerLogin.tenantId);
  let financeFeatureTenant = buyerTenant;
  if (!buyerTenant) {
    throw new Error(`Missing Java buyer tenant in platform tenant list: ${buyerLogin.tenantId}`);
  }
  if (!buyerTenant.enabledFeatures?.includes('finance')) {
    financeFeatureTenant = await requestJson(`/api/v1/platform/tenants/${buyerLogin.tenantId}/features`, {
      method: 'POST',
      headers: { ...platformHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        enabledFeatures: Array.from(new Set([...(buyerTenant.enabledFeatures ?? []), 'finance'])),
      }),
    });
  }
  if (!financeFeatureTenant.enabledFeatures?.includes('finance')) {
    throw new Error('Java smoke tenant does not have finance feature enabled');
  }
  if (supplierProfile.id !== 'ent-supplier-sunrise') {
    throw new Error(`Unexpected Java supplier profile: ${supplierProfile.id}`);
  }
  if (supplierWorkspace.profile?.id !== 'ent-supplier-sunrise' || !Array.isArray(supplierWorkspace.opportunities)) {
    throw new Error('Unexpected Java supplier workspace aggregate payload');
  }
  if (!Array.isArray(buyerWorkspace.suppliers) || !Array.isArray(buyerWorkspace.auditLogs)) {
    throw new Error('Unexpected Java buyer workspace aggregate payload');
  }

  const pendingAdmissionRelation = findPendingAdmissionRelation(suppliers);
  let admissionApproval = null;
  let admittedRelation = null;
  if (pendingAdmissionRelation?.status === '待准入') {
    const submittedAdmission = await requestJson(`/api/v1/buyer/suppliers/${pendingAdmissionRelation.id}/submit`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (submittedAdmission.bizType !== 'buyer_supplier_admission' || submittedAdmission.bizId !== pendingAdmissionRelation.id) {
      throw new Error('Unexpected Java supplier admission submission payload');
    }

    admissionApproval = await requestJson(`/api/v1/buyer/suppliers/${pendingAdmissionRelation.id}/approval`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    if (admissionApproval.status !== '已通过') {
      throw new Error(`Unexpected Java supplier admission approval status: ${admissionApproval.status}`);
    }

    const refreshedBuyerWorkspace = await requestJson('/api/v1/buyer/workspace', { headers: authHeaders });
    admittedRelation = refreshedBuyerWorkspace.suppliers.find((item) => item.id === pendingAdmissionRelation.id);
    if (!admittedRelation || admittedRelation.status !== '已准入') {
      throw new Error('Java buyer workspace did not refresh supplier admission status to admitted');
    }
  }

  const smokeDemand = await requestJson('/api/v1/buyer/demands', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `本地联调采购需求 ${Date.now()}`,
      departmentId: 'dept-it',
      budget: 120000,
      lineItems: [
        {
          materialId: 'mat-laptop',
          quantity: 10,
        },
      ],
    }),
  });
  if (smokeDemand.status !== '草稿') {
    throw new Error(`Unexpected Java smoke demand status: ${smokeDemand.status}`);
  }

  const submittedDemand = await requestJson(`/api/v1/buyer/demands/${smokeDemand.id}/submit`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (submittedDemand.bizType !== 'purchase_demand' || submittedDemand.bizId !== smokeDemand.id) {
    throw new Error('Unexpected Java purchase demand submission payload');
  }

  const demandApproval = await requestJson(`/api/v1/buyer/demands/${smokeDemand.id}/approval`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ approved: true }),
  });
  if (demandApproval.status !== '已通过') {
    throw new Error(`Unexpected Java purchase demand approval status: ${demandApproval.status}`);
  }

  const rfq = await requestJson('/api/v1/buyer/rfqs', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `本地联调 RFQ ${Date.now()}`,
      demandIds: [smokeDemand.id],
      invitedSupplierIds: ['ent-supplier-sunrise'],
      deadlineAt: futureDeadline(),
    }),
  });

  const quote = await requestJson(`/api/v1/supplier/rfqs/${rfq.id}/quotes`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: 118000,
      taxRate: 13,
      deliveryDays: 7,
    }),
  });

  const award = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/award`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteId: quote.id,
      reason: '本地联调报价最优',
    }),
  });

  const approvedAward = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/award/approval`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      awardId: award.id,
      approved: true,
    }),
  });
  if (approvedAward.approvedStatus !== '已通过') {
    throw new Error(`Unexpected Java award approval status: ${approvedAward.approvedStatus}`);
  }

  const order = await requestJson('/api/v1/buyer/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      awardId: approvedAward.id,
      expectedReceiptDate: futureDate(),
    }),
  });

  const confirmedOrder = await requestJson(`/api/v1/supplier/orders/${order.id}/confirm`, {
    method: 'POST',
    headers: supplierHeaders,
  });

  const delivery = await requestJson(`/api/v1/supplier/orders/${confirmedOrder.id}/deliveries`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      carrier: '顺丰速运',
      trackingNo: `SF${Date.now()}`,
    }),
  });

  const receipt = await requestJson(`/api/v1/buyer/orders/${order.id}/receipts`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      result: '验收通过',
    }),
  });

  const invoice = await requestJson(`/api/v1/supplier/orders/${order.id}/invoices`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: order.amount,
      invoiceNo: `INV-${Date.now()}`,
    }),
  });

  const threeWayMatchesAfterInvoice = await requestJson(
    `/api/v1/buyer/three-way-matches?matchStatus=${encodeURIComponent('三单匹配通过')}&invoiceId=${invoice.id}`,
    { headers: authHeaders },
  );
  const threeWayMatchAfterInvoice = threeWayMatchesAfterInvoice.find((item) => item.invoiceId === invoice.id);
  if (!threeWayMatchAfterInvoice || threeWayMatchAfterInvoice.paymentReadiness !== '可申请付款') {
    throw new Error('Java three-way match ledger did not record payable invoice readiness');
  }

  const rebuiltThreeWayMatches = await requestJson('/api/v1/buyer/three-way-matches/rebuild', {
    method: 'POST',
    headers: authHeaders,
  });
  if (typeof rebuiltThreeWayMatches.rebuiltCount !== 'number' || rebuiltThreeWayMatches.rebuiltCount < 1) {
    throw new Error('Java three-way match rebuild did not report rebuilt records');
  }

  const perturbedInvoiceAmount = Number(invoice.amount) + 123.45;
  // Java smoke deliberately perturbs invoice amount after valid invoice creation
  // so the API-level variance handling flow can be exercised without weakening
  // the supplier invoice creation policy.
  runLocalSmokeSql(`
    update invoices
    set amount = ${perturbedInvoiceAmount},
        updated_at = now()
    where tenant_id = ${sqlLiteral(buyerLogin.tenantId)}
      and id = ${sqlLiteral(invoice.id)}
  `);

  await requestJson('/api/v1/buyer/three-way-matches/rebuild', {
    method: 'POST',
    headers: authHeaders,
  });
  const varianceMatches = await requestJson(
    `/api/v1/buyer/three-way-matches?matchStatus=${encodeURIComponent('金额差异')}&invoiceId=${invoice.id}`,
    { headers: authHeaders },
  );
  const varianceMatch = varianceMatches.find((item) => item.invoiceId === invoice.id);
  if (!varianceMatch || varianceMatch.paymentReadiness !== '需处理差异') {
    throw new Error('Java smoke did not create an amount variance three-way match');
  }

  await expectRequestFailure('/api/v1/buyer/payment-requests', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      invoiceId: invoice.id,
      requestStatus: '付款申请待提交',
      paymentBatchNo: `PAY-BLOCKED-${Date.now()}`,
      remark: 'Java smoke expects variance to block payment request',
    }),
  }, 'Amount variance must be handled before payment request');

  const varianceHandling = await requestJson(`/api/v1/buyer/three-way-matches/${varianceMatch.id}/variance-handling`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (varianceHandling.status !== '待处理' || varianceHandling.invoiceId !== invoice.id) {
    throw new Error('Java smoke did not create variance handling from amount variance match');
  }

  const resolvedVarianceHandling = await requestJson(`/api/v1/buyer/variance-handlings/${varianceHandling.id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      status: '已处理',
      result: 'Java smoke 已核对差异，恢复付款申请。',
    }),
  });
  if (resolvedVarianceHandling.status !== '已处理') {
    throw new Error('Java smoke did not resolve variance handling');
  }

  const paymentBatchNo = `PAY-SMOKE-${Date.now()}`;
  const paymentRequest = await requestJson('/api/v1/buyer/payment-requests', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      invoiceId: invoice.id,
      requestStatus: '付款申请待提交',
      paymentBatchNo,
      remark: 'Java smoke 付款申请和付款批次联调',
    }),
  });
  if (paymentRequest.paymentBatchNo !== paymentBatchNo || paymentRequest.invoiceId !== invoice.id) {
    throw new Error('Unexpected Java payment request payload');
  }

  runLocalSmokeSql(`
    update invoices
    set amount = ${Number(order.amount)},
        updated_at = now()
    where tenant_id = ${sqlLiteral(buyerLogin.tenantId)}
      and id = ${sqlLiteral(invoice.id)}
  `);
  await requestJson('/api/v1/buyer/three-way-matches/rebuild', {
    method: 'POST',
    headers: authHeaders,
  });

  const submittedPaymentRequest = await requestJson(`/api/v1/buyer/payment-requests/${paymentRequest.id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestStatus: '付款申请审批中',
    }),
  });
  if (submittedPaymentRequest.requestStatus !== '付款申请审批中') {
    throw new Error(`Unexpected Java payment request submitted status: ${submittedPaymentRequest.requestStatus}`);
  }

  const paymentBatchesAfterSubmit = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('审批中')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterSubmit = paymentBatchesAfterSubmit.find((item) => item.paymentBatchNo === paymentBatchNo);
  if (!paymentBatchAfterSubmit || paymentBatchAfterSubmit.batchStatus !== '审批中') {
    throw new Error('Java payment batch did not refresh to approval pending status');
  }

  const approvedPaymentRequest = await requestJson(`/api/v1/buyer/payment-requests/${paymentRequest.id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestStatus: '付款申请已通过',
    }),
  });
  if (approvedPaymentRequest.requestStatus !== '付款申请已通过') {
    throw new Error(`Unexpected Java payment request approved status: ${approvedPaymentRequest.requestStatus}`);
  }

  const paymentBatchesAfterApproval = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('可安排付款')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterApproval = paymentBatchesAfterApproval.find((item) => item.paymentBatchNo === paymentBatchNo);
  if (!paymentBatchAfterApproval || paymentBatchAfterApproval.batchStatus !== '可安排付款') {
    throw new Error('Java payment batch did not refresh to payable status');
  }

  const paymentExecutionRecordsBeforePayment = await requestJson(
    `/api/v1/buyer/payment-execution-records?paymentBatchNo=${encodeURIComponent(paymentBatchNo)}&executionStatus=${encodeURIComponent('待登记付款')}`,
    { headers: authHeaders },
  );
  const paymentExecutionRecordBeforePayment = paymentExecutionRecordsBeforePayment.find(
    (item) => item.paymentRequestId === paymentRequest.id && item.invoiceId === invoice.id,
  );
  if (!paymentExecutionRecordBeforePayment || paymentExecutionRecordBeforePayment.executionStatus !== '待登记付款') {
    throw new Error('Java payment execution record did not refresh to pending registration status');
  }

  const paymentBlockResolution = await requestJson('/api/v1/buyer/payment-block-resolutions', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      paymentBatchNo,
      paymentRequestId: paymentRequest.id,
      invoiceId: invoice.id,
      supplierId: paymentRequest.supplierId,
      blockReason: 'Java smoke 阻断处理记录',
      resolutionStatus: '处理中',
      resolutionAction: 'Java smoke 已创建付款阻断处理记录',
      nextStep: '继续更新处理状态并确认 Java 台账可读取。',
      handledBy: buyerLogin.userId ?? 'user-buyer-owner',
    }),
  });
  if (
    paymentBlockResolution.paymentBatchNo !== paymentBatchNo
    || paymentBlockResolution.paymentRequestId !== paymentRequest.id
    || paymentBlockResolution.resolutionStatus !== '处理中'
  ) {
    throw new Error('Java smoke did not create payment block resolution record');
  }

  const updatedPaymentBlockResolution = await requestJson(
    `/api/v1/buyer/payment-block-resolutions/${paymentBlockResolution.id}/status`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        resolutionStatus: '已处理待刷新',
        resolutionAction: 'Java smoke 已更新付款阻断处理记录',
        nextStep: '刷新付款批次详情并确认处理记录台账非空回显。',
        handledBy: buyerLogin.userId ?? 'user-buyer-owner',
      }),
    },
  );
  if (updatedPaymentBlockResolution.resolutionStatus !== '已处理待刷新') {
    throw new Error('Java smoke did not update payment block resolution status');
  }
  const paymentBlockResolutions = await requestJson(
    `/api/v1/buyer/payment-block-resolutions?paymentBatchNo=${encodeURIComponent(paymentBatchNo)}`,
    { headers: authHeaders },
  );
  const loadedPaymentBlockResolution = paymentBlockResolutions.find(
    (item) => item.id === paymentBlockResolution.id && item.resolutionStatus === '已处理待刷新',
  );
  if (!loadedPaymentBlockResolution) {
    throw new Error('Java smoke did not read back updated payment block resolution record');
  }

  const paymentBatchAfterBatchSubmit = await requestJson(
    `/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        batchStatus: '审批中',
      }),
    },
  );
  if (paymentBatchAfterBatchSubmit.batchStatus !== '审批中') {
    throw new Error(`Unexpected Java payment batch approval submitted status: ${paymentBatchAfterBatchSubmit.batchStatus}`);
  }

  const pendingBatchApprovals = await requestJson('/api/v1/buyer/approvals/pending', {
    headers: authHeaders,
  });
  const pendingBatchApproval = pendingBatchApprovals.find(
    (item) => item.bizType === 'payment_batch' && item.bizId === paymentBatchNo,
  );
  if (
    !pendingBatchApproval
    || pendingBatchApproval.summaryTitle !== `付款批次 ${paymentBatchNo}`
    || pendingBatchApproval.businessStatus !== '审批中'
  ) {
    throw new Error('Java smoke did not expose payment batch approval task');
  }

  const paymentBatchAfterBatchApproval = await requestJson(
    `/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        batchStatus: '可安排付款',
      }),
    },
  );
  if (paymentBatchAfterBatchApproval.batchStatus !== '可安排付款') {
    throw new Error(`Unexpected Java payment batch approval passed status: ${paymentBatchAfterBatchApproval.batchStatus}`);
  }
  const pendingApprovalsAfterBatchApproval = await requestJson('/api/v1/buyer/approvals/pending', {
    headers: authHeaders,
  });
  if (pendingApprovalsAfterBatchApproval.some((item) => item.bizType === 'payment_batch' && item.bizId === paymentBatchNo)) {
    throw new Error('Java smoke did not close payment batch approval task');
  }

  const registeredExecutionRecord = await requestJson(`/api/v1/buyer/payment-execution-records/${paymentExecutionRecordBeforePayment.id}/registration`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (registeredExecutionRecord.executionStatus !== '已登记付款') {
    throw new Error('Java payment execution registration endpoint did not return registered status');
  }

  const paymentExecutionRecordsAfterPayment = await requestJson(
    `/api/v1/buyer/payment-execution-records?paymentBatchNo=${encodeURIComponent(paymentBatchNo)}&executionStatus=${encodeURIComponent('已登记付款')}`,
    { headers: authHeaders },
  );
  const paymentExecutionRecordAfterPayment = paymentExecutionRecordsAfterPayment.find(
    (item) => item.paymentRequestId === paymentRequest.id && item.invoiceId === invoice.id,
  );
  if (!paymentExecutionRecordAfterPayment || paymentExecutionRecordAfterPayment.executionStatus !== '已登记付款') {
    throw new Error('Java payment execution record did not refresh to registered payment status');
  }

  const paymentBatchAfterArchive = await requestJson(
    `/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        batchStatus: '已付款归档',
      }),
    },
  );
  if (paymentBatchAfterArchive.batchStatus !== '已付款归档') {
    throw new Error(`Unexpected Java payment batch archived status: ${paymentBatchAfterArchive.batchStatus}`);
  }

  const smokeContractNo = `CTR-${order.id}`;
  const createdContract = await requestJson('/api/v1/buyer/contracts', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      contractNo: smokeContractNo,
      contractName: `Java smoke 采购合同 ${order.id}`,
      relatedOrderId: order.id,
      amount: order.amount,
      status: '草案',
      fulfillmentProgress: '待审批',
      effectiveDate: new Date().toISOString().slice(0, 10),
    }),
  });
  if (
    createdContract.contractNo !== smokeContractNo
    || createdContract.relatedOrderId !== order.id
    || createdContract.supplierId !== order.supplierId
  ) {
    throw new Error('Java smoke did not create a tenant-scoped contract ledger');
  }

  const smokeContractId = createdContract.id;
  const submittedContractApproval = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}/approval`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (submittedContractApproval.status !== '审批中') {
    throw new Error(`Unexpected Java smoke contract approval submitted status: ${submittedContractApproval.status}`);
  }

  const approvedContract = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}/approval-review`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      approved: true,
    }),
  });
  if (approvedContract.status !== '已生效' || approvedContract.fulfillmentProgress !== '已生效') {
    throw new Error('Java smoke did not approve contract through approval center flow');
  }

  const updatedContract = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      contractNo: smokeContractNo,
      contractName: `Java smoke 已编辑采购合同 ${order.id}`,
      amount: order.amount,
      status: '履约完成',
      fulfillmentProgress: '已收货验收',
      effectiveDate: createdContract.effectiveDate,
    }),
  });
  if (updatedContract.status !== '履约完成' || updatedContract.fulfillmentProgress !== '已收货验收') {
    throw new Error('Java smoke did not update contract ledger details');
  }

  const contractFulfillmentEvent = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}/fulfillment-events`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      actionType: 'receipt',
      targetId: order.id,
      summary: `收货验收已由合同联动入口推进：${order.id}`,
      sourceLabel: `${updatedContract.contractNo} · ${updatedContract.contractName}`,
    }),
  });
  if (
    contractFulfillmentEvent.contractId !== smokeContractId
    || contractFulfillmentEvent.targetId !== order.id
    || !contractFulfillmentEvent.summary.includes('合同联动入口推进')
  ) {
    throw new Error('Java smoke did not persist contract fulfillment event');
  }

  const contractFulfillmentEvents = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}/fulfillment-events`, {
    headers: authHeaders,
  });
  if (!contractFulfillmentEvents.some((event) => event.id === contractFulfillmentEvent.id)) {
    throw new Error('Java smoke did not list persisted contract fulfillment event');
  }

  const contractAttachmentTicket = await requestJson('/api/v1/buyer/attachments/upload-ticket', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      ownerType: 'contract',
      ownerId: smokeContractId,
      fileName: '合同正文.pdf',
      visibility: 'buyer_internal',
    }),
  });
  if (
    !contractAttachmentTicket.uploadUrl
    || !contractAttachmentTicket.storageKey?.includes(smokeContractId)
    || contractAttachmentTicket.ownerType !== 'contract'
  ) {
    throw new Error('Java smoke did not generate a contract attachment upload ticket');
  }

  const contractAttachment = await requestJson('/api/v1/buyer/attachments', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      ownerType: 'contract',
      ownerId: smokeContractId,
      fileName: '合同正文.pdf',
      storageKey: contractAttachmentTicket.storageKey,
      visibility: 'buyer_internal',
    }),
  });
  if (contractAttachment.ownerId !== smokeContractId || contractAttachment.storageKey !== contractAttachmentTicket.storageKey) {
    throw new Error('Java smoke did not register contract attachment metadata from upload ticket');
  }

  const contractAttachmentDownloadLink = await requestJson(`/api/v1/buyer/attachments/${contractAttachment.id}/download-link`, {
    method: 'POST',
    headers: authHeaders,
  });
  if (!contractAttachmentDownloadLink.downloadUrl || contractAttachmentDownloadLink.attachmentId !== contractAttachment.id) {
    throw new Error('Java smoke did not generate contract attachment download link');
  }

  const archivedContract = await requestJson(`/api/v1/buyer/contracts/${smokeContractId}/archive-status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      archiveStatus: '已归档',
    }),
  });
  if (archivedContract.archiveStatus !== '已归档') {
    throw new Error(`Unexpected Java smoke archived contract status: ${archivedContract.archiveStatus}`);
  }

  await expectRequestFailure(`/api/v1/buyer/contracts/${smokeContractId}/fulfillment-events`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      actionType: 'receipt',
      targetId: order.id,
      summary: `归档后尝试继续写入合同履约事件：${order.id}`,
      sourceLabel: `${updatedContract.contractNo} · ${updatedContract.contractName}`,
    }),
  }, 'Archived contract can only be audited');

  const contractTargetAuditLogs = await requestJson(
    `/api/v1/buyer/audit-logs/target?targetType=contract&targetId=${encodeURIComponent(smokeContractId)}&actions=contract_approval.submitted,contract_approval.approved,contract_fulfillment_event.created&limit=50`,
    { headers: authHeaders },
  );
  if (!contractTargetAuditLogs.some((log) => log.action === 'contract_fulfillment_event.created')) {
    throw new Error('Java smoke did not load contract target audit logs for archive review');
  }

  const paymentArchiveExceptionRequest = await requestJson('/api/v1/buyer/payment-archive-exception-requests', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      paymentBatchNo,
      exceptionType: '撤销申请',
      exceptionReason: 'Java smoke 归档后登记异常申请，验证审批、受控处理和关闭复核闭环。',
    }),
  });
  if (
    paymentArchiveExceptionRequest.paymentBatchNo !== paymentBatchNo
    || paymentArchiveExceptionRequest.approvalStatus !== '待审批'
    || paymentArchiveExceptionRequest.actionStatus !== '待处理'
    || paymentArchiveExceptionRequest.closureStatus !== '待关闭'
  ) {
    throw new Error('Java smoke did not create pending payment archive exception request');
  }

  const paymentArchiveExceptionApproval = await requestJson(`/api/v1/buyer/payment-archive-exception-requests/${paymentArchiveExceptionRequest.id}/approval`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      approved: true,
    }),
  });
  if (
    paymentArchiveExceptionApproval.bizType !== 'payment_archive_exception'
    || paymentArchiveExceptionApproval.bizId !== paymentArchiveExceptionRequest.id
    || paymentArchiveExceptionApproval.status !== '已通过'
  ) {
    throw new Error('Java smoke did not approve payment archive exception request');
  }

  const completedPaymentArchiveExceptionAction = await requestJson(`/api/v1/buyer/payment-archive-exception-requests/${paymentArchiveExceptionRequest.id}/controlled-action`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      actionResult: 'Java smoke 已登记归档异常受控处理动作，仍不直接解冻或改写已归档批次。',
    }),
  });
  if (
    completedPaymentArchiveExceptionAction.actionStatus !== '已登记受控处理'
    || completedPaymentArchiveExceptionAction.handledBy !== buyerLogin.userId
  ) {
    throw new Error('Java smoke did not register controlled payment archive exception action');
  }

  const closedPaymentArchiveExceptionRequest = await requestJson(`/api/v1/buyer/payment-archive-exception-requests/${paymentArchiveExceptionRequest.id}/closure`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      closureResult: 'Java smoke 已完成归档异常关闭复核，后续如需解冻仍走专用流程。',
    }),
  });
  if (
    closedPaymentArchiveExceptionRequest.closureStatus !== '已关闭'
    || closedPaymentArchiveExceptionRequest.closedBy !== buyerLogin.userId
  ) {
    throw new Error('Java smoke did not close payment archive exception request');
  }

  const paymentArchiveExceptionRequests = await requestJson(
    `/api/v1/buyer/payment-archive-exception-requests?paymentBatchNo=${encodeURIComponent(paymentBatchNo)}`,
    { headers: authHeaders },
  );
  const paymentArchiveExceptionClosed = paymentArchiveExceptionRequests.find(
    (item) => item.id === paymentArchiveExceptionRequest.id
      && item.approvalStatus === '已通过'
      && item.actionStatus === '已登记受控处理'
      && item.closureStatus === '已关闭',
  );
  if (!paymentArchiveExceptionClosed) {
    throw new Error('Java smoke did not read back closed payment archive exception request');
  }

  const threeWayMatchesAfterPayment = await requestJson(
    `/api/v1/buyer/three-way-matches?matchStatus=${encodeURIComponent('三单匹配通过')}&invoiceId=${invoice.id}`,
    { headers: authHeaders },
  );
  const threeWayMatchAfterPayment = threeWayMatchesAfterPayment.find((item) => item.invoiceId === invoice.id);
  if (!threeWayMatchAfterPayment || threeWayMatchAfterPayment.paymentReadiness !== '已付款归档') {
    throw new Error('Java three-way match ledger did not refresh payment readiness after payment');
  }

  console.log(`Java local API smoke passed at ${baseUrl}`);
  console.log(`Logged in as ${platformLogin.displayName} for platform scope`);
  console.log(`Logged in as ${buyerLogin.displayName} for tenant ${buyerLogin.tenantId}`);
  console.log(`Loaded ${platformTenants.length} tenants, ${platformOverview.publicSupplierCount} public suppliers, ${platformEnterpriseReviews.length} pending enterprise reviews`);
  console.log(`Loaded platform workspace aggregate with ${platformWorkspace.tenants.length} tenants and ${platformWorkspace.enterpriseReviews.length} pending enterprise reviews`);
  console.log(`Confirmed finance feature for tenant ${buyerLogin.tenantId}`);
  console.log(`Loaded ${suppliers.length} suppliers, ${materials.length} materials, ${departments.length} departments, ${users.length} buyer users`);
  console.log(`Loaded buyer workspace aggregate with ${buyerWorkspace.suppliers.length} suppliers and ${buyerWorkspace.auditLogs.length} audit logs`);
  if (admittedRelation && admissionApproval) {
    console.log(`Approved supplier admission ${admissionApproval.id}; relation ${admittedRelation.id} status is ${admittedRelation.status}`);
  } else {
    console.log('Skipped supplier admission approval smoke because no pending admission relation was available');
  }
  console.log(`Loaded ${demands.length} purchase demands`);
  console.log(`Loaded ${orders.length} purchase orders, ${invoices.length} invoices, ${auditLogs.length} audit logs`);
  console.log(`Loaded supplier ${supplierProfile.name}, ${supplierRfqs.length} RFQs, ${supplierQuotes.length} quotes, ${supplierOrders.length} orders, ${supplierInvoices.length} invoices`);
  console.log(`Loaded supplier workspace aggregate with ${supplierWorkspace.opportunities.length} opportunities and ${supplierWorkspace.orders.length} orders`);
  console.log(`Created demand ${smokeDemand.id}, RFQ ${rfq.id}, quote ${quote.id}, approved award ${approvedAward.id}, order ${order.id}, confirmed status ${confirmedOrder.status}`);
  console.log(`Created delivery ${delivery.id}, receipt ${receipt.id}`);
  console.log(`Created three-way match ${threeWayMatchAfterPayment.id}, status ${threeWayMatchAfterPayment.matchStatus}, readiness ${threeWayMatchAfterPayment.paymentReadiness}`);
  console.log(`Rebuilt ${rebuiltThreeWayMatches.rebuiltCount} three-way match snapshots`);
  console.log(`Recovered payment request ${paymentRequest.id} after variance handling ${resolvedVarianceHandling.id}`);
  console.log(`Created payment request ${paymentRequest.id}, batch ${paymentBatchNo}, batch status ${paymentBatchAfterApproval.batchStatus}`);
  console.log(`Created payment block resolution ${paymentBlockResolution.id}, status ${updatedPaymentBlockResolution.resolutionStatus}`);
  console.log(`Loaded payment block resolutions ${paymentBlockResolutions.length} for batch ${paymentBatchNo}`);
  console.log(`Submitted and approved payment batch approval ${pendingBatchApproval.id} for ${paymentBatchNo}, batch status ${paymentBatchAfterBatchApproval.batchStatus}`);
  console.log(`Archived payment batch ${paymentBatchAfterArchive.paymentBatchNo}, batch status ${paymentBatchAfterArchive.batchStatus}`);
  console.log(`Created, approved and updated contract ${updatedContract.contractNo}, status ${updatedContract.status}`);
  console.log(`Contract fulfillment event persisted ${contractFulfillmentEvent.id}, target ${contractFulfillmentEvent.targetId}`);
  console.log(`Generated contract attachment upload ticket and download link ${contractAttachment.id}`);
  console.log(`Archived contract ${archivedContract.contractNo}, archive status ${archivedContract.archiveStatus}`);
  console.log(`Archived contract fulfillment event write guard verified for ${archivedContract.contractNo}`);
  console.log(`Archived contract audit view evidence: approval, attachment ${contractAttachment.id}, fulfillment event ${contractFulfillmentEvent.id}, readonly guard`);
  console.log(`Contract target audit logs loaded ${contractTargetAuditLogs.length} entries for ${archivedContract.contractNo}`);
  console.log(`Closed payment archive exception ${paymentArchiveExceptionRequest.id}, closure status ${closedPaymentArchiveExceptionRequest.closureStatus}`);
  console.log(`Created invoice ${invoice.id}, payment execution status ${registeredExecutionRecord.executionStatus}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
