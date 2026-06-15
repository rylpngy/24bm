import { describe, expect, it } from 'vitest';
import { apiModules, buildOpenApiDraft, databaseTables, mvpFlowEndpoints, serializeOpenApiDraft } from './apiContract';

describe('procurement SaaS API contract draft', () => {
  it('groups APIs by platform, buyer, supplier, and shared modules', () => {
    expect(apiModules.map((module) => module.key)).toEqual(['platform', 'buyer', 'supplier', 'shared']);
    expect(apiModules.find((module) => module.key === 'buyer')?.resources).toContain('PurchaseDemand');
    expect(apiModules.find((module) => module.key === 'supplier')?.resources).toContain('Quote');
  });

  it('defines the first-phase inquiry-to-payment flow endpoints in order', () => {
    expect(mvpFlowEndpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
      'POST /auth/login',
      'GET /dictionaries',
      'GET /platform/workspace',
      'GET /platform/overview',
      'GET /platform/tenants',
      'GET /platform/tenants/{tenantId}',
      'POST /platform/tenants',
      'POST /platform/tenants/{tenantId}/features',
      'POST /platform/tenants/{tenantId}/plan',
      'POST /platform/tenants/{tenantId}/enable',
      'POST /platform/tenants/{tenantId}/disable',
      'GET /platform/enterprise-reviews',
      'POST /platform/enterprise-reviews/{enterpriseId}',
      'GET /platform/announcements',
      'POST /platform/announcements',
      'GET /buyer/workspace',
      'GET /buyer/announcements',
      'GET /buyer/suppliers',
      'POST /buyer/suppliers',
      'POST /buyer/suppliers/{relationId}/submit',
      'POST /buyer/suppliers/{relationId}/approval',
      'POST /buyer/suppliers/{relationId}/status',
      'POST /buyer/suppliers/{relationId}/profile',
      'POST /buyer/suppliers/{relationId}/performance',
      'GET /buyer/materials',
      'POST /buyer/materials',
      'POST /buyer/materials/{materialId}',
      'GET /buyer/departments',
      'POST /buyer/departments',
      'POST /buyer/departments/{departmentId}/disable',
      'GET /buyer/roles',
      'GET /buyer/users',
      'POST /buyer/users',
      'POST /buyer/users/{userId}/role',
      'POST /buyer/users/{userId}/password',
      'POST /buyer/users/{userId}/status',
      'GET /buyer/demands',
      'POST /buyer/demands',
      'POST /buyer/demands/{demandId}/submit',
      'POST /buyer/demands/{demandId}/approval',
      'GET /buyer/approvals/pending',
      'GET /buyer/approvals/templates',
      'POST /buyer/approvals/templates/{templateCode}/config',
      'GET /buyer/audit-logs',
      'GET /buyer/attachments',
      'POST /buyer/attachments',
      'GET /buyer/notifications',
      'POST /buyer/notifications/{notificationId}/read',
      'GET /supplier/notifications',
      'POST /supplier/notifications/{notificationId}/read',
      'GET /buyer/rfqs',
      'POST /buyer/rfqs',
      'GET /supplier/workspace',
      'GET /supplier/announcements',
      'GET /supplier/profile',
      'POST /supplier/profile',
      'GET /supplier/qualifications',
      'POST /supplier/qualifications',
      'POST /supplier/qualifications/{qualificationId}/status',
      'GET /supplier/users',
      'POST /supplier/users',
      'POST /supplier/users/{userId}/password',
      'POST /supplier/users/{userId}/status',
      'GET /supplier/rfqs',
      'POST /supplier/rfqs/{rfqId}/quotes',
      'POST /buyer/rfqs/{rfqId}/award',
      'POST /buyer/rfqs/{rfqId}/award/approval',
      'GET /buyer/orders',
      'POST /buyer/orders',
      'GET /supplier/orders',
      'POST /supplier/orders/{orderId}/confirm',
      'POST /supplier/orders/{orderId}/deliveries',
      'GET /supplier/deliveries',
      'GET /buyer/receipts',
      'POST /buyer/orders/{orderId}/receipts',
      'GET /buyer/invoices',
      'GET /supplier/quotes',
      'GET /supplier/invoices',
      'GET /supplier/invoices/{invoiceId}/payment-audit-logs',
      'POST /supplier/orders/{orderId}/invoices',
      'POST /buyer/invoices/{invoiceId}/payments',
      'GET /buyer/invoices/{invoiceId}/payment-audit-logs',
    ]);
  });

  it('declares tenant-scoped database tables and public supplier identity tables', () => {
    expect(databaseTables.find((table) => table.name === 'supplier_enterprises')?.tenantScoped).toBe(false);
    expect(databaseTables.find((table) => table.name === 'dictionaries')?.tenantScoped).toBe(false);
    expect(databaseTables.find((table) => table.name === 'dictionaries')?.requiredColumns).toContain('sort_order');
    expect(databaseTables.find((table) => table.name === 'platform_announcements')?.tenantScoped).toBe(false);
    expect(databaseTables.find((table) => table.name === 'platform_announcements')?.requiredColumns).toContain('audience');
    expect(databaseTables.find((table) => table.name === 'supplier_qualifications')?.tenantScoped).toBe(false);
    expect(databaseTables.find((table) => table.name === 'supplier_qualifications')?.requiredColumns).toContain('supplier_id');
    expect(databaseTables.find((table) => table.name === 'buyer_supplier_relations')?.tenantScoped).toBe(true);
    expect(databaseTables.find((table) => table.name === 'users')?.requiredColumns).toContain('department_id');
    expect(databaseTables.find((table) => table.name === 'user_roles')?.requiredColumns).toEqual(
      expect.arrayContaining(['user_id', 'role_id']),
    );
    expect(databaseTables.find((table) => table.name === 'approval_templates')?.requiredColumns).toEqual(
      expect.arrayContaining(['template_code', 'tenant_id', 'default_approver_role_id']),
    );
    expect(databaseTables.find((table) => table.name === 'rfqs')?.requiredColumns).toEqual(
      expect.arrayContaining(['tenant_id', 'status', 'deadline_at']),
    );
  });

  it('builds an OpenAPI draft with tenant and supplier isolation parameters', () => {
    const openApi = buildOpenApiDraft();

    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.info.title).toBe('24Bid Multi-tenant Procurement API');
    expect(openApi.paths['/dictionaries'].get.tags).toContain('shared');
    expect(openApi.paths['/platform/overview'].get.tags).toContain('platform');
    expect(openApi.paths['/platform/announcements'].post.tags).toContain('platform');
    expect(openApi.paths['/buyer/approvals/pending'].get.tags).toContain('buyer');
    expect(openApi.paths['/buyer/approvals/templates/{templateCode}/config'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/departments'].get.tags).toContain('buyer');
    expect(openApi.paths['/buyer/departments'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/departments/{departmentId}/disable'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'departmentId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/suppliers'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'level', in: 'query', required: false }),
        expect.objectContaining({ name: 'category', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/materials'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'category', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/users'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'departmentId', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/demands'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'departmentId', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/audit-logs'].get.tags).toContain('buyer');
    expect(openApi.paths['/buyer/attachments'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/notifications'].get.tags).toContain('buyer');
    expect(openApi.paths['/buyer/notifications/{notificationId}/read'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'notificationId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/supplier/notifications'].get.tags).toContain('supplier');
    expect(openApi.paths['/supplier/notifications/{notificationId}/read'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'notificationId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/rfqs/{rfqId}/award'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/rfqs'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/rfqs/{rfqId}/award/approval'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'rfqId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/supplier/qualifications'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/users'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/rfqs'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'keyword', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/quotes'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'rfqId', in: 'query', required: false }),
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/orders'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'supplierId', in: 'query', required: false }),
        expect.objectContaining({ name: 'rfqId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/orders'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'rfqId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/deliveries'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'orderId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/receipts'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'orderId', in: 'query', required: false }),
        expect.objectContaining({ name: 'receiverId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/invoices'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'paymentStatus', in: 'query', required: false }),
        expect.objectContaining({ name: 'supplierId', in: 'query', required: false }),
        expect.objectContaining({ name: 'orderId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/invoices'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'paymentStatus', in: 'query', required: false }),
        expect.objectContaining({ name: 'orderId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/supplier/invoices/{invoiceId}/payment-audit-logs'].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'invoiceId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/supplier/orders/{orderId}/invoices'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'orderId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/supplier/orders/{orderId}/confirm'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'orderId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/invoices/{invoiceId}/payment-audit-logs'].get.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'invoiceId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/demands'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(openApi.paths['/supplier/rfqs/{rfqId}/quotes'].post.security).toEqual([{ bearerAuth: [] }]);
  });

  it('serializes the OpenAPI draft as stable pretty JSON', () => {
    const json = serializeOpenApiDraft();

    expect(json).toContain('"openapi": "3.1.0"');
    expect(json).toContain('"GET /dictionaries"');
    expect(json).toContain('"POST /buyer/demands"');
    expect(json).toContain('"GET /buyer/approvals/pending"');
    expect(json).toContain('"GET /buyer/audit-logs"');
    expect(json).toContain('"GET /buyer/departments"');
    expect(json).toContain('"POST /buyer/departments"');
    expect(json).toContain('"POST /buyer/departments/{departmentId}/disable"');
    expect(json).toContain('"POST /supplier/orders/{orderId}/confirm"');
    expect(JSON.parse(json).paths['/buyer/orders'].post.summary).toBe('根据定标结果生成采购订单');
  });
});
