import { baseUrl, requestJson, runLocalSmokeSql, sqlLiteral } from './java-smoke-support.mjs';

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

const workflowSmokeDefinitions = [
  { businessType: 'purchase_demand', name: '采购需求审批' },
  { businessType: 'buyer_supplier_admission', name: '供应商准入审批' },
  { businessType: 'rfq_award', name: '询价定标审批' },
  { businessType: 'contract_approval', name: '合同审批' },
  { businessType: 'payment_request', name: '付款申请审批' },
  { businessType: 'payment_batch', name: '付款批次审批' },
  { businessType: 'payment_archive_exception', name: '付款归档例外审批' },
];

const workflowValueForSmoke = (field, businessType) => {
  if (field.type === 'number' || field.type === 'money') return 1;
  if (field.type === 'date') return futureDate();
  if (field.type === 'select') {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      throw new Error(`Published workflow select field has no options: ${businessType}.${field.id}`);
    }
    return field.options[0];
  }
  return `Java smoke ${businessType} ${field.label ?? field.id}`;
};

const formDataForPublishedWorkflow = (publishedForm) => {
  let schema;
  try {
    schema = JSON.parse(publishedForm.formSchema ?? '{"fields":[]}');
  } catch {
    throw new Error(`Published workflow form is not valid JSON: ${publishedForm.businessType}`);
  }
  if (!Array.isArray(schema.fields)) {
    throw new Error(`Published workflow form fields are invalid: ${publishedForm.businessType}`);
  }
  return Object.fromEntries(
    schema.fields
      .filter((field) => field?.required)
      .map((field) => [field.id, workflowValueForSmoke(field, publishedForm.businessType)]),
  );
};

// The smoke does not overwrite tenant configuration. It creates a minimal role-based
// definition only when this business type has never been configured in the local seed.
const ensurePublishedWorkflowForms = async (authHeaders) => {
  const [processes, roles] = await Promise.all([
    requestJson('/api/v1/buyer/process-definitions', { headers: authHeaders }),
    requestJson('/api/v1/buyer/roles', { headers: authHeaders }),
  ]);
  const configuredRoleId = process.env.JAVA_SMOKE_WORKFLOW_ROLE_ID ?? 'role-buyer-owner';
  if (!roles.some((role) => role.id === configuredRoleId)) {
    throw new Error(`Java smoke workflow role is unavailable in tenant scope: ${configuredRoleId}`);
  }
  const processByBusinessType = new Map(
    processes.filter((process) => process.businessType).map((process) => [process.businessType, process]),
  );
  const flowSchema = JSON.stringify({
    steps: [
      {
        id: 'smoke_review',
        type: 'approver',
        title: 'Java smoke 审批',
        assignment: { type: 'role', roleId: configuredRoleId },
      },
    ],
  });

  for (const definition of workflowSmokeDefinitions) {
    const existing = processByBusinessType.get(definition.businessType);
    if (existing?.activeVersionId) continue;
    if (existing) {
      throw new Error(
        `Workflow definition exists but has no published version: ${definition.businessType}. Publish it before running java:smoke.`,
      );
    }
    const created = await requestJson('/api/v1/buyer/process-definitions', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Java smoke · ${definition.name}`,
        description: '仅用于本地 Java 联调的最小受控 Flowable 定义。',
        icon: 'file-text',
        businessType: definition.businessType,
      }),
    });
    const saved = await requestJson(`/api/v1/buyer/process-definitions/${created.id}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: created.name,
        description: created.description,
        status: 'draft',
        formSchema: '{"fields":[]}',
        flowSchema,
        businessType: definition.businessType,
      }),
    });
    const published = await requestJson(`/api/v1/buyer/process-definitions/${saved.id}/publish`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (!published.activeVersionId) {
      throw new Error(`Java smoke could not publish workflow definition: ${definition.businessType}`);
    }
  }

  const forms = {};
  for (const definition of workflowSmokeDefinitions) {
    const publishedForm = await requestJson(
      `/api/v1/buyer/workflow/definitions/${definition.businessType}/form`,
      { headers: authHeaders },
    );
    if (!publishedForm.definitionVersionId) {
      throw new Error(`Published workflow definition is missing: ${definition.businessType}`);
    }
    forms[definition.businessType] = formDataForPublishedWorkflow(publishedForm);
  }
  return forms;
};

