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
      'PUT /platform/announcements/{announcementId}',
      'POST /platform/announcements/{announcementId}/withdraw',
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
      'PUT /buyer/demands/{demandId}',
      'POST /buyer/demands/{demandId}/submit',
      'POST /buyer/demands/{demandId}/approval',
      'GET /buyer/approvals/pending',
      'GET /buyer/approvals/recent',
      'GET /buyer/approvals/templates',
      'POST /buyer/approvals/templates/{templateCode}/config',
      'GET /buyer/audit-logs',
      'GET /buyer/attachments',
      'POST /buyer/attachments',
      'POST /buyer/attachments/upload-ticket',
      'POST /buyer/attachments/{attachmentId}/download-link',
      'GET /buyer/notifications',
      'POST /buyer/notifications/{notificationId}/read',
      'GET /supplier/notifications',
      'POST /supplier/notifications/{notificationId}/read',
      'GET /buyer/rfqs',
      'POST /buyer/rfqs',
      'PUT /buyer/rfqs/{rfqId}',
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
      'PUT /supplier/quotes/{quoteId}',
      'POST /buyer/rfqs/{rfqId}/award',
      'POST /buyer/rfqs/{rfqId}/award/approval',
      'GET /buyer/orders',
      'POST /buyer/orders',
      'PUT /buyer/orders/{orderId}',
      'GET /buyer/contracts',
      'POST /buyer/contracts',
      'PUT /buyer/contracts/{contractId}',
      'PUT /buyer/contracts/{contractId}/status',
      'PUT /buyer/contracts/{contractId}/archive-status',
      'POST /buyer/contracts/{contractId}/approval',
      'PUT /buyer/contracts/{contractId}/approval-review',
      'GET /supplier/orders',
      'POST /supplier/orders/{orderId}/confirm',
      'POST /supplier/orders/{orderId}/deliveries',
      'GET /supplier/deliveries',
      'PUT /supplier/deliveries/{deliveryId}',
      'GET /buyer/receipts',
      'POST /buyer/orders/{orderId}/receipts',
      'GET /buyer/invoices',
      'GET /buyer/invoice-reconciliations',
      'GET /buyer/payment-requests',
      'GET /buyer/payment-batches',
      'GET /buyer/payment-execution-records',
      'POST /buyer/payment-execution-records/{executionRecordId}/registration',
      'GET /buyer/payment-block-resolutions',
      'GET /buyer/payment-archive-exception-requests',
      'POST /buyer/payment-archive-exception-requests',
      'POST /buyer/payment-archive-exception-requests/{requestId}/approval',
      'POST /buyer/payment-archive-exception-requests/{requestId}/controlled-action',
      'POST /buyer/payment-archive-exception-requests/{requestId}/closure',
      'POST /buyer/payment-block-resolutions',
      'PUT /buyer/payment-block-resolutions/{resolutionId}/status',
      'PUT /buyer/payment-batches/{paymentBatchNo}/status',
      'GET /buyer/three-way-matches',
      'POST /buyer/three-way-matches/rebuild',
      'POST /buyer/three-way-matches/{matchId}/variance-handling',
      'POST /buyer/payment-requests',
      'PUT /buyer/payment-requests/{paymentRequestId}/status',
      'GET /buyer/variance-handlings',
      'POST /buyer/variance-handlings',
      'PUT /buyer/variance-handlings/{varianceHandlingId}/status',
      'PUT /buyer/invoices/{invoiceId}',
      'GET /supplier/quotes',
      'GET /supplier/invoices',
      'GET /supplier/invoice-reconciliations',
      'GET /supplier/invoices/{invoiceId}/payment-audit-logs',
      'PUT /supplier/invoices/{invoiceId}/reconciliation',
      'POST /supplier/orders/{orderId}/invoices',
      'POST /buyer/invoices/{invoiceId}/payments',
      'GET /buyer/invoices/{invoiceId}/payment-audit-logs',
    ]);
  });

  it('declares tenant-scoped database tables and public supplier identity tables', () => {
    expect(databaseTables.find((table) => table.name === 'supplier_enterprises')?.tenantScoped).toBe(false);
    expect(databaseTables.find((table) => table.name === 'supplier_enterprises')?.requiredColumns).toEqual(
      expect.arrayContaining(['review_comment', 'profile_confirmed', 'risk_confirmed']),
    );
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
    expect(databaseTables.find((table) => table.name === 'contracts')?.tenantScoped).toBe(true);
    expect(databaseTables.find((table) => table.name === 'contracts')?.requiredColumns).toEqual(
      expect.arrayContaining(['tenant_id', 'contract_no', 'related_order_id', 'archive_status']),
    );
    expect(databaseTables.find((table) => table.name === 'invoice_reconciliations')?.tenantScoped).toBe(true);
    expect(databaseTables.find((table) => table.name === 'invoice_reconciliations')?.requiredColumns).toEqual(
      expect.arrayContaining(['tenant_id', 'invoice_id', 'supplier_id', 'order_id', 'stage', 'next_action']),
    );
  });

  it('builds an OpenAPI draft with tenant and supplier isolation parameters', () => {
    const openApi = buildOpenApiDraft();

    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.info.title).toBe('24Bid Multi-tenant Procurement API');
    expect(openApi.paths['/dictionaries'].get.tags).toContain('shared');
    expect(openApi.paths['/platform/overview'].get.tags).toContain('platform');
    expect(openApi.paths['/platform/announcements'].post.tags).toContain('platform');
    expect(openApi.paths['/platform/announcements/{announcementId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'announcementId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/platform/announcements/{announcementId}/withdraw'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'announcementId', in: 'path', required: true })]),
    );
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
    expect(openApi.paths['/buyer/demands/{demandId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'demandId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/audit-logs'].get.tags).toContain('buyer');
    expect(openApi.paths['/buyer/attachments'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/attachments/upload-ticket'].post.tags).toContain('buyer');
    expect(openApi.paths['/buyer/attachments/{attachmentId}/download-link'].post.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'attachmentId', in: 'path', required: true })]),
    );
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
    expect(openApi.paths['/buyer/rfqs/{rfqId}'].put.parameters).toEqual(
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
    expect(openApi.paths['/supplier/quotes/{quoteId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'quoteId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/orders'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'supplierId', in: 'query', required: false }),
        expect.objectContaining({ name: 'rfqId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/orders/{orderId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'orderId', in: 'path', required: true })]),
    );
    expect(openApi.paths['/buyer/contracts'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'status', in: 'query', required: false }),
        expect.objectContaining({ name: 'archiveStatus', in: 'query', required: false }),
        expect.objectContaining({ name: 'supplierId', in: 'query', required: false }),
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
    expect(openApi.paths['/supplier/deliveries/{deliveryId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'deliveryId', in: 'path', required: true })]),
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
    expect(openApi.paths['/buyer/invoice-reconciliations'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'stage', in: 'query', required: false }),
        expect.objectContaining({ name: 'supplierId', in: 'query', required: false }),
        expect.objectContaining({ name: 'orderId', in: 'query', required: false }),
      ]),
    );
    expect(openApi.paths['/buyer/payment-execution-records'].get.summary).toContain('执行阶段');
    expect(openApi.paths['/buyer/payment-execution-records'].get.summary).toContain('下一处理动作');
    expect(openApi.paths['/buyer/invoices/{invoiceId}'].put.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'invoiceId', in: 'path', required: true })]),
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
    expect(openApi.paths['/supplier/invoices/{invoiceId}/reconciliation'].put.parameters).toEqual(
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
    expect(json).toContain('"PUT /platform/announcements/{announcementId}"');
    expect(json).toContain('"POST /platform/announcements/{announcementId}/withdraw"');
    expect(json).toContain('"POST /buyer/demands"');
    expect(json).toContain('"PUT /buyer/demands/{demandId}"');
    expect(json).toContain('"GET /buyer/approvals/pending"');
    expect(json).toContain('"GET /buyer/approvals/recent"');
    expect(json).toContain('"GET /buyer/audit-logs"');
    expect(json).toContain('"GET /buyer/departments"');
    expect(json).toContain('"POST /buyer/departments"');
    expect(json).toContain('"POST /buyer/departments/{departmentId}/disable"');
    expect(json).toContain('"PUT /buyer/rfqs/{rfqId}"');
    expect(json).toContain('"PUT /buyer/orders/{orderId}"');
    expect(json).toContain('"GET /buyer/contracts"');
    expect(json).toContain('"PUT /buyer/invoices/{invoiceId}"');
    expect(json).toContain('"POST /supplier/orders/{orderId}/confirm"');
    expect(JSON.parse(json).paths['/buyer/orders'].post.summary).toBe('根据定标结果生成采购订单');
  });
});
