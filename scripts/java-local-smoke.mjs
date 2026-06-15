const baseUrl = process.env.JAVA_API_BASE_URL ?? 'http://localhost:8080';

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

const requireItem = (items, predicate, label) => {
  const found = items.some(predicate);
  if (!found) {
    throw new Error(`Missing expected Java local seed data: ${label}`);
  }
};

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
      account: process.env.JAVA_PLATFORM_ACCOUNT ?? 'platform',
      password: process.env.JAVA_PLATFORM_PASSWORD ?? 'demo123456',
      scope: 'PLATFORM',
    }),
  });

  const buyerLogin = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_BUYER_ACCOUNT ?? 'buyer',
      password: process.env.JAVA_BUYER_PASSWORD ?? 'demo123456',
      scope: 'BUYER',
      tenantId: process.env.JAVA_BUYER_TENANT_ID ?? 'tenant-acme',
    }),
  });

  const supplierLogin = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: process.env.JAVA_SUPPLIER_ACCOUNT ?? 'supplier',
      password: process.env.JAVA_SUPPLIER_PASSWORD ?? 'demo123456',
      scope: 'SUPPLIER',
      supplierId: process.env.JAVA_SUPPLIER_ID ?? 'ent-supplier-sunrise',
    }),
  });

  const platformHeaders = { Authorization: `${platformLogin.tokenType} ${platformLogin.accessToken}` };
  const authHeaders = { Authorization: `${buyerLogin.tokenType} ${buyerLogin.accessToken}` };
  const supplierHeaders = { Authorization: `${supplierLogin.tokenType} ${supplierLogin.accessToken}` };
  const [platformOverview, platformTenants, platformEnterpriseReviews] = await Promise.all([
    requestJson('/api/v1/platform/overview', { headers: platformHeaders }),
    requestJson('/api/v1/platform/tenants', { headers: platformHeaders }),
    requestJson('/api/v1/platform/enterprise-reviews', { headers: platformHeaders }),
  ]);
  const [buyerWorkspace, suppliers, materials, users, demands, orders, invoices, auditLogs] = await Promise.all([
    requestJson('/api/v1/buyer/workspace', { headers: authHeaders }),
    requestJson('/api/v1/buyer/suppliers', { headers: authHeaders }),
    requestJson('/api/v1/buyer/materials', { headers: authHeaders }),
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
  requireItem(users, (item) => item.id === 'user-buyer-owner', 'user-buyer-owner');
  requireItem(demands, (item) => item.id === 'dem-local-laptop', 'dem-local-laptop');
  requireItem(platformTenants, (item) => item.id === 'tenant-acme', 'tenant-acme');
  if (platformOverview.scope !== 'platform') {
    throw new Error(`Unexpected Java platform overview scope: ${platformOverview.scope}`);
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

  const rfq = await requestJson('/api/v1/buyer/rfqs', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `本地联调 RFQ ${Date.now()}`,
      demandIds: ['dem-local-laptop'],
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

  const order = await requestJson('/api/v1/buyer/orders', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      awardId: award.id,
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

  const paidInvoice = await requestJson(`/api/v1/buyer/invoices/${invoice.id}/payments`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      paymentStatus: '已付款',
    }),
  });

  console.log(`Java local API smoke passed at ${baseUrl}`);
  console.log(`Logged in as ${platformLogin.displayName} for platform scope`);
  console.log(`Logged in as ${buyerLogin.displayName} for tenant ${buyerLogin.tenantId}`);
  console.log(`Loaded ${platformTenants.length} tenants, ${platformOverview.publicSupplierCount} public suppliers, ${platformEnterpriseReviews.length} pending enterprise reviews`);
  console.log(`Loaded ${suppliers.length} suppliers, ${materials.length} materials, ${users.length} buyer users`);
  console.log(`Loaded buyer workspace aggregate with ${buyerWorkspace.suppliers.length} suppliers and ${buyerWorkspace.auditLogs.length} audit logs`);
  console.log(`Loaded ${demands.length} purchase demands`);
  console.log(`Loaded ${orders.length} purchase orders, ${invoices.length} invoices, ${auditLogs.length} audit logs`);
  console.log(`Loaded supplier ${supplierProfile.name}, ${supplierRfqs.length} RFQs, ${supplierQuotes.length} quotes, ${supplierOrders.length} orders, ${supplierInvoices.length} invoices`);
  console.log(`Loaded supplier workspace aggregate with ${supplierWorkspace.opportunities.length} opportunities and ${supplierWorkspace.orders.length} orders`);
  console.log(`Created RFQ ${rfq.id}, quote ${quote.id}, award ${award.id}, order ${order.id}, confirmed status ${confirmedOrder.status}`);
  console.log(`Created delivery ${delivery.id}, receipt ${receipt.id}`);
  console.log(`Created invoice ${invoice.id}, payment status ${paidInvoice.paymentStatus}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