const completeWorkflowBusinessTask = async (
  authHeaders,
  businessType,
  businessId,
  comment,
  action = 'approve',
) => {
  for (let index = 0; index < 20; index += 1) {
    const tasks = await requestJson('/api/v1/buyer/workflow/tasks', { headers: authHeaders });
    const task = tasks.find((item) => item.businessType === businessType && item.businessId === businessId);
    if (!task) {
      throw new Error(`Java smoke could not find Flowable task for ${businessType}: ${businessId}`);
    }
    const history = await requestJson(`/api/v1/buyer/workflow/tasks/${task.taskId}/complete`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ action, comment }),
    });
    if (history.status !== 'processing') return { task, history };
  }
  throw new Error(`Java smoke exceeded Flowable task steps for ${businessType}: ${businessId}`);
};

const main = async () => {
  const skipPlatformSmoke = process.env.JAVA_SKIP_PLATFORM_SMOKE === '1';
  const platformLogin = skipPlatformSmoke
    ? null
    : await requestJson('/api/v1/auth/login', {
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

  const platformHeaders = platformLogin
    ? { Authorization: `${platformLogin.tokenType} ${platformLogin.accessToken}` }
    : null;
  const authHeaders = { Authorization: `${buyerLogin.tokenType} ${buyerLogin.accessToken}` };
  const supplierHeaders = { Authorization: `${supplierLogin.tokenType} ${supplierLogin.accessToken}` };
  const [platformWorkspace, platformOverview, platformTenants, platformEnterpriseReviews] = platformHeaders
    ? await Promise.all([
        requestJson('/api/v1/platform/workspace', { headers: platformHeaders }),
        requestJson('/api/v1/platform/overview', { headers: platformHeaders }),
        requestJson('/api/v1/platform/tenants', { headers: platformHeaders }),
        requestJson('/api/v1/platform/enterprise-reviews', { headers: platformHeaders }),
      ])
    : [null, null, [], []];
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

  requireItem(suppliers, (item) => item.supplierId === 'ent-supplier-sunrise', 'ent-supplier-sunrise');
  requireItem(materials, (item) => item.id === 'mat-laptop', 'mat-laptop');
  requireItem(departments, (item) => item.id === 'dept-it', 'dept-it');
  requireItem(users, (item) => item.id === 'user-buyer-owner', 'user-buyer-owner');
  if (!skipPlatformSmoke) {
    requireItem(platformTenants, (item) => item.id === 'tenant-acme', 'tenant-acme');
  }
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
  if (!skipPlatformSmoke) {
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
  }
  const workflowFormData = await ensurePublishedWorkflowForms(authHeaders);
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
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ formData: workflowFormData.buyer_supplier_admission }),
    });
    if (submittedAdmission.bizType !== 'buyer_supplier_admission' || submittedAdmission.bizId !== pendingAdmissionRelation.id) {
      throw new Error('Unexpected Java supplier admission submission payload');
    }

    admissionApproval = await completeWorkflowBusinessTask(
      authHeaders,
      'buyer_supplier_admission',
      pendingAdmissionRelation.id,
      'Java smoke 供应商准入通过',
    );
    if (admissionApproval.history.status !== 'approved') {
      throw new Error(`Unexpected Java supplier admission workflow status: ${admissionApproval.history.status}`);
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
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ formData: workflowFormData.purchase_demand }),
  });
  if (submittedDemand.bizType !== 'purchase_demand' || submittedDemand.bizId !== smokeDemand.id) {
    throw new Error('Unexpected Java purchase demand submission payload');
  }

  const demandApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'purchase_demand',
    smokeDemand.id,
    'Java smoke 采购需求通过',
  );
  if (demandApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java purchase demand workflow status: ${demandApproval.history.status}`);
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

  const materialById = new Map(materials.map((material) => [material.id, material]));
  const quoteLineItems = (smokeDemand.lineItems ?? []).map((lineItem, index) => {
    const material = materialById.get(lineItem.materialId);
    const quantity = Number(lineItem.quantity);
    if (!lineItem.id || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Java smoke demand line is not quotable: ${smokeDemand.id}`);
    }
    return {
      demandItemId: lineItem.id,
      description: material?.name ?? `采购清单行 ${index + 1}`,
      unit: material?.unit ?? '项',
      quantity,
      unitPrice: 118000 / quantity,
    };
  });
  if (quoteLineItems.length === 0) {
    throw new Error(`Java smoke RFQ has no demand line items: ${rfq.id}`);
  }

  const quote = await requestJson(`/api/v1/supplier/rfqs/${rfq.id}/quotes`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: 118000,
      taxRate: 13,
      deliveryDays: 7,
      lineItems: quoteLineItems,
    }),
  });

  const openedRfq = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/open`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ force: true }),
  });
  if (openedRfq.status !== '已开标' || !openedRfq.openedAt) {
    throw new Error(`Java smoke did not open RFQ before award: ${rfq.id}`);
  }

  const award = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/award`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteId: quote.id,
      reason: '本地联调报价最优',
      formData: workflowFormData.rfq_award,
    }),
  });

  const awardApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'rfq_award',
    award.id,
    'Java smoke 询价定标通过',
  );
  if (awardApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java award workflow status: ${awardApproval.history.status}`);
  }
  const approvedAward = { ...award, approvedStatus: '已通过' };

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
  const paymentBatchNo = `PAY-SMOKE-${Date.now()}`;
  let resolvedVarianceHandling;
  let paymentRequest;
  let invoiceAmountPerturbed = false;
  // Java smoke deliberately perturbs invoice amount after valid invoice creation
  // so the API-level variance handling flow can be exercised without weakening
  // the supplier invoice creation policy.
  try {
    runLocalSmokeSql(`
      update invoices
      set amount = ${perturbedInvoiceAmount},
          updated_at = now()
      where tenant_id = ${sqlLiteral(buyerLogin.tenantId)}
        and id = ${sqlLiteral(invoice.id)}
    `);
    invoiceAmountPerturbed = true;

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

    resolvedVarianceHandling = await requestJson(`/api/v1/buyer/variance-handlings/${varianceHandling.id}/status`, {
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

    paymentRequest = await requestJson('/api/v1/buyer/payment-requests', {
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
  } finally {
    if (invoiceAmountPerturbed) {
      runLocalSmokeSql(`
        update invoices
        set amount = ${Number(invoice.amount)},
            updated_at = now()
        where tenant_id = ${sqlLiteral(buyerLogin.tenantId)}
          and id = ${sqlLiteral(invoice.id)}
      `);
      await requestJson('/api/v1/buyer/three-way-matches/rebuild', {
        method: 'POST',
        headers: authHeaders,
      });
    }
  }

  const submittedPaymentRequest = await requestJson(`/api/v1/buyer/payment-requests/${paymentRequest.id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestStatus: '付款申请审批中',
      formData: workflowFormData.payment_request,
    }),
  });
  if (submittedPaymentRequest.requestStatus !== '付款申请审批中') {
    throw new Error(`Unexpected Java payment request submitted status: ${submittedPaymentRequest.requestStatus}`);
  }

  const paymentBatchesAfterSubmit = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('付款申请审批中')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterSubmit = paymentBatchesAfterSubmit.find((item) => item.paymentBatchNo === paymentBatchNo);
  if (!paymentBatchAfterSubmit || paymentBatchAfterSubmit.batchStatus !== '付款申请审批中') {
    throw new Error('Java payment batch did not wait for payment request approval');
  }

  await expectRequestFailure(`/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      batchStatus: '审批中',
      formData: workflowFormData.payment_batch,
    }),
  }, 'Payment batch cannot be approved until all payment requests are approved');

  const rejectedPaymentRequest = await completeWorkflowBusinessTask(
    authHeaders,
    'payment_request',
    paymentRequest.id,
    'Java smoke 付款申请驳回后补充付款依据',
    'reject',
  );
  if (rejectedPaymentRequest.history.status !== 'rejected') {
    throw new Error(`Unexpected rejected payment request workflow status: ${rejectedPaymentRequest.history.status}`);
  }
  const paymentRequestsAfterRejection = await requestJson('/api/v1/buyer/payment-requests', { headers: authHeaders });
  const rejectedPaymentRequestRecord = paymentRequestsAfterRejection.find((item) => item.id === paymentRequest.id);
  if (!rejectedPaymentRequestRecord || rejectedPaymentRequestRecord.requestStatus !== '付款申请已驳回') {
    throw new Error(`Java payment request did not persist rejection: ${rejectedPaymentRequestRecord?.requestStatus}`);
  }
  const paymentBatchesAfterRequestRejection = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('付款申请未通过')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterRequestRejection = paymentBatchesAfterRequestRejection.find(
    (item) => item.paymentBatchNo === paymentBatchNo,
  );
  if (!paymentBatchAfterRequestRejection || paymentBatchAfterRequestRejection.batchStatus !== '付款申请未通过') {
    throw new Error('Java payment batch did not return to payment request rejection state');
  }

  const resubmittedPaymentRequest = await requestJson(`/api/v1/buyer/payment-requests/${paymentRequest.id}/status`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      requestStatus: '付款申请审批中',
      formData: workflowFormData.payment_request,
    }),
  });
  if (resubmittedPaymentRequest.requestStatus !== '付款申请审批中') {
    throw new Error(`Java payment request did not resubmit after rejection: ${resubmittedPaymentRequest.requestStatus}`);
  }

  const paymentRequestApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'payment_request',
    paymentRequest.id,
    'Java smoke 付款申请通过',
  );
  if (paymentRequestApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java payment request workflow status: ${paymentRequestApproval.history.status}`);
  }
  const paymentRequestsAfterApproval = await requestJson('/api/v1/buyer/payment-requests', { headers: authHeaders });
  const approvedPaymentRequest = paymentRequestsAfterApproval.find((item) => item.id === paymentRequest.id);
  if (!approvedPaymentRequest || approvedPaymentRequest.requestStatus !== '付款申请已通过') {
    throw new Error(`Unexpected Java payment request approved status: ${approvedPaymentRequest?.requestStatus}`);
  }

  const paymentBatchesAfterApproval = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('待提交审批')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterApproval = paymentBatchesAfterApproval.find((item) => item.paymentBatchNo === paymentBatchNo);
  if (!paymentBatchAfterApproval || paymentBatchAfterApproval.batchStatus !== '待提交审批') {
    throw new Error('Java payment batch did not return to pending batch approval after request approval');
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
  await expectRequestFailure(`/api/v1/buyer/payment-execution-records/${paymentExecutionRecordBeforePayment.id}/registration`, {
    method: 'POST',
    headers: authHeaders,
  }, 'Payment batch must be approved before payment execution registration');

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
        formData: workflowFormData.payment_batch,
      }),
    },
  );
  if (paymentBatchAfterBatchSubmit.batchStatus !== '审批中') {
    throw new Error(`Unexpected Java payment batch approval submitted status: ${paymentBatchAfterBatchSubmit.batchStatus}`);
  }

  const rejectedPaymentBatch = await completeWorkflowBusinessTask(
    authHeaders,
    'payment_batch',
    paymentBatchNo,
    'Java smoke 付款批次驳回后补充资金计划',
    'reject',
  );
  if (rejectedPaymentBatch.history.status !== 'rejected') {
    throw new Error(`Unexpected rejected payment batch workflow status: ${rejectedPaymentBatch.history.status}`);
  }
  const paymentBatchesAfterBatchRejection = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('待提交审批')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterBatchRejection = paymentBatchesAfterBatchRejection.find(
    (item) => item.paymentBatchNo === paymentBatchNo,
  );
  if (!paymentBatchAfterBatchRejection || paymentBatchAfterBatchRejection.batchStatus !== '待提交审批') {
    throw new Error('Java payment batch did not return to pending submission after rejection');
  }

  const resubmittedPaymentBatch = await requestJson(
    `/api/v1/buyer/payment-batches/${encodeURIComponent(paymentBatchNo)}/status`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        batchStatus: '审批中',
        formData: workflowFormData.payment_batch,
      }),
    },
  );
  if (resubmittedPaymentBatch.batchStatus !== '审批中') {
    throw new Error(`Java payment batch did not resubmit after rejection: ${resubmittedPaymentBatch.batchStatus}`);
  }

  const paymentBatchApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'payment_batch',
    paymentBatchNo,
    'Java smoke 付款批次通过',
  );
  if (paymentBatchApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java payment batch workflow status: ${paymentBatchApproval.history.status}`);
  }
  const paymentBatchesAfterBatchApproval = await requestJson(
    `/api/v1/buyer/payment-batches?batchStatus=${encodeURIComponent('可安排付款')}`,
    { headers: authHeaders },
  );
  const paymentBatchAfterBatchApproval = paymentBatchesAfterBatchApproval.find(
    (item) => item.paymentBatchNo === paymentBatchNo,
  );
  if (!paymentBatchAfterBatchApproval || paymentBatchAfterBatchApproval.batchStatus !== '可安排付款') {
    throw new Error(`Unexpected Java payment batch approval passed status: ${paymentBatchAfterBatchApproval?.batchStatus}`);
  }
  const pendingPaymentBatchTasks = await requestJson('/api/v1/buyer/workflow/tasks', { headers: authHeaders });
  if (pendingPaymentBatchTasks.some((item) => item.businessType === 'payment_batch' && item.businessId === paymentBatchNo)) {
    throw new Error('Java smoke did not close the Flowable payment batch task');
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
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ formData: workflowFormData.contract_approval }),
  });
  if (submittedContractApproval.status !== '审批中') {
    throw new Error(`Unexpected Java smoke contract approval submitted status: ${submittedContractApproval.status}`);
  }

  const contractApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'contract_approval',
    smokeContractId,
    'Java smoke 合同审批通过',
  );
  if (contractApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java contract workflow status: ${contractApproval.history.status}`);
  }
  const contractsAfterApproval = await requestJson('/api/v1/buyer/contracts', { headers: authHeaders });
  const approvedContract = contractsAfterApproval.find((item) => item.id === smokeContractId);
  if (!approvedContract || approvedContract.status !== '已生效' || approvedContract.fulfillmentProgress !== '已生效') {
    throw new Error('Java smoke did not approve contract through the Flowable workflow');
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
      formData: workflowFormData.payment_archive_exception,
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

  const paymentArchiveExceptionApproval = await completeWorkflowBusinessTask(
    authHeaders,
    'payment_archive_exception',
    paymentArchiveExceptionRequest.id,
    'Java smoke 付款归档例外通过',
  );
  if (paymentArchiveExceptionApproval.history.status !== 'approved') {
    throw new Error(`Unexpected Java payment archive exception workflow status: ${paymentArchiveExceptionApproval.history.status}`);
  }
  const approvedPaymentArchiveExceptionRequests = await requestJson(
    `/api/v1/buyer/payment-archive-exception-requests?paymentBatchNo=${encodeURIComponent(paymentBatchNo)}`,
    { headers: authHeaders },
  );
  const approvedPaymentArchiveExceptionRequest = approvedPaymentArchiveExceptionRequests.find(
    (item) => item.id === paymentArchiveExceptionRequest.id,
  );
  if (approvedPaymentArchiveExceptionRequest?.approvalStatus !== '已通过') {
    throw new Error('Java smoke did not apply payment archive exception workflow approval');
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
  if (platformLogin) {
    console.log(`Logged in as ${platformLogin.displayName} for platform scope`);
  } else {
    console.log('Skipped platform API smoke by JAVA_SKIP_PLATFORM_SMOKE=1');
  }
  console.log(`Logged in as ${buyerLogin.displayName} for tenant ${buyerLogin.tenantId}`);
  if (platformLogin) {
    console.log(`Loaded ${platformTenants.length} tenants, ${platformOverview.publicSupplierCount} public suppliers, ${platformEnterpriseReviews.length} pending enterprise reviews`);
    console.log(`Loaded platform workspace aggregate with ${platformWorkspace.tenants.length} tenants and ${platformWorkspace.enterpriseReviews.length} pending enterprise reviews`);
    console.log(`Confirmed finance feature for tenant ${buyerLogin.tenantId}`);
  }
  console.log(`Loaded ${suppliers.length} suppliers, ${materials.length} materials, ${departments.length} departments, ${users.length} buyer users`);
  console.log(`Loaded buyer workspace aggregate with ${buyerWorkspace.suppliers.length} suppliers and ${buyerWorkspace.auditLogs.length} audit logs`);
  if (admittedRelation && admissionApproval) {
    console.log(`Completed Flowable supplier admission task ${admissionApproval.task.taskId}; relation ${admittedRelation.id} status is ${admittedRelation.status}`);
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
  console.log(`Verified Flowable rejection and resubmission for payment request ${paymentRequest.id} and batch ${paymentBatchNo}`);
  console.log(`Created payment request ${paymentRequest.id}, batch ${paymentBatchNo}, batch status ${paymentBatchAfterApproval.batchStatus}`);
  console.log(`Created payment block resolution ${paymentBlockResolution.id}, status ${updatedPaymentBlockResolution.resolutionStatus}`);
  console.log(`Loaded payment block resolutions ${paymentBlockResolutions.length} for batch ${paymentBatchNo}`);
  console.log(`Completed Flowable payment batch task ${paymentBatchApproval.task.taskId} for ${paymentBatchNo}, batch status ${paymentBatchAfterBatchApproval.batchStatus}`);
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
