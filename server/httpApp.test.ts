import { describe, expect, it } from 'vitest';
import { createBackendContext } from './procurementBackend';
import { createHttpApp } from './httpApp';

const jsonRequest = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...headers,
  },
  body: JSON.stringify(body),
});

describe('HTTP API layer', () => {
  it('exposes a versioned health endpoint', async () => {
    const app = createHttpApp(createBackendContext());
    const response = await app.request('/api/v1/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', version: 'v1' });
  });

  it('allows browser CORS requests from the frontend dev server', async () => {
    const app = createHttpApp(createBackendContext());
    const response = await app.request('/api/v1/buyer/workspace', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Tenant-Id,X-User-Id',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3001');
  });

  it('requires tenant and user headers for buyer endpoints', async () => {
    const app = createHttpApp(createBackendContext());
    const response = await app.request(
      '/api/v1/buyer/demands',
      jsonRequest({
        title: '缺少租户头',
        department: '行政部',
        requester: '测试用户',
        budget: 1000,
        lineItems: [{ materialId: 'mat-acme-1', quantity: 1 }],
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.name).toBe('ForbiddenError');
  });

  it('returns platform, buyer, and supplier workspace payloads', async () => {
    const app = createHttpApp(createBackendContext());
    const platformResponse = await app.request('/api/v1/platform/workspace', {
      headers: { 'X-User-Id': 'u-platform' },
    });
    const buyerResponse = await app.request('/api/v1/buyer/workspace', {
      headers: { 'X-Tenant-Id': 'tenant-acme', 'X-User-Id': 'u-acme-admin' },
    });
    const supplierResponse = await app.request('/api/v1/supplier/workspace', {
      headers: { 'X-Supplier-Id': 'supplier-orbit', 'X-User-Id': 'u-orbit-sales' },
    });
    const platform = await platformResponse.json();
    const buyer = await buyerResponse.json();
    const supplier = await supplierResponse.json();

    expect(platformResponse.status).toBe(200);
    expect(platform.data.tenants.map((tenant: { id: string }) => tenant.id)).toContain('tenant-acme');
    expect(buyerResponse.status).toBe(200);
    expect(buyer.data.workspace.tenant.id).toBe('tenant-acme');
    expect(buyer.data.kpis.totalSpend).toBe(286000);
    expect(supplierResponse.status).toBe(200);
    expect(supplier.data.supplier.id).toBe('supplier-orbit');
    expect(supplier.data.connectedBuyerNames).toEqual(['星河制造集团', '诺瓦科技']);
  });

  it('creates and lists buyer demands in tenant scope', async () => {
    const app = createHttpApp(createBackendContext());
    const buyerHeaders = { 'X-Tenant-Id': 'tenant-acme', 'X-User-Id': 'u-acme-admin' };
    const createResponse = await app.request(
      '/api/v1/buyer/demands',
      jsonRequest(
        {
          title: 'HTTP API 采购需求',
          department: '行政部',
          requester: '接口测试',
          budget: 88000,
          lineItems: [{ materialId: 'mat-acme-1', quantity: 2 }],
        },
        buyerHeaders,
      ),
    );
    const created = await createResponse.json();
    const listResponse = await app.request('/api/v1/buyer/demands', { headers: buyerHeaders });
    const list = await listResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.data.tenantId).toBe('tenant-acme');
    expect(list.data.some((item: { id: string }) => item.id === created.data.id)).toBe(true);
  });

  it('runs the RFQ quote award order flow over HTTP', async () => {
    const app = createHttpApp(createBackendContext());
    const buyerHeaders = { 'X-Tenant-Id': 'tenant-acme', 'X-User-Id': 'u-acme-admin' };
    const supplierHeaders = { 'X-Supplier-Id': 'supplier-orbit', 'X-User-Id': 'u-orbit-sales' };

    const rfqResponse = await app.request(
      '/api/v1/buyer/rfqs',
      jsonRequest(
        {
          title: 'HTTP API 询价',
          demandIds: ['dem-acme-1'],
          invitedSupplierIds: ['supplier-orbit'],
          deadline: '2026-08-12',
        },
        buyerHeaders,
      ),
    );
    const rfq = await rfqResponse.json();

    const quoteResponse = await app.request(
      `/api/v1/supplier/rfqs/${rfq.data.id}/quotes`,
      jsonRequest({ amount: 177000, taxRate: 13, deliveryDays: 7 }, supplierHeaders),
    );
    const quote = await quoteResponse.json();

    const awardResponse = await app.request(
      `/api/v1/buyer/rfqs/${rfq.data.id}/award`,
      jsonRequest({ quoteId: quote.data.id, reason: 'HTTP API 报价最优' }, buyerHeaders),
    );
    const award = await awardResponse.json();

    const orderResponse = await app.request(
      '/api/v1/buyer/orders',
      jsonRequest({ awardId: award.data.id, expectedReceiptDate: '2026-08-30' }, buyerHeaders),
    );
    const order = await orderResponse.json();

    expect(rfqResponse.status).toBe(201);
    expect(quoteResponse.status).toBe(201);
    expect(awardResponse.status).toBe(201);
    expect(orderResponse.status).toBe(201);
    expect(order.data.status).toBe('待供应商确认');
    expect(order.data.amount).toBe(177000);
  });

  it('maps supplier isolation violations to 403 responses', async () => {
    const app = createHttpApp(createBackendContext());
    const buyerHeaders = { 'X-Tenant-Id': 'tenant-acme', 'X-User-Id': 'u-acme-admin' };
    const uninvitedSupplierHeaders = { 'X-Supplier-Id': 'supplier-lumen', 'X-User-Id': 'u-lumen-sales' };
    const rfqResponse = await app.request(
      '/api/v1/buyer/rfqs',
      jsonRequest(
        {
          title: 'HTTP API 定向询价',
          demandIds: ['dem-acme-1'],
          invitedSupplierIds: ['supplier-orbit'],
          deadline: '2026-08-12',
        },
        buyerHeaders,
      ),
    );
    const rfq = await rfqResponse.json();

    const quoteResponse = await app.request(
      `/api/v1/supplier/rfqs/${rfq.data.id}/quotes`,
      jsonRequest({ amount: 170000, taxRate: 13, deliveryDays: 9 }, uninvitedSupplierHeaders),
    );
    const payload = await quoteResponse.json();

    expect(quoteResponse.status).toBe(403);
    expect(payload.error.name).toBe('ForbiddenError');
  });
});
