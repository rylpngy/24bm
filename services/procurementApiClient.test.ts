import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../server/httpApp';
import { createBackendContext } from '../server/procurementBackend';
import {
  applyJavaBuyerMasterData,
  applyJavaPlatformWorkspaceData,
  applyJavaSupplierWorkspaceData,
  createHttpApiClient,
  createJavaProcurementApiClient,
  loadJavaBuyerMasterData,
  loadJavaPlatformWorkspaceData,
  loadJavaSupplierWorkspaceData,
  mockApiClient,
  resolveAppRuntimeDataSource,
  runJavaMvpWorkflow,
} from './procurementApiClient';

describe('procurement API clients', () => {
  it('requires the Java API as the default runtime data source unless mock mode is explicit', () => {
    expect(resolveAppRuntimeDataSource({ VITE_JAVA_API_BASE_URL: 'http://localhost:8080' })).toEqual({
      mode: 'java',
      javaApiBaseUrl: 'http://localhost:8080',
    });
    expect(resolveAppRuntimeDataSource({ VITE_DATA_SOURCE: 'mock' })).toEqual({ mode: 'mock' });
    expect(resolveAppRuntimeDataSource({})).toEqual({
      mode: 'misconfigured',
      message: 'VITE_JAVA_API_BASE_URL is required unless VITE_DATA_SOURCE=mock is set.',
    });
  });

  it('loads platform, buyer, and supplier workspaces from the mock client', async () => {
    const platform = await mockApiClient.getPlatformWorkspace();
    const buyer = await mockApiClient.getBuyerWorkspace('tenant-acme');
    const supplier = await mockApiClient.getSupplierWorkspace('supplier-orbit');

    expect(platform.tenants.map((tenant) => tenant.id)).toContain('tenant-acme');
    expect(buyer.workspace.tenant.id).toBe('tenant-acme');
    expect(buyer.kpis.totalSpend).toBe(286000);
    expect(supplier.supplier.id).toBe('supplier-orbit');
    expect(supplier.connectedBuyerNames).toEqual(['星河制造集团', '诺瓦科技']);
  });

  it('uses the HTTP client to call scoped buyer endpoints', async () => {
    const app = createHttpApp(createBackendContext());
    const client = createHttpApiClient({
      fetcher: app.request,
      buyer: { tenantId: 'tenant-acme', userId: 'u-acme-admin' },
      supplier: { supplierId: 'supplier-orbit', userId: 'u-orbit-sales' },
    });

    const demand = await client.createDemand({
      title: 'Client API 采购需求',
      department: '行政部',
      requester: '客户端测试',
      budget: 66000,
      lineItems: [{ materialId: 'mat-acme-1', quantity: 2 }],
    });
    const demands = await client.listDemands();

    expect(demand.tenantId).toBe('tenant-acme');
    expect(demands.some((item) => item.id === demand.id)).toBe(true);
  });

  it('uses the HTTP client to load platform, buyer, and supplier workspaces', async () => {
    const app = createHttpApp(createBackendContext());
    const client = createHttpApiClient({
      fetcher: app.request,
      buyer: { tenantId: 'tenant-acme', userId: 'u-acme-admin' },
      supplier: { supplierId: 'supplier-orbit', userId: 'u-orbit-sales' },
      platform: { userId: 'u-platform' },
    });

    const platform = await client.getPlatformWorkspace();
    const buyer = await client.getBuyerWorkspace('tenant-acme');
    const supplier = await client.getSupplierWorkspace('supplier-orbit');

    expect(platform.tenants.map((tenant) => tenant.id)).toContain('tenant-acme');
    expect(buyer.workspace.tenant.id).toBe('tenant-acme');
    expect(buyer.kpis.supplierCount).toBe(3);
    expect(supplier.supplier.id).toBe('supplier-orbit');
  });

  it('uses the HTTP client to run RFQ quote award order actions', async () => {
    const app = createHttpApp(createBackendContext());
    const client = createHttpApiClient({
      fetcher: app.request,
      buyer: { tenantId: 'tenant-acme', userId: 'u-acme-admin' },
      supplier: { supplierId: 'supplier-orbit', userId: 'u-orbit-sales' },
    });

    const rfq = await client.createRfq({
      title: 'Client API 询价',
      demandIds: ['dem-acme-1'],
      invitedSupplierIds: ['supplier-orbit'],
      deadline: '2026-09-20',
    });
    const quote = await client.submitQuote(rfq.id, { amount: 155000, taxRate: 13, deliveryDays: 5 });
    const award = await client.awardRfq(rfq.id, { quoteId: quote.id, reason: '客户端报价最优' });
    const order = await client.createOrder({ awardId: award.id, expectedReceiptDate: '2026-10-01' });

    expect(order.amount).toBe(155000);
    expect(order.status).toBe('待供应商确认');
  });

  it('uses the Java API client to authenticate and load buyer master data with bearer tokens', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-buyer-owner',
            displayName: '采购负责人',
            scope: 'BUYER',
            tenantId: 'tenant-acme',
            supplierId: null,
            roles: ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'rel-sunrise',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            supplierName: '晨光供应商',
            status: '已准入',
            level: 'A',
            categories: ['办公设备'],
            performanceScore: 92.5,
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/materials') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'mat-laptop',
            tenantId: 'tenant-acme',
            code: 'IT-LAPTOP',
            name: '办公电脑',
            category: '办公设备',
            unit: '台',
            referencePrice: 6000,
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/departments') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        if (init?.method === 'POST') {
          expect(JSON.parse(init.body as string)).toEqual({
            name: '研发采购部',
            parentId: 'dept-it',
          });
          return Response.json({
            success: true,
            data: {
              id: 'dept-rd',
              tenantId: 'tenant-acme',
              name: '研发采购部',
              parentId: 'dept-it',
              status: 'active',
            },
            message: '',
          }, { status: 201 });
        }
        return Response.json({
          success: true,
          data: [{
            id: 'dept-it',
            tenantId: 'tenant-acme',
            name: '信息化部',
            parentId: null,
            status: 'active',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/departments/dept-old/disable') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(init?.method).toBe('POST');
        return Response.json({
          success: true,
          data: {
            id: 'dept-old',
            tenantId: 'tenant-acme',
            name: '历史部门',
            parentId: null,
            status: 'inactive',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/users') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'user-buyer-owner',
            tenantId: 'tenant-acme',
            name: '采购负责人',
            mobile: '13800000000',
            email: 'buyer@example.com',
            status: 'active',
            departmentId: 'dept-it',
            roleId: 'role-buyer-owner',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/roles') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'role-buyer-requester',
            tenantId: 'tenant-acme',
            name: '需求申请人',
            permissions: ['buyer:demand:create', 'buyer:demand:read'],
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/users/user-buyer-owner/role') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ roleId: 'role-buyer-requester' });
        return Response.json({
          success: true,
          data: {
            id: 'user-buyer-owner',
            tenantId: 'tenant-acme',
            name: '采购负责人',
            mobile: '13800000000',
            email: 'buyer@example.com',
            status: 'active',
            departmentId: 'dept-it',
            roleId: 'role-buyer-requester',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/users/user-buyer-owner/status') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ status: 'inactive' });
        return Response.json({
          success: true,
          data: {
            id: 'user-buyer-owner',
            tenantId: 'tenant-acme',
            name: '采购负责人',
            mobile: '13800000000',
            email: 'buyer@example.com',
            status: 'inactive',
            departmentId: 'dept-it',
            roleId: 'role-buyer-requester',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/orders') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'po-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-001',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            status: '已收货',
            expectedReceiptDate: '2026-07-10',
            createdAt: '2026-06-15T13:00:00+08:00',
            updatedAt: '2026-06-15T13:30:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/invoices') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'invoice-java-001',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            amount: 118000,
            invoiceNo: 'INV-2026-0001',
            paymentStatus: '已付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/audit-logs') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'audit-java-001',
            tenantId: 'tenant-acme',
            actorId: 'user-buyer-owner',
            action: 'purchase_order.created',
            targetType: 'purchase_order',
            targetId: 'po-java-001',
            createdAt: '2026-06-15T13:00:00+08:00',
          }],
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
    });

    const suppliers = await client.listBuyerSuppliers();
    const materials = await client.listBuyerMaterials();
    const departments = await client.listBuyerDepartments();
    const createdDepartment = await client.createBuyerDepartment({
      name: '研发采购部',
      parentId: 'dept-it',
    });
    const disabledDepartment = await client.disableBuyerDepartment('dept-old');
    const roles = await client.listBuyerRoles();
    const users = await client.listBuyerUsers();
    const changedUser = await client.changeBuyerUserRole('user-buyer-owner', 'role-buyer-requester');
    const disabledUser = await client.changeBuyerUserStatus('user-buyer-owner', 'inactive');
    const orders = await client.listBuyerOrders();
    const invoices = await client.listBuyerInvoices();
    const auditLogs = await client.listBuyerAuditLogs();

    expect(suppliers[0].supplierName).toBe('晨光供应商');
    expect(materials[0].code).toBe('IT-LAPTOP');
    expect(departments[0].name).toBe('信息化部');
    expect(createdDepartment.id).toBe('dept-rd');
    expect(disabledDepartment.status).toBe('inactive');
    expect(roles[0].permissions).toContain('buyer:demand:create');
    expect(users[0].email).toBe('buyer@example.com');
    expect(users[0].departmentId).toBe('dept-it');
    expect(users[0].roleId).toBe('role-buyer-owner');
    expect(changedUser.roleId).toBe('role-buyer-requester');
    expect(disabledUser.status).toBe('inactive');
    expect(orders[0].status).toBe('已收货');
    expect(invoices[0].paymentStatus).toBe('已付款');
    expect(auditLogs[0].action).toBe('purchase_order.created');
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(1);
  });

  it('loads Java buyer master data from the aggregated workspace endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-buyer-owner',
            displayName: '采购负责人',
            scope: 'BUYER',
            tenantId: 'tenant-acme',
            supplierId: null,
            roles: ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/workspace') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: {
            suppliers: [],
            materials: [],
            users: [],
            demands: [],
            rfqs: [{
              id: 'rfq-java-001',
              tenantId: 'tenant-acme',
              title: 'Java RFQ',
              status: '报价中',
              deadlineAt: '2026-07-01T18:00:00+08:00',
              ownerId: 'user-buyer-owner',
              awardedSupplierId: null,
              demandIds: ['dem-java-001'],
              invitedSupplierIds: ['ent-supplier-sunrise'],
              quotes: [{
                id: 'quote-java-001',
                tenantId: 'tenant-acme',
                rfqId: 'rfq-java-001',
                supplierId: 'ent-supplier-sunrise',
                amount: 118000,
                taxRate: 13,
                deliveryDays: 7,
                status: '已提交',
              }],
            }],
            orders: [],
            deliveries: [{
              id: 'delivery-java-001',
              tenantId: 'tenant-acme',
              supplierId: 'ent-supplier-sunrise',
              orderId: 'po-java-001',
              carrier: '顺丰速运',
              trackingNo: 'SF100001',
              status: '已发货',
              createdAt: '2026-06-15T14:00:00+08:00',
            }],
            invoices: [],
            pendingApprovals: [],
            recentApprovals: [{
              id: 'approval-reviewed',
              tenantId: 'tenant-acme',
              bizType: 'purchase_demand',
              bizId: 'demand-java-001',
              summaryTitle: 'Java 采购需求',
              status: '已通过',
              createdAt: '2026-06-15T11:00:00+08:00',
              actedAt: '2026-06-15T12:00:00+08:00',
            }],
            notifications: [{
              id: 'notice-approval-reviewed',
              tenantId: 'tenant-acme',
              recipientId: 'user-buyer-owner',
              title: '需求审批已通过',
              content: '采购 20 台电脑审批已通过',
              read: false,
              readAt: null,
              createdAt: '2026-06-15T12:01:00+08:00',
            }],
            auditLogs: [{
              id: 'audit-java-001',
              tenantId: 'tenant-acme',
              actorId: 'user-buyer-owner',
              action: 'purchase_order.created',
              targetType: 'purchase_order',
              targetId: 'po-java-001',
              createdAt: '2026-06-15T13:00:00+08:00',
            }],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/roles') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'role-buyer-owner',
            tenantId: 'tenant-acme',
            name: '采购负责人',
            permissions: ['buyer:approval:review'],
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/departments') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'dept-it',
            tenantId: 'tenant-acme',
            name: '信息化部',
            parentId: null,
            status: 'active',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/approvals/templates') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            templateCode: 'TPL_PURCHASE_DEMAND',
            bizType: 'purchase_demand',
            name: '需求审批',
            defaultApproverRoleId: 'role-buyer-owner',
            status: 'active',
          }],
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
    });

    const masterData = await loadJavaBuyerMasterData(client);

    expect(masterData.auditLogs[0].action).toBe('purchase_order.created');
    expect(masterData.departments?.[0].name).toBe('信息化部');
    expect(masterData.deliveries?.[0].trackingNo).toBe('SF100001');
    expect(masterData.rfqs[0].quotes[0]).toMatchObject({
      id: 'quote-java-001',
      amount: 118000,
      deliveryDays: 7,
    });
    expect(masterData.roles[0].id).toBe('role-buyer-owner');
    expect(masterData.recentApprovals[0].actedAt).toBe('2026-06-15T12:00:00+08:00');
    expect(masterData.notifications[0].title).toBe('需求审批已通过');
    expect(masterData.approvalTemplates[0].templateCode).toBe('TPL_PURCHASE_DEMAND');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/buyer/workspace',
      'http://java.test/api/v1/buyer/departments',
      'http://java.test/api/v1/buyer/roles',
      'http://java.test/api/v1/buyer/approvals/templates',
    ]);
  });

  it('uses the Java API client to authenticate and load platform workspace data from the aggregate endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'platform-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-platform-admin',
            displayName: '平台管理员',
            scope: 'PLATFORM',
            tenantId: null,
            supplierId: null,
            roles: ['PLATFORM_ADMIN'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/workspace') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer platform-token' });
        return Response.json({
          success: true,
          data: {
            overview: {
              scope: 'platform',
              tenantCount: 2,
              publicSupplierCount: 3,
              pendingEnterpriseReviews: 1,
            },
            tenants: [{
              id: 'tenant-acme',
              name: 'Acme 采购公司',
              plan: 'MVP',
              status: 'active',
              enabledFeatures: ['rfq', 'order', 'finance'],
              userLimit: 100,
            }],
            enterpriseReviews: [{
              id: 'ent-supplier-sunrise',
              name: '晨光科技供应商',
              type: 'supplier',
              verified: false,
              reviewStatus: 'pending',
            }],
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
      platformLogin: {
        account: 'platform',
        password: 'demo123456',
        scope: 'PLATFORM',
      },
    });

    const platformData = await loadJavaPlatformWorkspaceData(client);

    expect(platformData.overview.publicSupplierCount).toBe(3);
    expect(platformData.tenants[0].name).toBe('Acme 采购公司');
    expect(platformData.enterpriseReviews[0].reviewStatus).toBe('pending');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/platform/workspace',
    ]);
  });

  it('uses the Java API client to persist platform enterprise review decisions', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'platform-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-platform-admin',
            displayName: '平台管理员',
            scope: 'PLATFORM',
            tenantId: null,
            supplierId: null,
            roles: ['PLATFORM_ADMIN'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/enterprise-reviews/ent-supplier-sunrise') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          verified: true,
          reviewStatus: 'approved',
        });
        return Response.json({
          success: true,
          data: {
            id: 'ent-supplier-sunrise',
            name: '晨光科技供应商',
            type: 'supplier',
            verified: true,
            reviewStatus: 'approved',
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      platformLogin: {
        account: 'platform',
        password: 'demo123456',
        scope: 'PLATFORM',
      },
    });

    const review = await client.reviewPlatformEnterprise('ent-supplier-sunrise', {
      verified: true,
      reviewStatus: 'approved',
    });

    expect(review).toEqual({
      id: 'ent-supplier-sunrise',
      name: '晨光科技供应商',
      type: 'supplier',
      verified: true,
      reviewStatus: 'approved',
    });
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/platform/enterprise-reviews/ent-supplier-sunrise',
    ]);
  });

  it('uses the Java API client to persist platform tenant operations', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'platform-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-platform-admin',
            displayName: '平台管理员',
            scope: 'PLATFORM',
            tenantId: null,
            supplierId: null,
            roles: ['PLATFORM_ADMIN'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/tenants/tenant-acme/disable') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer platform-token' });
        return Response.json({
          success: true,
          data: {
            id: 'tenant-acme',
            name: 'Acme 采购公司',
            plan: 'MVP',
            status: 'inactive',
            enabledFeatures: ['rfq', 'order'],
            userLimit: 100,
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/tenants/tenant-acme/plan') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({ plan: 'pro', userLimit: 120 });
        return Response.json({
          success: true,
          data: {
            id: 'tenant-acme',
            name: 'Acme 采购公司',
            plan: 'pro',
            status: 'active',
            enabledFeatures: ['rfq', 'order'],
            userLimit: 120,
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/tenants/tenant-acme/features') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({ enabledFeatures: ['order', 'finance'] });
        return Response.json({
          success: true,
          data: {
            id: 'tenant-acme',
            name: 'Acme 采购公司',
            plan: 'pro',
            status: 'active',
            enabledFeatures: ['order', 'finance'],
            userLimit: 120,
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      platformLogin: {
        account: 'platform',
        password: 'demo123456',
        scope: 'PLATFORM',
      },
    });

    const disabledTenant = await client.disablePlatformTenant('tenant-acme');
    const upgradedTenant = await client.updatePlatformTenantPlan('tenant-acme', { plan: 'pro', userLimit: 120 });
    const featureTenant = await client.updatePlatformTenantFeatures('tenant-acme', {
      enabledFeatures: ['order', 'finance'],
    });

    expect(disabledTenant.status).toBe('inactive');
    expect(upgradedTenant.plan).toBe('pro');
    expect(featureTenant.enabledFeatures).toEqual(['order', 'finance']);
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/platform/tenants/tenant-acme/disable',
      'http://java.test/api/v1/platform/tenants/tenant-acme/plan',
      'http://java.test/api/v1/platform/tenants/tenant-acme/features',
    ]);
  });

  it('uses the Java API client to list and publish platform announcements', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'platform-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-platform-admin',
            displayName: '平台管理员',
            scope: 'PLATFORM',
            tenantId: null,
            supplierId: null,
            roles: ['PLATFORM_ADMIN'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/announcements' && init?.method !== 'POST') {
        return Response.json({
          success: true,
          data: [{
            id: 'announcement-001',
            title: '平台维护窗口通知',
            content: '本周五晚间进行例行维护。',
            audience: 'all',
            status: 'active',
            publishedBy: 'user-platform-admin',
            createdAt: '2026-06-19T08:00:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/announcements' && init?.method === 'POST') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          title: '采购规则更新',
          content: '平台公告：采购规则更新',
          audience: 'buyer',
        });
        return Response.json({
          success: true,
          data: {
            id: 'announcement-002',
            title: '采购规则更新',
            content: '平台公告：采购规则更新',
            audience: 'buyer',
            status: 'active',
            publishedBy: 'user-platform-admin',
            createdAt: '2026-06-19T08:30:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      platformLogin: {
        account: 'platform',
        password: 'demo123456',
        scope: 'PLATFORM',
      },
    });

    const announcements = await client.listPlatformAnnouncements();
    const published = await client.publishPlatformAnnouncement({
      title: '采购规则更新',
      content: '平台公告：采购规则更新',
      audience: 'buyer',
    });

    expect(announcements[0].title).toBe('平台维护窗口通知');
    expect(published).toMatchObject({
      id: 'announcement-002',
      title: '采购规则更新',
      audience: 'buyer',
      status: 'active',
    });
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/platform/announcements',
      'http://java.test/api/v1/platform/announcements',
    ]);
  });

  it('uses the Java API client to authenticate and load supplier workspace data from the aggregate endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        const body = JSON.parse(String(init?.body)) as { scope: string };
        return Response.json({
          success: true,
          data: {
            accessToken: body.scope === 'SUPPLIER' ? 'supplier-token' : 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: body.scope === 'SUPPLIER' ? 'user-supplier-sales' : 'user-buyer-owner',
            displayName: body.scope === 'SUPPLIER' ? '供应商销售' : '采购负责人',
            scope: body.scope,
            tenantId: body.scope === 'BUYER' ? 'tenant-acme' : null,
            supplierId: body.scope === 'SUPPLIER' ? 'ent-supplier-sunrise' : null,
            roles: body.scope === 'SUPPLIER' ? ['SUPPLIER_SALES'] : ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/workspace') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        return Response.json({
          success: true,
          data: {
            profile: {
              id: 'ent-supplier-sunrise',
              name: '晨光科技供应商',
              type: 'supplier',
              industry: '办公设备',
              verified: true,
              connectedBuyerNames: ['Acme 采购公司'],
            },
            opportunities: [{
              id: 'rfq-java-001',
              tenantId: 'tenant-acme',
              title: 'Java RFQ',
              status: '报价中',
              deadlineAt: '2026-07-01T18:00:00+08:00',
              ownerId: 'user-buyer-owner',
              awardedSupplierId: null,
              demandIds: ['dem-java-001'],
              invitedSupplierIds: ['ent-supplier-sunrise'],
            }],
            quotes: [{
              id: 'quote-java-001',
              tenantId: 'tenant-acme',
              rfqId: 'rfq-java-001',
              supplierId: 'ent-supplier-sunrise',
              amount: 118000,
              taxRate: 13,
              deliveryDays: 7,
              status: '已提交',
            }],
            orders: [{
              id: 'po-java-001',
              tenantId: 'tenant-acme',
              rfqId: 'rfq-java-001',
              supplierId: 'ent-supplier-sunrise',
              amount: 118000,
              status: '待供应商确认',
              expectedReceiptDate: '2026-07-10',
            }],
            deliveries: [{
              id: 'delivery-java-001',
              tenantId: 'tenant-acme',
              supplierId: 'ent-supplier-sunrise',
              orderId: 'po-java-001',
              carrier: '顺丰速运',
              trackingNo: 'SF-SUPPLIER-001',
              status: '已发货',
              createdAt: '2026-07-02T10:00:00+08:00',
            }],
            invoices: [{
              id: 'invoice-java-001',
              tenantId: 'tenant-acme',
              supplierId: 'ent-supplier-sunrise',
              orderId: 'po-java-001',
              amount: 118000,
              invoiceNo: 'INV-2026-0001',
              paymentStatus: '待付款',
            }],
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
      supplierLogin: {
        account: 'supplier',
        password: 'demo123456',
        scope: 'SUPPLIER',
        supplierId: 'ent-supplier-sunrise',
      },
    });

    const supplierData = await loadJavaSupplierWorkspaceData(client);

    expect(supplierData.profile.name).toBe('晨光科技供应商');
    expect(supplierData.opportunities[0].id).toBe('rfq-java-001');
    expect(supplierData.quotes[0].amount).toBe(118000);
    expect(supplierData.orders[0].status).toBe('待供应商确认');
    expect(supplierData.deliveries[0].trackingNo).toBe('SF-SUPPLIER-001');
    expect(supplierData.invoices[0].paymentStatus).toBe('待付款');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/supplier/workspace',
    ]);
  });

  it('uses the Java API client to list, create, and submit buyer purchase demands', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-buyer-owner',
            displayName: '采购负责人',
            scope: 'BUYER',
            tenantId: 'tenant-acme',
            supplierId: null,
            roles: ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/demands' && init?.method !== 'POST') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'dem-java-001',
            tenantId: 'tenant-acme',
            title: 'Java 采购需求',
            departmentId: 'dept-it',
            requesterId: 'user-buyer-owner',
            budget: 120000,
            status: '草稿',
            createdAt: '2026-06-15T10:00:00+08:00',
            updatedAt: '2026-06-15T10:00:00+08:00',
            lineItems: [{ id: 'item-001', materialId: 'mat-laptop', quantity: 2 }],
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/demands' && init?.method === 'POST') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          title: '新建 Java 需求',
          departmentId: 'dept-admin',
          budget: 66000,
          lineItems: [{ materialId: 'mat-laptop', quantity: 3 }],
        });
        return Response.json({
          success: true,
          data: {
            id: 'dem-java-new',
            tenantId: 'tenant-acme',
            title: '新建 Java 需求',
            departmentId: 'dept-admin',
            requesterId: 'user-buyer-owner',
            budget: 66000,
            status: '草稿',
            createdAt: '2026-06-15T11:00:00+08:00',
            updatedAt: '2026-06-15T11:00:00+08:00',
            lineItems: [{ id: 'item-new', materialId: 'mat-laptop', quantity: 3 }],
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/demands/dem-java-new/submit') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: {
            id: 'approval-001',
            tenantId: 'tenant-acme',
            bizType: 'purchase_demand',
            bizId: 'dem-java-new',
            assigneeId: 'user-buyer-owner',
            status: '待审批',
            createdAt: '2026-06-15T11:05:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/approvals/pending') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'approval-001',
            tenantId: 'tenant-acme',
            bizType: 'purchase_demand',
            bizId: 'dem-java-new',
            parentBizId: null,
            summaryTitle: '新建 Java 需求',
            businessStatus: '审批中',
            priority: 70,
            submittedById: 'requester-1',
            submittedByName: '需求申请人',
            amount: 66000,
            counterpartyId: null,
            counterpartyName: null,
            assigneeId: 'user-buyer-owner',
            status: '待审批',
            createdAt: '2026-06-15T11:05:00+08:00',
            actedAt: null,
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/approvals/recent') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'approval-reviewed',
            tenantId: 'tenant-acme',
            bizType: 'purchase_demand',
            bizId: 'dem-java-new',
            parentBizId: null,
            summaryTitle: '新建 Java 需求',
            businessStatus: '已通过',
            priority: 70,
            submittedById: 'requester-1',
            submittedByName: '需求申请人',
            amount: 66000,
            counterpartyId: null,
            counterpartyName: null,
            assigneeId: 'user-buyer-owner',
            status: '已通过',
            createdAt: '2026-06-15T11:05:00+08:00',
            actedAt: '2026-06-15T12:05:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/approvals/templates') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            templateCode: 'TPL_PURCHASE_DEMAND',
            bizType: 'purchase_demand',
            name: '需求审批',
            defaultApproverRoleId: 'role-buyer-owner',
            status: 'active',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/approvals/templates/TPL_PURCHASE_DEMAND/config') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(init.body as string)).toEqual({
          defaultApproverRoleId: 'role-buyer-finance',
          status: 'inactive',
        });
        return Response.json({
          success: true,
          data: {
            templateCode: 'TPL_PURCHASE_DEMAND',
            bizType: 'purchase_demand',
            name: '需求审批',
            defaultApproverRoleId: 'role-buyer-finance',
            status: 'inactive',
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
    });

    const demands = await client.listBuyerDemands();
    const created = await client.createBuyerDemand({
      title: '新建 Java 需求',
      department: 'dept-admin',
      requester: '页面不会提交 requester',
      budget: 66000,
      expectedDeliveryDate: '2026-07-05',
      description: '补充采购研发用高性能笔记本',
      attachmentNames: ['预算批复.pdf', '配置说明.xlsx'],
      lineItems: [{ materialId: 'mat-laptop', quantity: 3 }],
    });
    const approval = await client.submitBuyerDemand(created.id);
    const pendingApprovals = await client.listBuyerPendingApprovals();
    const recentApprovals = await client.listBuyerRecentApprovals();
    const approvalTemplates = await client.listBuyerApprovalTemplates();
    const updatedTemplate = await client.updateBuyerApprovalTemplate('TPL_PURCHASE_DEMAND', {
      defaultApproverRoleId: 'role-buyer-finance',
      status: 'inactive',
    });

    expect(demands[0]).toMatchObject({
      id: 'dem-java-001',
      tenantId: 'tenant-acme',
      title: 'Java 采购需求',
      department: 'dept-it',
      requester: 'user-buyer-owner',
      budget: 120000,
      status: '草稿',
      lineItems: [{ materialId: 'mat-laptop', quantity: 2 }],
    });
    expect(created.department).toBe('dept-admin');
    expect(approval.bizId).toBe('dem-java-new');
    expect(pendingApprovals[0]).toMatchObject({
      id: 'approval-001',
      bizType: 'purchase_demand',
      summaryTitle: '新建 Java 需求',
      businessStatus: '审批中',
      priority: 70,
      submittedByName: '需求申请人',
      amount: 66000,
    });
    expect(recentApprovals[0]).toMatchObject({
      id: 'approval-reviewed',
      status: '已通过',
      actedAt: '2026-06-15T12:05:00+08:00',
    });
    expect(approvalTemplates[0]).toMatchObject({
      templateCode: 'TPL_PURCHASE_DEMAND',
      defaultApproverRoleId: 'role-buyer-owner',
    });
    expect(updatedTemplate).toMatchObject({
      templateCode: 'TPL_PURCHASE_DEMAND',
      defaultApproverRoleId: 'role-buyer-finance',
      status: 'inactive',
    });
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(1);
  });

  it('reports HTTP status when a Java API error response has no JSON body', async () => {
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-buyer-owner',
            displayName: '采购负责人',
            scope: 'BUYER',
            tenantId: 'tenant-acme',
            supplierId: null,
            roles: ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/rfqs') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return new Response(null, { status: 403 });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
    });

    await expect(client.listBuyerRfqs()).rejects.toThrow('API request failed with 403');
  });

  it('uses the Java API client to create RFQs, submit supplier quotes, award quotes, create orders, ship, receive, invoice, and pay with scoped tokens', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        const body = JSON.parse(String(init?.body));
        return Response.json({
          success: true,
          data: {
            accessToken: body.scope === 'SUPPLIER' ? 'supplier-token' : 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: body.scope === 'SUPPLIER' ? 'user-supplier-sales' : 'user-buyer-owner',
            displayName: body.scope === 'SUPPLIER' ? '供应商销售' : '采购负责人',
            scope: body.scope,
            tenantId: body.scope === 'SUPPLIER' ? null : 'tenant-acme',
            supplierId: body.scope === 'SUPPLIER' ? 'ent-supplier-sunrise' : null,
            roles: body.scope === 'SUPPLIER' ? ['SUPPLIER_SALES'] : ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/rfqs' && init?.method !== 'POST') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'rfq-java-001',
            tenantId: 'tenant-acme',
            title: 'Java RFQ',
            status: '报价中',
            deadlineAt: '2026-07-01T18:00:00+08:00',
            ownerId: 'user-buyer-owner',
            awardedSupplierId: null,
            createdAt: '2026-06-15T12:00:00+08:00',
            updatedAt: '2026-06-15T12:00:00+08:00',
            demandIds: ['dem-local-laptop'],
            invitedSupplierIds: ['ent-supplier-sunrise'],
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/rfqs' && init?.method === 'POST') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          title: 'Java 新建 RFQ',
          demandIds: ['dem-local-laptop'],
          invitedSupplierIds: ['ent-supplier-sunrise'],
          deadlineAt: '2026-07-01T18:00:00+08:00',
        });
        return Response.json({
          success: true,
          data: {
            id: 'rfq-java-new',
            tenantId: 'tenant-acme',
            title: 'Java 新建 RFQ',
            status: '报价中',
            deadlineAt: '2026-07-01T18:00:00+08:00',
            ownerId: 'user-buyer-owner',
            awardedSupplierId: null,
            createdAt: '2026-06-15T12:10:00+08:00',
            updatedAt: '2026-06-15T12:10:00+08:00',
            demandIds: ['dem-local-laptop'],
            invitedSupplierIds: ['ent-supplier-sunrise'],
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/supplier/rfqs/rfq-java-new/quotes') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ amount: 118000, taxRate: 13, deliveryDays: 7 });
        return Response.json({
          success: true,
          data: {
            id: 'quote-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-new',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            taxRate: 13,
            deliveryDays: 7,
            status: '已提交',
            submittedAt: '2026-06-15T12:20:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/rfqs/rfq-java-new/award') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ quoteId: 'quote-java-001', reason: '价格和交期最优' });
        return Response.json({
          success: true,
          data: {
            id: 'award-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-new',
            quoteId: 'quote-java-001',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            reason: '价格和交期最优',
            approvedStatus: '已通过',
            createdAt: '2026-06-15T12:30:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/orders') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          awardId: 'award-java-001',
          expectedReceiptDate: '2026-07-10',
        });
        return Response.json({
          success: true,
          data: {
            id: 'po-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-new',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            status: '待供应商确认',
            expectedReceiptDate: '2026-07-10',
            createdAt: '2026-06-15T12:40:00+08:00',
            updatedAt: '2026-06-15T12:40:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/supplier/orders/po-java-001/confirm') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
        });
        return Response.json({
          success: true,
          data: {
            id: 'po-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-new',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            status: '待发货',
            expectedReceiptDate: '2026-07-10',
            createdAt: '2026-06-15T12:40:00+08:00',
            updatedAt: '2026-06-15T12:45:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/orders/po-java-001/deliveries') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          carrier: '顺丰速运',
          trackingNo: 'SF1234567890',
        });
        return Response.json({
          success: true,
          data: {
            id: 'delivery-java-001',
            tenantId: 'tenant-acme',
            orderId: 'po-java-001',
            supplierId: 'ent-supplier-sunrise',
            carrier: '顺丰速运',
            trackingNo: 'SF1234567890',
            status: '已发货',
            createdAt: '2026-06-15T12:50:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/orders/po-java-001/receipts') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ result: '验收通过' });
        return Response.json({
          success: true,
          data: {
            id: 'receipt-java-001',
            tenantId: 'tenant-acme',
            orderId: 'po-java-001',
            receiverId: 'user-buyer-owner',
            result: '验收通过',
            receivedAt: '2026-06-15T13:00:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/supplier/orders/po-java-001/invoices') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          amount: 118000,
          invoiceNo: 'INV-2026-0001',
        });
        return Response.json({
          success: true,
          data: {
            id: 'invoice-java-001',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            amount: 118000,
            invoiceNo: 'INV-2026-0001',
            paymentStatus: '待付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:10:00+08:00',
          },
          message: '',
        }, { status: 201 });
      }
      if (input === 'http://java.test/api/v1/buyer/invoices/invoice-java-001/payments') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ paymentStatus: '已付款' });
        return Response.json({
          success: true,
          data: {
            id: 'invoice-java-001',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            amount: 118000,
            invoiceNo: 'INV-2026-0001',
            paymentStatus: '已付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
      supplierLogin: {
        account: 'supplier',
        password: 'demo123456',
        scope: 'SUPPLIER',
        supplierId: 'ent-supplier-sunrise',
      },
    });

    const rfqs = await client.listBuyerRfqs();
    const rfq = await client.createBuyerRfq({
      title: 'Java 新建 RFQ',
      demandIds: ['dem-local-laptop'],
      invitedSupplierIds: ['ent-supplier-sunrise'],
      deadline: '2026-07-01T18:00:00+08:00',
      quoteRequirement: '请按含税总价报价，并注明质保周期。',
      deliveryRequirement: '中标后 7 个自然日内送达华东总部。',
      invitationNote: '本次询价优先考虑准时交付和售后响应。',
    });
    const quote = await client.submitSupplierQuote(rfq.id, { amount: 118000, taxRate: 13, deliveryDays: 7 });
    const award = await client.awardBuyerRfq(rfq.id, { quoteId: quote.id, reason: '价格和交期最优' });
    const order = await client.createBuyerOrder({ awardId: award.id, expectedReceiptDate: '2026-07-10' });
    const confirmedOrder = await client.confirmSupplierOrder(order.id);
    const delivery = await client.createSupplierDelivery(confirmedOrder.id, { carrier: '顺丰速运', trackingNo: 'SF1234567890' });
    const receipt = await client.createBuyerReceipt(order.id, {
      result: '验收通过',
      receiptRemark: '外观和数量核验无误',
      exceptionReason: '',
      attachmentNames: ['收货照片.jpg', '验收单.pdf'],
    });
    const invoice = await client.createSupplierInvoice(order.id, { amount: 118000, invoiceNo: 'INV-2026-0001' });
    const paidInvoice = await client.registerBuyerPayment(invoice.id, {
      paymentStatus: '已付款',
      paymentRemark: '已完成银行付款登记',
      paymentRequestStatus: '付款申请已通过',
      reconciliationNote: '订单、收货、发票金额一致',
    });

    expect(rfqs[0]).toMatchObject({
      id: 'rfq-java-001',
      deadline: '2026-07-01T18:00:00+08:00',
      owner: 'user-buyer-owner',
      quotes: [],
    });
    expect(rfq.invitedSupplierIds).toEqual(['ent-supplier-sunrise']);
    expect(quote).toMatchObject({ id: 'quote-java-001', supplierId: 'ent-supplier-sunrise', amount: 118000 });
    expect(award).toMatchObject({ id: 'award-java-001', quoteId: 'quote-java-001', approvedStatus: '已通过' });
    expect(order).toMatchObject({
      id: 'po-java-001',
      supplierId: 'ent-supplier-sunrise',
      rfqId: 'rfq-java-new',
      amount: 118000,
      status: '待供应商确认',
    });
    expect(confirmedOrder).toMatchObject({
      id: 'po-java-001',
      status: '待发货',
    });
    expect(delivery).toMatchObject({
      id: 'delivery-java-001',
      orderId: 'po-java-001',
      supplierId: 'ent-supplier-sunrise',
      status: '已发货',
    });
    expect(receipt).toMatchObject({
      id: 'receipt-java-001',
      orderId: 'po-java-001',
      receiverId: 'user-buyer-owner',
      result: '验收通过',
    });
    expect(invoice).toMatchObject({
      id: 'invoice-java-001',
      orderId: 'po-java-001',
      amount: 118000,
      paymentStatus: '待付款',
    });
    expect(paidInvoice.paymentStatus).toBe('已付款');
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(2);
  });

  it('uses the Java API client to review buyer approval tasks by business type', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'buyer-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-buyer-owner',
            displayName: '采购负责人',
            scope: 'BUYER',
            tenantId: 'tenant-acme',
            supplierId: null,
            roles: ['BUYER_OWNER'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/demands/dem-001/approval') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(JSON.parse(String(init?.body))).toEqual({ approved: true });
        return Response.json({
          success: true,
          data: {
            id: 'approval-demand',
            tenantId: 'tenant-acme',
            bizType: 'purchase_demand',
            bizId: 'dem-001',
            assigneeId: 'user-buyer-owner',
            status: '已通过',
            createdAt: '2026-06-15T10:00:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-001/approval') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(JSON.parse(String(init?.body))).toEqual({ approved: false });
        return Response.json({
          success: true,
          data: {
            id: 'approval-supplier',
            tenantId: 'tenant-acme',
            bizType: 'buyer_supplier_admission',
            bizId: 'rel-001',
            assigneeId: 'user-buyer-owner',
            status: '已驳回',
            createdAt: '2026-06-15T10:05:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-001/submit') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(init?.body).toBeUndefined();
        return Response.json({
          success: true,
          data: {
            id: 'approval-supplier-submit',
            tenantId: 'tenant-acme',
            bizType: 'buyer_supplier_admission',
            bizId: 'rel-001',
            assigneeId: 'user-buyer-owner',
            status: '审批中',
            createdAt: '2026-06-15T10:04:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/rfqs/rfq-001/award/approval') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(JSON.parse(String(init?.body))).toEqual({ awardId: 'award-001', approved: true });
        return Response.json({
          success: true,
          data: {
            id: 'award-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-001',
            quoteId: 'quote-001',
            supplierId: 'ent-supplier-sunrise',
            amount: 98000,
            reason: '最低价',
            approvedStatus: '已通过',
            createdAt: '2026-06-15T10:10:00+08:00',
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      buyerLogin: {
        account: 'buyer',
        password: 'demo123456',
        scope: 'BUYER',
        tenantId: 'tenant-acme',
      },
    });

    const demandApproval = await client.reviewBuyerDemandApproval('dem-001', true);
    const supplierAdmission = await client.submitBuyerSupplierAdmission('rel-001');
    const supplierApproval = await client.reviewBuyerSupplierAdmission('rel-001', false);
    const awardApproval = await client.reviewBuyerAwardApproval('rfq-001', 'award-001', true);

    expect(demandApproval.status).toBe('已通过');
    expect(supplierAdmission.status).toBe('审批中');
    expect(supplierApproval.status).toBe('已驳回');
    expect(awardApproval.approvedStatus).toBe('已通过');
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(1);
  });

  it('applies Java buyer master data to the buyer workspace without mutating existing workspace data', async () => {
    const buyer = await mockApiClient.getBuyerWorkspace('tenant-acme');
    const nextWorkspace = applyJavaBuyerMasterData(buyer.workspace, {
      suppliers: [{
        id: 'rel-sunrise',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        supplierName: '晨光供应商',
        status: '已准入',
        level: 'A',
        categories: ['办公设备'],
        performanceScore: 92.5,
      }],
      materials: [{
        id: 'mat-laptop',
        tenantId: 'tenant-acme',
        code: 'IT-LAPTOP',
        name: '办公电脑',
        category: '办公设备',
        unit: '台',
        referencePrice: 6000,
      }],
      departments: [{
        id: 'dept-it',
        tenantId: 'tenant-acme',
        name: '信息化部',
        parentId: null,
        status: 'active',
      }],
      users: [{
        id: 'user-buyer-owner',
        tenantId: 'tenant-acme',
        name: '采购负责人',
        mobile: '13800000000',
        email: 'buyer@example.com',
        status: 'active',
        departmentId: 'dept-it',
        roleId: 'role-buyer-owner',
      }],
      demands: [{
        id: 'dem-java-001',
        tenantId: 'tenant-acme',
        title: 'Java 采购需求',
        department: 'dept-it',
        requester: 'user-buyer-owner',
        budget: 120000,
        status: '草稿',
        lineItems: [{ materialId: 'mat-laptop', quantity: 2 }],
      }],
      rfqs: [{
        id: 'rfq-java-001',
        tenantId: 'tenant-acme',
        demandIds: ['dem-java-001'],
        title: 'Java RFQ',
        status: '报价中',
        deadline: '2026-07-01T18:00:00+08:00',
        owner: 'user-buyer-owner',
        invitedSupplierIds: ['ent-supplier-sunrise'],
        quotes: [],
      }],
      orders: [{
        id: 'po-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        rfqId: 'rfq-java-001',
        amount: 118000,
        status: '已收货',
        expectedReceiptDate: '2026-07-10',
      }],
      deliveries: [{
        id: 'delivery-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        carrier: '顺丰速运',
        trackingNo: 'SF100001',
        status: '已发货',
        createdAt: '2026-06-15T14:00:00+08:00',
      }],
      invoices: [{
        id: 'invoice-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        amount: 118000,
        paymentStatus: '已付款',
      }],
      pendingApprovals: [],
      auditLogs: [{
        id: 'audit-java-001',
        tenantId: 'tenant-acme',
        actorId: 'user-buyer-owner',
        action: 'purchase_order.created',
        targetType: 'purchase_order',
        targetId: 'po-java-001',
        createdAt: '2026-06-15T15:20:00+08:00',
      }],
    });

    expect(nextWorkspace).not.toBe(buyer.workspace);
    expect(buyer.workspace.privateSupplierRelations.map((relation) => relation.supplierId)).not.toContain('ent-supplier-sunrise');
    expect(nextWorkspace.privateSupplierRelations).toEqual([{
      id: 'rel-sunrise',
      tenantId: 'tenant-acme',
      supplierId: 'ent-supplier-sunrise',
      status: '已准入',
      level: 'A',
      categories: ['办公设备'],
      performanceScore: 92.5,
    }]);
    expect(nextWorkspace.suppliers[0]).toMatchObject({
      id: 'ent-supplier-sunrise',
      name: '晨光供应商',
      type: 'supplier',
    });
    expect(nextWorkspace.materials[0].code).toBe('IT-LAPTOP');
    expect(nextWorkspace.departments).toEqual([{
      id: 'dept-it',
      tenantId: 'tenant-acme',
      name: '信息化部',
      parentId: null,
      status: 'active',
    }]);
    expect(nextWorkspace.users[0]).toMatchObject({
      id: 'user-buyer-owner',
      name: '采购负责人',
      role: '采购用户',
      scope: 'buyer',
    });
    expect(nextWorkspace.demands).toEqual([{
      id: 'dem-java-001',
      tenantId: 'tenant-acme',
      title: 'Java 采购需求',
      department: 'dept-it',
      requester: 'user-buyer-owner',
      budget: 120000,
      status: '草稿',
      lineItems: [{ materialId: 'mat-laptop', quantity: 2 }],
    }]);
    expect(nextWorkspace.rfqs).toEqual([{
      id: 'rfq-java-001',
      tenantId: 'tenant-acme',
      demandIds: ['dem-java-001'],
      title: 'Java RFQ',
      status: '报价中',
      deadline: '2026-07-01T18:00:00+08:00',
      owner: 'user-buyer-owner',
      invitedSupplierIds: ['ent-supplier-sunrise'],
      quotes: [],
    }]);
    expect(nextWorkspace.orders).toEqual([{
      id: 'po-java-001',
      tenantId: 'tenant-acme',
      supplierId: 'ent-supplier-sunrise',
      rfqId: 'rfq-java-001',
      amount: 118000,
      status: '已收货',
      expectedReceiptDate: '2026-07-10',
    }]);
    expect(nextWorkspace.deliveries).toEqual([{
      id: 'delivery-java-001',
      tenantId: 'tenant-acme',
      supplierId: 'ent-supplier-sunrise',
      orderId: 'po-java-001',
      carrier: '顺丰速运',
      trackingNo: 'SF100001',
      status: '已发货',
      createdAt: '2026-06-15T14:00:00+08:00',
    }]);
    expect(nextWorkspace.invoices).toEqual([{
      id: 'invoice-java-001',
      tenantId: 'tenant-acme',
      supplierId: 'ent-supplier-sunrise',
      orderId: 'po-java-001',
      amount: 118000,
      paymentStatus: '已付款',
    }]);
    expect(nextWorkspace.auditLogs).toEqual([{
      id: 'audit-java-001',
      tenantId: 'tenant-acme',
      actorId: 'user-buyer-owner',
      action: 'purchase_order.created',
      targetType: 'purchase_order',
      targetId: 'po-java-001',
      createdAt: '2026-06-15T15:20:00+08:00',
    }]);
  });

  it('applies Java platform workspace data without mutating existing platform data', async () => {
    const platform = await mockApiClient.getPlatformWorkspace();
    const nextPlatform = applyJavaPlatformWorkspaceData(platform, {
      overview: {
        scope: 'platform',
        tenantCount: 1,
        publicSupplierCount: 1,
        pendingEnterpriseReviews: 1,
      },
      tenants: [{
        id: 'tenant-acme',
        name: 'Acme 采购公司',
        plan: 'pro',
        status: 'active',
        enabledFeatures: ['rfq', 'order', 'finance'],
        userLimit: 100,
      }],
      enterpriseReviews: [{
        id: 'ent-supplier-sunrise',
        name: '晨光科技供应商',
        type: 'supplier',
        verified: false,
        reviewStatus: 'pending',
      }],
    });

    expect(nextPlatform).not.toBe(platform);
    expect(platform.model.tenants.map((tenant) => tenant.id)).not.toEqual(['tenant-acme']);
    expect(nextPlatform.tenants).toEqual([{
      id: 'tenant-acme',
      name: 'Acme 采购公司',
      plan: '专业版',
      status: '已启用',
      enabledFeatures: ['rfq', 'order', 'finance'],
      userLimit: 100,
    }]);
    expect(nextPlatform.enterprises).toEqual([
      {
        id: 'tenant-acme',
        name: 'Acme 采购公司',
        type: 'buyer',
        industry: '采购企业',
        verified: true,
      },
      {
        id: 'ent-supplier-sunrise',
        name: '晨光科技供应商',
        type: 'supplier',
        industry: '待审核企业',
        verified: false,
      },
    ]);
    expect(nextPlatform.platformOverview).toEqual({
      scope: 'platform',
      tenantCount: 1,
      publicSupplierCount: 1,
      pendingEnterpriseReviews: 1,
    });
  });

  it('applies Java supplier workspace data without mutating existing workspace data', async () => {
    const supplier = await mockApiClient.getSupplierWorkspace('supplier-orbit');
    const nextWorkspace = applyJavaSupplierWorkspaceData(supplier, {
      profile: {
        id: 'ent-supplier-sunrise',
        name: '晨光科技供应商',
        type: 'supplier',
        industry: '办公设备',
        verified: true,
        connectedBuyerNames: ['Acme 采购公司'],
      },
      opportunities: [{
        id: 'rfq-java-001',
        tenantId: 'tenant-acme',
        demandIds: ['dem-java-001'],
        title: 'Java RFQ',
        status: '报价中',
        deadline: '2026-07-01T18:00:00+08:00',
        owner: 'user-buyer-owner',
        invitedSupplierIds: ['ent-supplier-sunrise'],
        quotes: [],
      }],
      quotes: [{
        id: 'quote-java-001',
        tenantId: 'tenant-acme',
        rfqId: 'rfq-java-001',
        supplierId: 'ent-supplier-sunrise',
        amount: 118000,
        taxRate: 13,
        deliveryDays: 7,
        status: '已提交',
      }],
      orders: [{
        id: 'po-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        rfqId: 'rfq-java-001',
        amount: 118000,
        status: '待供应商确认',
        expectedReceiptDate: '2026-07-10',
      }],
      deliveries: [{
        id: 'delivery-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        carrier: '顺丰速运',
        trackingNo: 'SF-SUPPLIER-001',
        status: '已发货',
        createdAt: '2026-07-02T10:00:00+08:00',
      }],
      invoices: [{
        id: 'invoice-java-001',
        tenantId: 'tenant-acme',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        amount: 118000,
        paymentStatus: '待付款',
      }],
    });

    expect(nextWorkspace).not.toBe(supplier);
    expect(supplier.supplier.id).toBe('supplier-orbit');
    expect(nextWorkspace.supplier).toEqual({
      id: 'ent-supplier-sunrise',
      name: '晨光科技供应商',
      type: 'supplier',
      industry: '办公设备',
      verified: true,
    });
    expect(nextWorkspace.connectedBuyerNames).toEqual(['Acme 采购公司']);
    expect(nextWorkspace.opportunities[0].quotes).toEqual([{
      id: 'quote-java-001',
      tenantId: 'tenant-acme',
      rfqId: 'rfq-java-001',
      supplierId: 'ent-supplier-sunrise',
      amount: 118000,
      taxRate: 13,
      deliveryDays: 7,
      status: '已提交',
    }]);
    expect(nextWorkspace.orders[0].id).toBe('po-java-001');
    expect(nextWorkspace.deliveries[0].trackingNo).toBe('SF-SUPPLIER-001');
    expect(nextWorkspace.invoices[0].id).toBe('invoice-java-001');
  });

  it('runs the Java MVP workflow through the Java API client from demand to payment', async () => {
    const calls: string[] = [];
    const client = {
      async listBuyerDemands() {
        calls.push('listBuyerDemands');
        return [{
          id: 'dem-approved',
          tenantId: 'tenant-acme',
          title: '已审批需求',
          department: 'dept-it',
          requester: 'user-buyer-owner',
          budget: 100000,
          status: '已通过' as const,
          lineItems: [{ materialId: 'mat-laptop', quantity: 10 }],
        }];
      },
      async listBuyerSuppliers() {
        calls.push('listBuyerSuppliers');
        return [{
          id: 'rel-approved',
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          supplierName: '晨光供应商',
          status: '已准入',
          level: 'A',
          categories: ['办公设备'],
          performanceScore: 95,
        }];
      },
      async createBuyerRfq(payload: unknown) {
        calls.push(`createBuyerRfq:${JSON.stringify(payload)}`);
        return {
          id: 'rfq-001',
          tenantId: 'tenant-acme',
          demandIds: ['dem-approved'],
          title: 'Java MVP 全流程联调',
          status: '报价中' as const,
          deadline: '2026-07-01T00:00:00.000Z',
          owner: 'user-buyer-owner',
          invitedSupplierIds: ['ent-supplier-sunrise'],
          quotes: [],
        };
      },
      async submitSupplierQuote(rfqId: string, payload: unknown) {
        calls.push(`submitSupplierQuote:${rfqId}:${JSON.stringify(payload)}`);
        return {
          id: 'quote-001',
          rfqId,
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          amount: 98000,
          taxRate: 13,
          deliveryDays: 7,
          status: '已提交' as const,
        };
      },
      async awardBuyerRfq(rfqId: string, payload: unknown) {
        calls.push(`awardBuyerRfq:${rfqId}:${JSON.stringify(payload)}`);
        return {
          id: 'award-001',
          tenantId: 'tenant-acme',
          rfqId,
          quoteId: 'quote-001',
          supplierId: 'ent-supplier-sunrise',
          amount: 98000,
          reason: '自动联调报价',
          approvedStatus: '已通过',
          createdAt: '2026-06-15T00:00:00.000Z',
        };
      },
      async createBuyerOrder(payload: unknown) {
        calls.push(`createBuyerOrder:${JSON.stringify(payload)}`);
        return {
          id: 'po-001',
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          rfqId: 'rfq-001',
          amount: 98000,
          status: '待供应商确认' as const,
          expectedReceiptDate: '2026-07-06',
        };
      },
      async confirmSupplierOrder(orderId: string) {
        calls.push(`confirmSupplierOrder:${orderId}`);
        return {
          id: orderId,
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          rfqId: 'rfq-001',
          amount: 98000,
          status: '待发货' as const,
          expectedReceiptDate: '2026-07-06',
        };
      },
      async createSupplierDelivery(orderId: string, payload: unknown) {
        calls.push(`createSupplierDelivery:${orderId}:${JSON.stringify(payload)}`);
        return {
          id: 'delivery-001',
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          orderId,
          carrier: '顺丰速运',
          trackingNo: 'SF202606150000',
          status: '已发货' as const,
        };
      },
      async createBuyerReceipt(orderId: string, payload: unknown) {
        calls.push(`createBuyerReceipt:${orderId}:${JSON.stringify(payload)}`);
        return {
          id: 'receipt-001',
          tenantId: 'tenant-acme',
          orderId,
          receiverId: 'user-buyer-owner',
          result: '验收通过',
          receivedAt: '2026-06-15T00:00:00.000Z',
        };
      },
      async createSupplierInvoice(orderId: string, payload: unknown) {
        calls.push(`createSupplierInvoice:${orderId}:${JSON.stringify(payload)}`);
        return {
          id: 'invoice-001',
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          orderId,
          amount: 98000,
          paymentStatus: '待付款' as const,
        };
      },
      async registerBuyerPayment(invoiceId: string, payload: unknown) {
        calls.push(`registerBuyerPayment:${invoiceId}:${JSON.stringify(payload)}`);
        return {
          id: invoiceId,
          tenantId: 'tenant-acme',
          supplierId: 'ent-supplier-sunrise',
          orderId: 'po-001',
          amount: 98000,
          paymentStatus: '已付款' as const,
        };
      },
    };

    const result = await runJavaMvpWorkflow(client, {
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(result.confirmedOrder.status).toBe('待发货');
    expect(result.paidInvoice.paymentStatus).toBe('已付款');
    expect(calls).toEqual([
      'listBuyerDemands',
      'listBuyerSuppliers',
      'createBuyerRfq:{"title":"Java MVP 全流程联调","demandIds":["dem-approved"],"invitedSupplierIds":["ent-supplier-sunrise"],"deadline":"2026-06-29T00:00:00.000Z"}',
      'submitSupplierQuote:rfq-001:{"amount":98000,"taxRate":13,"deliveryDays":7}',
      'awardBuyerRfq:rfq-001:{"quoteId":"quote-001","reason":"自动联调报价"}',
      'createBuyerOrder:{"awardId":"award-001","expectedReceiptDate":"2026-07-06"}',
      'confirmSupplierOrder:po-001',
      'createSupplierDelivery:po-001:{"carrier":"顺丰速运","trackingNo":"SF202606150000"}',
      'createBuyerReceipt:po-001:{"result":"验收通过"}',
      'createSupplierInvoice:po-001:{"amount":98000,"invoiceNo":"INV-202606150000"}',
      'registerBuyerPayment:invoice-001:{"paymentStatus":"已付款"}',
    ]);
  });
});
