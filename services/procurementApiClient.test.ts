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
        if (init?.method === 'POST') {
          expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
          expect(JSON.parse(String(init.body))).toEqual({
            supplierId: 'ent-supplier-mountain',
            status: '待准入',
            level: 'B',
            categories: ['办公设备', 'IT设备'],
          });
          return Response.json({
            success: true,
            data: {
              id: 'rel-mountain',
              tenantId: 'tenant-acme',
              supplierId: 'ent-supplier-mountain',
              supplierName: '山岳科技',
              status: '待准入',
              level: 'B',
              categories: ['办公设备', 'IT设备'],
              performanceScore: 80,
            },
            message: '',
          }, { status: 201 });
        }
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
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-sunrise/profile') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({
          level: 'A',
          categories: ['办公设备', 'IT设备'],
        });
        return Response.json({
          success: true,
          data: {
            id: 'rel-sunrise',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            supplierName: '晨光供应商',
            status: '已准入',
            level: 'A',
            categories: ['办公设备', 'IT设备'],
            performanceScore: 92.5,
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-sunrise/status') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ status: '黑名单' });
        return Response.json({
          success: true,
          data: {
            id: 'rel-sunrise',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            supplierName: '晨光供应商',
            status: '黑名单',
            level: 'A',
            categories: ['办公设备', 'IT设备'],
            performanceScore: 92.5,
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-sunrise/performance') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ performanceScore: 88 });
        return Response.json({
          success: true,
          data: {
            id: 'rel-sunrise',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            supplierName: '晨光供应商',
            status: '已准入',
            level: 'A',
            categories: ['办公设备', 'IT设备'],
            performanceScore: 88,
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-sunrise/qualifications') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'qual-buyer-001',
            supplierId: 'ent-supplier-sunrise',
            qualificationType: '营业执照',
            certificateNo: 'Q-2026-001',
            expiresAt: '2027-12-31',
            fileName: '营业执照.pdf',
            storageKey: 'supplier/qualifications/business-license.pdf',
            status: 'active',
            createdAt: '2026-06-22T10:00:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/materials') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        if (init?.method === 'POST') {
          expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
          expect(JSON.parse(String(init.body))).toEqual({
            code: 'IT-MONITOR',
            name: '显示器',
            category: '办公设备',
            unit: '台',
            referencePrice: 1800,
          });
          return Response.json({
            success: true,
            data: {
              id: 'mat-monitor',
              tenantId: 'tenant-acme',
              code: 'IT-MONITOR',
              name: '显示器',
              category: '办公设备',
              unit: '台',
              referencePrice: 1800,
            },
            message: '',
          }, { status: 201 });
        }
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
      if (input === 'http://java.test/api/v1/buyer/materials/mat-monitor') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({
          code: 'IT-MONITOR-27',
          name: '27寸显示器',
          category: '办公设备',
          unit: '台',
          referencePrice: 2100,
        });
        return Response.json({
          success: true,
          data: {
            id: 'mat-monitor',
            tenantId: 'tenant-acme',
            code: 'IT-MONITOR-27',
            name: '27寸显示器',
            category: '办公设备',
            unit: '台',
            referencePrice: 2100,
          },
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
            orderAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            reconciliationStatus: '三单一致',
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
    const createdSupplierRelation = await client.createBuyerSupplierRelation({
      supplierId: 'ent-supplier-mountain',
      status: '待准入',
      level: 'B',
      categories: ['办公设备', 'IT设备'],
    });
    const updatedSupplierProfile = await client.updateBuyerSupplierProfile('rel-sunrise', {
      level: 'A',
      categories: ['办公设备', 'IT设备'],
    });
    const updatedSupplierStatus = await client.updateBuyerSupplierStatus('rel-sunrise', '黑名单');
    const updatedSupplierPerformance = await client.updateBuyerSupplierPerformance('rel-sunrise', 88);
    const supplierQualifications = await client.listBuyerSupplierQualifications('rel-sunrise');
    const materials = await client.listBuyerMaterials();
    const createdMaterial = await client.createBuyerMaterial({
      code: 'IT-MONITOR',
      name: '显示器',
      category: '办公设备',
      unit: '台',
      referencePrice: 1800,
    });
    const updatedMaterial = await client.updateBuyerMaterial('mat-monitor', {
      code: 'IT-MONITOR-27',
      name: '27寸显示器',
      category: '办公设备',
      unit: '台',
      referencePrice: 2100,
    });
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
    expect(createdSupplierRelation.id).toBe('rel-mountain');
    expect(updatedSupplierProfile.categories).toEqual(['办公设备', 'IT设备']);
    expect(updatedSupplierStatus.status).toBe('黑名单');
    expect(updatedSupplierPerformance.performanceScore).toBe(88);
    expect(supplierQualifications[0].qualificationType).toBe('营业执照');
    expect(materials[0].code).toBe('IT-LAPTOP');
    expect(createdMaterial.id).toBe('mat-monitor');
    expect(updatedMaterial.name).toBe('27寸显示器');
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

  it('uses the Java API client to load buyer invoice reconciliations from the independent ledger endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'buyer-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/invoice-reconciliations?stage=%E5%BE%85%E4%BB%98%E6%AC%BE&supplierId=ent-supplier-sunrise') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'recon-java-001',
            tenantId: 'tenant-acme',
            reconciliationNo: 'REC-invoice-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            stage: '待付款',
            nextAction: '登记付款',
            orderAmount: 118000,
            invoiceAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            paymentStatus: '待付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
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

    const reconciliations = await client.listBuyerInvoiceReconciliations({
      stage: '待付款',
      supplierId: 'ent-supplier-sunrise',
    });

    expect(reconciliations).toEqual([{
      id: 'recon-java-001',
      tenantId: 'tenant-acme',
      reconciliationNo: 'REC-invoice-java-001',
      invoiceId: 'invoice-java-001',
      supplierId: 'ent-supplier-sunrise',
      orderId: 'po-java-001',
      stage: '待付款',
      nextAction: '登记付款',
      orderAmount: 118000,
      invoiceAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      paymentStatus: '待付款',
      createdAt: '2026-06-15T13:10:00+08:00',
      updatedAt: '2026-06-15T13:20:00+08:00',
    }]);
    expect(calls.map((call) => call.input)).toContain('http://java.test/api/v1/buyer/invoice-reconciliations?stage=%E5%BE%85%E4%BB%98%E6%AC%BE&supplierId=ent-supplier-sunrise');
  });

  it('uses the Java API client to maintain supplier qualifications with supplier scoped auth', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'supplier-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/qualifications') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        if (init?.method === 'POST') {
          expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
          expect(JSON.parse(String(init.body))).toEqual({
            qualificationType: '营业执照',
            certificateNo: 'Q-2026-001',
            expiresAt: '2027-12-31',
            fileName: '营业执照.pdf',
            storageKey: 'supplier/qualifications/business-license.pdf',
          });
          return Response.json({
            success: true,
            data: {
              id: 'qual-java-created',
              supplierId: 'ent-supplier-sunrise',
              qualificationType: '营业执照',
              certificateNo: 'Q-2026-001',
              expiresAt: '2027-12-31',
              fileName: '营业执照.pdf',
              storageKey: 'supplier/qualifications/business-license.pdf',
              status: 'active',
              createdAt: '2026-06-22T10:00:00+08:00',
            },
            message: '',
          }, { status: 201 });
        }
        return Response.json({
          success: true,
          data: [{
            id: 'qual-java-001',
            supplierId: 'ent-supplier-sunrise',
            qualificationType: '授权代理证书',
            certificateNo: 'AUTH-2026-001',
            expiresAt: '2026-12-31',
            fileName: '授权代理证书.pdf',
            storageKey: 'supplier/qualifications/auth.pdf',
            status: 'active',
            createdAt: '2026-06-15T10:00:00+08:00',
          }],
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      supplierLogin: {
        account: 'supplier',
        password: 'demo123456',
        scope: 'SUPPLIER',
        supplierId: 'ent-supplier-sunrise',
      },
    });

    const qualifications = await client.listSupplierQualifications();
    const created = await client.createSupplierQualification({
      qualificationType: '营业执照',
      certificateNo: 'Q-2026-001',
      expiresAt: '2027-12-31',
      fileName: '营业执照.pdf',
      storageKey: 'supplier/qualifications/business-license.pdf',
    });

    expect(qualifications[0].qualificationType).toBe('授权代理证书');
    expect(created.id).toBe('qual-java-created');
    expect(created.status).toBe('active');
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(1);
  });

  it('uses the Java API client to load buyer three-way match snapshots from the ledger endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'buyer-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/three-way-matches?matchStatus=%E4%B8%89%E5%8D%95%E5%8C%B9%E9%85%8D%E9%80%9A%E8%BF%87&invoiceId=invoice-java-001') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'match-java-001',
            tenantId: 'tenant-acme',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            orderAmount: '118000.00',
            receiptStatus: '已收货',
            invoiceAmount: '118000.00',
            varianceAmount: '0.00',
            matchStatus: '三单匹配通过',
            blockingReason: '订单、收货、发票一致',
            paymentReadiness: '可申请付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
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

    const matches = await client.listBuyerThreeWayMatches({
      matchStatus: '三单匹配通过',
      invoiceId: 'invoice-java-001',
    });

    expect(matches[0]).toMatchObject({
      id: 'match-java-001',
      orderAmount: 118000,
      invoiceAmount: 118000,
      varianceAmount: 0,
      matchStatus: '三单匹配通过',
      paymentReadiness: '可申请付款',
    });
    expect(calls.map((call) => call.input)).toContain('http://java.test/api/v1/buyer/three-way-matches?matchStatus=%E4%B8%89%E5%8D%95%E5%8C%B9%E9%85%8D%E9%80%9A%E8%BF%87&invoiceId=invoice-java-001');
  });

  it('uses the Java API client to rebuild buyer three-way match snapshots', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'buyer-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/three-way-matches/rebuild') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: {
            tenantId: 'tenant-acme',
            rebuiltCount: '36',
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

    const result = await client.rebuildBuyerThreeWayMatches();

    expect(result).toEqual({
      tenantId: 'tenant-acme',
      rebuiltCount: 36,
    });
  });

  it('uses the Java API client to create variance handling from an abnormal three-way match', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'buyer-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/three-way-matches/match-java-variance/variance-handling') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: {
            id: 'variance-java-001',
            tenantId: 'tenant-acme',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            varianceAmount: '1200.00',
            reason: '发票金额与订单金额不一致',
            ownerId: 'user-buyer-owner',
            result: '待财务复核',
            status: '待处理',
            createdBy: 'user-buyer-owner',
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
    });

    const varianceHandling = await client.createBuyerVarianceHandlingFromThreeWayMatch('match-java-variance');

    expect(varianceHandling.varianceAmount).toBe(1200);
    expect(varianceHandling.status).toBe('待处理');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/buyer/three-way-matches/match-java-variance/variance-handling',
    ]);
  });

  it('uses the Java API client to update buyer finance action statuses', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'buyer-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/payment-requests/payreq-java-001/status') {
        expect(init?.method).toBe('PUT');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({ requestStatus: '付款申请审批中' });
        return Response.json({
          success: true,
          data: {
            id: 'payreq-java-001',
            tenantId: 'tenant-acme',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            amount: 118000,
            requestStatus: '付款申请审批中',
            paymentBatchNo: 'PAY-202606',
            remark: '提交审批',
            createdBy: 'user-buyer-owner',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/variance-handlings/variance-java-001/status') {
        expect(init?.method).toBe('PUT');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          status: '已处理',
          result: '差异已核对并关闭，允许进入付款申请。',
        });
        return Response.json({
          success: true,
          data: {
            id: 'variance-java-001',
            tenantId: 'tenant-acme',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            varianceAmount: 0,
            reason: '发票金额与订单金额存在差异',
            ownerId: 'user-buyer-owner',
            result: '差异已核对并关闭，允许进入付款申请。',
            status: '已处理',
            createdBy: 'user-buyer-owner',
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
    });

    const paymentRequest = await client.updateBuyerPaymentRequestStatus('payreq-java-001', {
      requestStatus: '付款申请审批中',
    });
    const varianceHandling = await client.updateBuyerVarianceHandlingStatus('variance-java-001', {
      status: '已处理',
      result: '差异已核对并关闭，允许进入付款申请。',
    });

    expect(paymentRequest.requestStatus).toBe('付款申请审批中');
    expect(varianceHandling.status).toBe('已处理');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/buyer/payment-requests/payreq-java-001/status',
      'http://java.test/api/v1/buyer/variance-handlings/variance-java-001/status',
    ]);
  });

  it('uses the Java API client to load supplier invoice reconciliations from the independent receivable ledger endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: { accessToken: 'supplier-token', tokenType: 'Bearer' },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/invoice-reconciliations?stage=%E5%BE%85%E4%BB%98%E6%AC%BE&orderId=po-java-001') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'recon-java-001',
            tenantId: 'tenant-acme',
            reconciliationNo: 'REC-invoice-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            stage: '待付款',
            nextAction: '跟进回款',
            orderAmount: 118000,
            invoiceAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            paymentStatus: '待付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      supplierLogin: {
        account: 'supplier',
        password: 'demo123456',
        scope: 'SUPPLIER',
        supplierId: 'ent-supplier-sunrise',
      },
    });

    const reconciliations = await client.listSupplierInvoiceReconciliations({
      stage: '待付款',
      orderId: 'po-java-001',
    });

    expect(reconciliations[0]).toMatchObject({
      id: 'recon-java-001',
      tenantId: 'tenant-acme',
      reconciliationNo: 'REC-invoice-java-001',
      invoiceId: 'invoice-java-001',
      supplierId: 'ent-supplier-sunrise',
      orderId: 'po-java-001',
      stage: '待付款',
      nextAction: '跟进回款',
      orderAmount: 118000,
      invoiceAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      paymentStatus: '待付款',
    });
    expect(calls.map((call) => call.input)).toContain('http://java.test/api/v1/supplier/invoice-reconciliations?stage=%E5%BE%85%E4%BB%98%E6%AC%BE&orderId=po-java-001');
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
      if (input === 'http://java.test/api/v1/buyer/invoice-reconciliations') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'recon-java-001',
            tenantId: 'tenant-acme',
            reconciliationNo: 'REC-invoice-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            stage: '待付款',
            nextAction: '登记付款',
            orderAmount: 118000,
            invoiceAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            paymentStatus: '待付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/payment-batches') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'paybatch-java-001',
            tenantId: 'tenant-acme',
            paymentBatchNo: 'PAY-202606',
            supplierId: 'ent-supplier-sunrise',
            requestCount: 1,
            totalAmount: 118000,
            approvedAmount: 0,
            registeredAmount: 0,
            pendingRegistrationAmount: 118000,
            blockedRegistrationAmount: 0,
            registeredCount: 0,
            pendingRegistrationCount: 1,
            blockedRegistrationCount: 0,
            executionDecision: '可继续登记付款',
            executionBlockSummary: '差异未处理',
            batchStatus: '待提交审批',
            plannedPaymentDate: '2026-07-15',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/payment-execution-records') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'payexec-java-001',
            tenantId: 'tenant-acme',
            paymentBatchNo: 'PAY-202606',
            paymentRequestId: 'payreq-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            registeredAmount: 118000,
            plannedPaymentDate: '2026-07-15',
            executionStatus: '待登记付款',
            executionTrace: '付款申请已通过，可进入线下付款登记',
            executionBlockReason: '付款申请已通过',
            createdBy: 'user-buyer-owner',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/payment-block-resolutions') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'payblock-java-001',
            tenantId: 'tenant-acme',
            paymentBatchNo: 'PAY-202606',
            paymentRequestId: 'payreq-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            blockReason: '差异未处理',
            resolutionStatus: '待处理',
            resolutionAction: '进入差异处理台账',
            nextStep: '处理差异后刷新付款批次',
            handledBy: 'user-buyer-owner',
            createdBy: 'user-buyer-owner',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/payment-archive-exception-requests') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'payarchive-exception-java-001',
            tenantId: 'tenant-acme',
            paymentBatchNo: 'PAY-202606',
            exceptionType: '撤销申请',
            exceptionReason: '归档后发现付款登记金额异常，提交撤销申请进入审批。',
            approvalStatus: '待提交审批',
            requestedBy: 'user-buyer-owner',
            reviewedBy: null,
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/three-way-matches') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'match-java-001',
            tenantId: 'tenant-acme',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            orderAmount: 118000,
            receiptStatus: '已收货',
            invoiceAmount: 118000,
            varianceAmount: 0,
            matchStatus: '三单匹配通过',
            blockingReason: '订单、收货、发票一致',
            paymentReadiness: '可申请付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/contracts') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'contract-java-001',
            tenantId: 'tenant-acme',
            contractNo: 'CTR-JAVA-001',
            contractName: '晨光科技供应商采购合同',
            relatedOrderId: 'po-java-001',
            supplierId: 'ent-supplier-sunrise',
            amount: 118000,
            status: '履约中',
            archiveStatus: '未归档',
            fulfillmentProgress: '履约中',
            effectiveDate: '2026-06-15',
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
    expect(masterData.invoiceReconciliations?.[0].reconciliationNo).toBe('REC-invoice-java-001');
    expect(masterData.paymentBatches?.[0].paymentBatchNo).toBe('PAY-202606');
    expect(masterData.paymentExecutionRecords?.[0].executionStatus).toBe('待登记付款');
    expect(masterData.paymentBlockResolutions?.[0].resolutionStatus).toBe('待处理');
    expect(masterData.paymentArchiveExceptionRequests?.[0].exceptionType).toBe('撤销申请');
    expect(masterData.threeWayMatches?.[0].matchStatus).toBe('三单匹配通过');
    expect(masterData.contracts?.[0].contractNo).toBe('CTR-JAVA-001');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/buyer/workspace',
      'http://java.test/api/v1/buyer/departments',
      'http://java.test/api/v1/buyer/roles',
      'http://java.test/api/v1/buyer/approvals/templates',
      'http://java.test/api/v1/buyer/invoice-reconciliations',
      'http://java.test/api/v1/buyer/payment-batches',
      'http://java.test/api/v1/buyer/payment-execution-records',
      'http://java.test/api/v1/buyer/payment-block-resolutions',
      'http://java.test/api/v1/buyer/payment-archive-exception-requests',
      'http://java.test/api/v1/buyer/three-way-matches',
      'http://java.test/api/v1/buyer/payment-requests',
      'http://java.test/api/v1/buyer/variance-handlings',
      'http://java.test/api/v1/buyer/contracts',
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
          reviewComment: '资料齐全，准入通过。',
          profileConfirmed: true,
          riskConfirmed: true,
        });
        return Response.json({
          success: true,
          data: {
            id: 'ent-supplier-sunrise',
            name: '晨光科技供应商',
            type: 'supplier',
            verified: true,
            reviewStatus: 'approved',
            reviewComment: '资料齐全，准入通过。',
            profileConfirmed: true,
            riskConfirmed: true,
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
      reviewComment: '资料齐全，准入通过。',
      profileConfirmed: true,
      riskConfirmed: true,
    });

    expect(review).toEqual({
      id: 'ent-supplier-sunrise',
      name: '晨光科技供应商',
      type: 'supplier',
      verified: true,
      reviewStatus: 'approved',
      reviewComment: '资料齐全，准入通过。',
      profileConfirmed: true,
      riskConfirmed: true,
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

  it('uses the Java API client to list, publish, update, and withdraw platform announcements', async () => {
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
      if (input === 'http://java.test/api/v1/platform/announcements/announcement-001' && init?.method === 'PUT') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          title: '维护窗口已更新',
          content: '维护窗口改为周六晚间。',
          audience: 'supplier',
        });
        return Response.json({
          success: true,
          data: {
            id: 'announcement-001',
            title: '维护窗口已更新',
            content: '维护窗口改为周六晚间。',
            audience: 'supplier',
            status: 'active',
            publishedBy: 'user-platform-admin',
            createdAt: '2026-06-19T08:00:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/platform/announcements/announcement-001/withdraw' && init?.method === 'POST') {
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer platform-token',
        });
        return Response.json({
          success: true,
          data: {
            id: 'announcement-001',
            title: '维护窗口已更新',
            content: '维护窗口改为周六晚间。',
            audience: 'supplier',
            status: 'withdrawn',
            publishedBy: 'user-platform-admin',
            createdAt: '2026-06-19T08:00:00+08:00',
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

    const announcements = await client.listPlatformAnnouncements();
    const published = await client.publishPlatformAnnouncement({
      title: '采购规则更新',
      content: '平台公告：采购规则更新',
      audience: 'buyer',
    });
    const updated = await client.updatePlatformAnnouncement('announcement-001', {
      title: '维护窗口已更新',
      content: '维护窗口改为周六晚间。',
      audience: 'supplier',
    });
    const withdrawn = await client.withdrawPlatformAnnouncement('announcement-001');

    expect(announcements[0].title).toBe('平台维护窗口通知');
    expect(published).toMatchObject({
      id: 'announcement-002',
      title: '采购规则更新',
      audience: 'buyer',
      status: 'active',
    });
    expect(updated).toMatchObject({
      id: 'announcement-001',
      title: '维护窗口已更新',
      audience: 'supplier',
      status: 'active',
    });
    expect(withdrawn).toMatchObject({
      id: 'announcement-001',
      status: 'withdrawn',
    });
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/platform/announcements',
      'http://java.test/api/v1/platform/announcements',
      'http://java.test/api/v1/platform/announcements/announcement-001',
      'http://java.test/api/v1/platform/announcements/announcement-001/withdraw',
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
              orderAmount: 118000,
              varianceAmount: 0,
              receiptStatus: '已收货',
              reconciliationStatus: '三单一致',
            }],
            notifications: [{
              id: 'notice-supplier-paid',
              tenantId: 'tenant-acme',
              recipientId: 'user-supplier-sales',
              title: '发票已付款',
              content: '采购方已登记发票 INV-2026-0001 的付款状态：已付款。',
              read: false,
              readAt: null,
              createdAt: '2026-06-21T10:00:00+08:00',
            }],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/invoice-reconciliations') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'recon-java-001',
            tenantId: 'tenant-acme',
            reconciliationNo: 'REC-invoice-java-001',
            invoiceId: 'invoice-java-001',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            stage: '待付款',
            nextAction: '跟进回款',
            orderAmount: 118000,
            invoiceAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            paymentStatus: '待付款',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          }],
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/qualifications') {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        return Response.json({
          success: true,
          data: [{
            id: 'qual-java-001',
            supplierId: 'ent-supplier-sunrise',
            qualificationType: '营业执照',
            certificateNo: 'Q-2026-001',
            expiresAt: '2027-12-31',
            fileName: '营业执照.pdf',
            storageKey: 'supplier/qualifications/business-license.pdf',
            status: 'active',
            createdAt: '2026-06-22T10:00:00+08:00',
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
    expect(supplierData.invoiceReconciliations?.[0].nextAction).toBe('跟进回款');
    expect(supplierData.qualifications?.[0].qualificationType).toBe('营业执照');
    expect(supplierData.notifications?.[0].title).toBe('发票已付款');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/supplier/workspace',
      'http://java.test/api/v1/supplier/invoice-reconciliations',
      'http://java.test/api/v1/supplier/qualifications',
    ]);
  });

  it('uses the Java API client to mark buyer and supplier notifications as read', async () => {
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
            tenantId: body.scope === 'BUYER' ? 'tenant-acme' : null,
            supplierId: body.scope === 'SUPPLIER' ? 'ent-supplier-sunrise' : null,
            roles: [],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/notifications/notice-buyer-001/read') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        return Response.json({
          success: true,
          data: {
            id: 'notice-buyer-001',
            tenantId: 'tenant-acme',
            recipientId: 'user-buyer-owner',
            title: '供应商已登记发票',
            content: '采购订单 po-1 已登记发票。',
            read: true,
            readAt: '2026-06-21T10:10:00+08:00',
            createdAt: '2026-06-21T10:00:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/notifications/notice-supplier-001/read') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer supplier-token' });
        return Response.json({
          success: true,
          data: {
            id: 'notice-supplier-001',
            tenantId: 'tenant-acme',
            recipientId: 'user-supplier-sales',
            title: '发票已付款',
            content: '采购方已登记发票 INV-001 的付款状态：已付款。',
            read: true,
            readAt: '2026-06-21T10:12:00+08:00',
            createdAt: '2026-06-21T10:00:00+08:00',
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

    const buyerNotice = await client.markBuyerNotificationRead('notice-buyer-001');
    const supplierNotice = await client.markSupplierNotificationRead('notice-supplier-001');

    expect(buyerNotice.read).toBe(true);
    expect(supplierNotice.read).toBe(true);
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/buyer/notifications/notice-buyer-001/read',
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/supplier/notifications/notice-supplier-001/read',
    ]);
  });

  it('uses the Java API client to update the current supplier profile', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'supplier-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-supplier-sales',
            displayName: '供应商销售',
            scope: 'SUPPLIER',
            tenantId: null,
            supplierId: 'ent-supplier-sunrise',
            roles: ['SUPPLIER_SALES'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/profile') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          name: '晨光科技供应商',
          industry: '办公设备',
          creditCode: '91310000MA1K000001',
          legalPerson: '李晨',
        });
        return Response.json({
          success: true,
          data: {
            id: 'ent-supplier-sunrise',
            name: '晨光科技供应商',
            type: 'supplier',
            industry: '办公设备',
            verified: true,
            creditCode: '91310000MA1K000001',
            legalPerson: '李晨',
            verifiedStatus: '已认证',
            profileStatus: '资料有效',
            connectedBuyerNames: ['Acme 采购公司'],
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

    const profile = await client.updateSupplierProfile({
      name: '晨光科技供应商',
      industry: '办公设备',
      creditCode: '91310000MA1K000001',
      legalPerson: '李晨',
    });

    expect(profile.creditCode).toBe('91310000MA1K000001');
    expect(profile.legalPerson).toBe('李晨');
    expect(profile.profileStatus).toBe('资料有效');
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/supplier/profile',
    ]);
  });

  it('uses the Java API client to update a supplier quote with the supplier token', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push({ input, init });
      if (input === 'http://java.test/api/v1/auth/login') {
        return Response.json({
          success: true,
          data: {
            accessToken: 'supplier-token',
            tokenType: 'Bearer',
            expiresIn: 7200,
            userId: 'user-supplier-sales',
            displayName: '供应商销售',
            scope: 'SUPPLIER',
            tenantId: null,
            supplierId: 'ent-supplier-sunrise',
            roles: ['SUPPLIER_SALES'],
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/supplier/quotes/quote-java-001') {
        expect(init?.method).toBe('PUT');
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer supplier-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual({
          amount: 116000,
          taxRate: 13,
          deliveryDays: 6,
        });
        return Response.json({
          success: true,
          data: {
            id: 'quote-java-001',
            tenantId: 'tenant-acme',
            rfqId: 'rfq-java-new',
            supplierId: 'ent-supplier-sunrise',
            amount: 116000,
            taxRate: 13,
            deliveryDays: 6,
            status: '已提交',
            submittedAt: '2026-06-15T12:20:00+08:00',
          },
          message: '',
        });
      }
      throw new Error(`Unexpected request: ${input}`);
    };

    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      fetcher,
      supplierLogin: {
        account: 'supplier',
        password: 'demo123456',
        scope: 'SUPPLIER',
        supplierId: 'ent-supplier-sunrise',
      },
    });

    const quote = await client.updateSupplierQuote('quote-java-001', {
      amount: 116000,
      taxRate: 13,
      deliveryDays: 6,
    });

    expect(quote).toMatchObject({
      id: 'quote-java-001',
      amount: 116000,
      deliveryDays: 6,
      status: '已提交',
    });
    expect(calls.map((call) => call.input)).toEqual([
      'http://java.test/api/v1/auth/login',
      'http://java.test/api/v1/supplier/quotes/quote-java-001',
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
      if (input === 'http://java.test/api/v1/buyer/demands/dem-java-new' && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          title: '更新 Java 需求',
          departmentId: 'dept-it',
          budget: 88000,
          lineItems: [{ materialId: 'mat-laptop', quantity: 4 }],
        });
        return Response.json({
          success: true,
          data: {
            id: 'dem-java-new',
            tenantId: 'tenant-acme',
            title: '更新 Java 需求',
            departmentId: 'dept-it',
            requesterId: 'user-buyer-owner',
            budget: 88000,
            status: '草稿',
            createdAt: '2026-06-15T11:00:00+08:00',
            updatedAt: '2026-06-15T11:30:00+08:00',
            lineItems: [{ id: 'item-updated', materialId: 'mat-laptop', quantity: 4 }],
          },
          message: '',
        });
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
    const updated = await client.updateBuyerDemand(created.id, {
      title: '更新 Java 需求',
      department: 'dept-it',
      requester: '页面不会提交 requester',
      budget: 88000,
      lineItems: [{ materialId: 'mat-laptop', quantity: 4 }],
    });
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
    expect(updated).toMatchObject({
      id: 'dem-java-new',
      title: '更新 Java 需求',
      department: 'dept-it',
      budget: 88000,
      lineItems: [{ materialId: 'mat-laptop', quantity: 4 }],
    });
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

    await expect(client.listBuyerRfqs()).rejects.toThrow('API request failed with 403 at /api/v1/buyer/rfqs');
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
      if (input === 'http://java.test/api/v1/buyer/rfqs/rfq-java-new' && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          title: 'Java 更新 RFQ',
          invitedSupplierIds: ['ent-supplier-sunrise', 'ent-supplier-mingguang'],
          deadlineAt: '2026-07-05T18:00:00+08:00',
        });
        return Response.json({
          success: true,
          data: {
            id: 'rfq-java-new',
            tenantId: 'tenant-acme',
            title: 'Java 更新 RFQ',
            status: '报价中',
            deadlineAt: '2026-07-05T18:00:00+08:00',
            ownerId: 'user-buyer-owner',
            awardedSupplierId: null,
            createdAt: '2026-06-15T12:10:00+08:00',
            updatedAt: '2026-06-15T12:30:00+08:00',
            demandIds: ['dem-local-laptop'],
            invitedSupplierIds: ['ent-supplier-sunrise', 'ent-supplier-mingguang'],
          },
          message: '',
        });
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
      if (input === 'http://java.test/api/v1/buyer/orders/po-java-001' && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({
          expectedReceiptDate: '2026-07-12',
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
            expectedReceiptDate: '2026-07-12',
            createdAt: '2026-06-15T12:40:00+08:00',
            updatedAt: '2026-06-15T12:45:00+08:00',
          },
          message: '',
        });
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
            orderAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            reconciliationStatus: '三单一致',
            reconciliationNo: 'REC-invoice-java-001',
            reconciliationStage: '待付款',
            nextReconciliationAction: '登记付款',
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
            orderAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            reconciliationStatus: '三单一致',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:20:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/invoices/invoice-java-001' && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer buyer-token',
          'content-type': 'application/json',
        });
        expect(JSON.parse(String(init.body))).toEqual({ paymentStatus: '部分付款' });
        return Response.json({
          success: true,
          data: {
            id: 'invoice-java-001',
            tenantId: 'tenant-acme',
            supplierId: 'ent-supplier-sunrise',
            orderId: 'po-java-001',
            amount: 118000,
            invoiceNo: 'INV-2026-0001',
            paymentStatus: '部分付款',
            orderAmount: 118000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            reconciliationStatus: '三单一致',
            createdAt: '2026-06-15T13:10:00+08:00',
            updatedAt: '2026-06-15T13:18:00+08:00',
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
    const updatedRfq = await client.updateBuyerRfq(rfq.id, {
      title: 'Java 更新 RFQ',
      invitedSupplierIds: ['ent-supplier-sunrise', 'ent-supplier-mingguang'],
      deadline: '2026-07-05T18:00:00+08:00',
    });
    const quote = await client.submitSupplierQuote(rfq.id, { amount: 118000, taxRate: 13, deliveryDays: 7 });
    const award = await client.awardBuyerRfq(rfq.id, { quoteId: quote.id, reason: '价格和交期最优' });
    const order = await client.createBuyerOrder({ awardId: award.id, expectedReceiptDate: '2026-07-10' });
    const updatedOrder = await client.updateBuyerOrder(order.id, { expectedReceiptDate: '2026-07-12' });
    const confirmedOrder = await client.confirmSupplierOrder(order.id);
    const delivery = await client.createSupplierDelivery(confirmedOrder.id, { carrier: '顺丰速运', trackingNo: 'SF1234567890' });
    const receipt = await client.createBuyerReceipt(order.id, {
      result: '验收通过',
      receiptRemark: '外观和数量核验无误',
      exceptionReason: '',
      attachmentNames: ['收货照片.jpg', '验收单.pdf'],
    });
    const invoice = await client.createSupplierInvoice(order.id, { amount: 118000, invoiceNo: 'INV-2026-0001' });
    const updatedInvoice = await client.updateBuyerInvoice(invoice.id, { paymentStatus: '部分付款' });
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
    expect(updatedRfq).toMatchObject({
      id: 'rfq-java-new',
      title: 'Java 更新 RFQ',
      invitedSupplierIds: ['ent-supplier-sunrise', 'ent-supplier-mingguang'],
      deadline: '2026-07-05T18:00:00+08:00',
    });
    expect(quote).toMatchObject({ id: 'quote-java-001', supplierId: 'ent-supplier-sunrise', amount: 118000 });
    expect(award).toMatchObject({ id: 'award-java-001', quoteId: 'quote-java-001', approvedStatus: '已通过' });
    expect(order).toMatchObject({
      id: 'po-java-001',
      supplierId: 'ent-supplier-sunrise',
      rfqId: 'rfq-java-new',
      amount: 118000,
      status: '待供应商确认',
    });
    expect(updatedOrder).toMatchObject({
      id: 'po-java-001',
      expectedReceiptDate: '2026-07-12',
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
      orderAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      reconciliationStatus: '三单一致',
      reconciliationNo: 'REC-invoice-java-001',
      reconciliationStage: '待付款',
      nextReconciliationAction: '登记付款',
    });
    expect(updatedInvoice).toMatchObject({
      id: 'invoice-java-001',
      paymentStatus: '部分付款',
    });
    expect(paidInvoice.paymentStatus).toBe('已付款');
    expect(calls.filter((call) => call.input.endsWith('/api/v1/auth/login'))).toHaveLength(2);
  });

  it('uses the Java API client to update supplier delivery tracking with the supplier token', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      buyerLogin: { phone: 'buyer', password: 'buyer-pass' },
      supplierLogin: { phone: 'supplier', password: 'supplier-pass' },
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith('/api/v1/auth/login')) {
          return Response.json({
            success: true,
            data: {
              accessToken: 'supplier-token',
              tokenType: 'Bearer',
              expiresIn: 7200,
              userId: 'supplier-user',
              displayName: '供应商账号',
              scope: 'SUPPLIER',
              tenantId: null,
              supplierId: 'supplier-java-001',
              roles: ['SUPPLIER_ADMIN'],
            },
            message: '',
          });
        }
        return Response.json({
          success: true,
          data: {
            id: 'delivery-java-001',
            tenantId: 'tenant-java-001',
            supplierId: 'supplier-java-001',
            orderId: 'po-java-001',
            carrier: '京东物流',
            trackingNo: 'JD987654321',
            status: '已发货',
            createdAt: '2026-06-18T08:00:00+08:00',
          },
          message: '',
        });
      },
    });

    const delivery = await client.updateSupplierDelivery('delivery-java-001', {
      carrier: '京东物流',
      trackingNo: 'JD987654321',
    });

    const updateCall = calls.find((call) => call.url.endsWith('/api/v1/supplier/deliveries/delivery-java-001'));
    expect(updateCall?.init?.method).toBe('PUT');
    expect(updateCall?.init?.headers).toMatchObject({
      Authorization: 'Bearer supplier-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(updateCall?.init?.body))).toEqual({
      carrier: '京东物流',
      trackingNo: 'JD987654321',
    });
    expect(delivery).toMatchObject({
      id: 'delivery-java-001',
      carrier: '京东物流',
      trackingNo: 'JD987654321',
      status: '已发货',
    });
  });

  it('uses the Java API client to update supplier receivable reconciliation notes with the supplier token', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createJavaProcurementApiClient({
      baseUrl: 'http://java.test',
      buyerLogin: { phone: 'buyer', password: 'buyer-pass' },
      supplierLogin: { phone: 'supplier', password: 'supplier-pass' },
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith('/api/v1/auth/login')) {
          return Response.json({
            success: true,
            data: {
              accessToken: 'supplier-token',
              tokenType: 'Bearer',
              expiresIn: 7200,
              userId: 'supplier-user',
              displayName: '供应商账号',
              scope: 'SUPPLIER',
              tenantId: null,
              supplierId: 'supplier-java-001',
              roles: ['SUPPLIER_ADMIN'],
            },
            message: '',
          });
        }
        return Response.json({
          success: true,
          data: {
            id: 'invoice-java-001',
            tenantId: 'tenant-java-001',
            supplierId: 'supplier-java-001',
            orderId: 'po-java-001',
            amount: 128000,
            invoiceNo: 'INV-20260620-001',
            paymentStatus: '部分付款',
            reconciliationNote: '已与采购方确认 6 月底付尾款',
            dueDate: '2026-07-20',
            overdue: false,
            overdueDays: 0,
            orderAmount: 128000,
            varianceAmount: 0,
            receiptStatus: '已收货',
            reconciliationStatus: '三单一致',
            reconciliationNo: 'REC-invoice-java-001',
            reconciliationStage: '待付款',
            nextReconciliationAction: '登记付款',
          },
          message: '',
        });
      },
    });

    const invoice = await client.updateSupplierReceivable('invoice-java-001', {
      reconciliationNote: '已与采购方确认 6 月底付尾款',
    });

    const updateCall = calls.find((call) => call.url.endsWith('/api/v1/supplier/invoices/invoice-java-001/reconciliation'));
    expect(updateCall?.init?.method).toBe('PUT');
    expect(updateCall?.init?.headers).toMatchObject({
      Authorization: 'Bearer supplier-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(updateCall?.init?.body))).toEqual({
      reconciliationNote: '已与采购方确认 6 月底付尾款',
    });
    expect(invoice).toMatchObject({
      id: 'invoice-java-001',
      paymentStatus: '部分付款',
      reconciliationNote: '已与采购方确认 6 月底付尾款',
      dueDate: '2026-07-20',
      overdue: false,
      overdueDays: 0,
      orderAmount: 128000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      reconciliationStatus: '三单一致',
      reconciliationNo: 'REC-invoice-java-001',
      reconciliationStage: '待付款',
      nextReconciliationAction: '登记付款',
    });
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
        expect(JSON.parse(String(init?.body))).toEqual({
          approved: true,
          comment: '预算和物料明细已核对，同意进入询价。',
        });
        return Response.json({
          success: true,
          data: {
            id: 'approval-demand',
            tenantId: 'tenant-acme',
            bizType: 'purchase_demand',
            bizId: 'dem-001',
            assigneeId: 'user-buyer-owner',
            status: '已通过',
            reviewComment: '预算和物料明细已核对，同意进入询价。',
            createdAt: '2026-06-15T10:00:00+08:00',
          },
          message: '',
        });
      }
      if (input === 'http://java.test/api/v1/buyer/suppliers/rel-001/approval') {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer buyer-token' });
        expect(JSON.parse(String(init?.body))).toEqual({
          approved: false,
          comment: '资质材料不完整，暂不准入。',
        });
        return Response.json({
          success: true,
          data: {
            id: 'approval-supplier',
            tenantId: 'tenant-acme',
            bizType: 'buyer_supplier_admission',
            bizId: 'rel-001',
            assigneeId: 'user-buyer-owner',
            status: '已驳回',
            reviewComment: '资质材料不完整，暂不准入。',
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
        expect(JSON.parse(String(init?.body))).toEqual({
          awardId: 'award-001',
          approved: true,
          comment: '报价、交期和服务响应均满足要求，同意定标。',
        });
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

    const demandApproval = await client.reviewBuyerDemandApproval(
      'dem-001',
      true,
      '预算和物料明细已核对，同意进入询价。',
    );
    const supplierAdmission = await client.submitBuyerSupplierAdmission('rel-001');
    const supplierApproval = await client.reviewBuyerSupplierAdmission('rel-001', false, '资质材料不完整，暂不准入。');
    const awardApproval = await client.reviewBuyerAwardApproval(
      'rfq-001',
      'award-001',
      true,
      '报价、交期和服务响应均满足要求，同意定标。',
    );

    expect(demandApproval.status).toBe('已通过');
    expect(demandApproval.reviewComment).toBe('预算和物料明细已核对，同意进入询价。');
    expect(supplierAdmission.status).toBe('审批中');
    expect(supplierApproval.status).toBe('已驳回');
    expect(supplierApproval.reviewComment).toBe('资质材料不完整，暂不准入。');
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
      invoiceReconciliations: [{
        id: 'recon-java-001',
        tenantId: 'tenant-acme',
        reconciliationNo: 'REC-invoice-java-001',
        invoiceId: 'invoice-java-001',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        stage: '已完成',
        nextAction: '归档对账',
        orderAmount: 118000,
        invoiceAmount: 118000,
        varianceAmount: 0,
        receiptStatus: '已收货',
        paymentStatus: '已付款',
        createdAt: '2026-06-15T13:10:00+08:00',
        updatedAt: '2026-06-15T13:20:00+08:00',
      }],
      pendingApprovals: [],
      buyerSupplierQualifications: {
        'rel-sunrise': [{
          id: 'qual-buyer-001',
          supplierId: 'ent-supplier-sunrise',
          qualificationType: '营业执照',
          certificateNo: 'Q-2026-001',
          expiresAt: '2027-12-31',
          fileName: '营业执照.pdf',
          storageKey: 'supplier/qualifications/business-license.pdf',
          status: 'active',
          createdAt: '2026-06-22T10:00:00+08:00',
        }],
      },
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
      qualifications: [{
        id: 'qual-buyer-001',
        supplierId: 'ent-supplier-sunrise',
        qualificationType: '营业执照',
        certificateNo: 'Q-2026-001',
        expiresAt: '2027-12-31',
        fileName: '营业执照.pdf',
        storageKey: 'supplier/qualifications/business-license.pdf',
        status: 'active',
        createdAt: '2026-06-22T10:00:00+08:00',
      }],
    }]);
    expect(nextWorkspace.suppliers[0]).toMatchObject({
      id: 'ent-supplier-sunrise',
      name: '晨光供应商',
      type: 'supplier',
    });
    expect(nextWorkspace.materials[0].code).toBe('IT-LAPTOP');
    expect(nextWorkspace.invoices[0]).toMatchObject({
      reconciliationNo: 'REC-invoice-java-001',
      reconciliationStage: '已完成',
      nextReconciliationAction: '归档对账',
      orderAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
    });
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
      orderAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      reconciliationStatus: '已完成',
      reconciliationNo: 'REC-invoice-java-001',
      reconciliationStage: '已完成',
      nextReconciliationAction: '归档对账',
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
        reviewComment: '待补充授权材料',
        profileConfirmed: true,
        riskConfirmed: false,
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
        reviewComment: '待补充授权材料',
        profileConfirmed: true,
        riskConfirmed: false,
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
        orderAmount: 118000,
        varianceAmount: 0,
        receiptStatus: '已收货',
        reconciliationStatus: '三单一致',
      }],
      invoiceReconciliations: [{
        id: 'recon-java-001',
        tenantId: 'tenant-acme',
        reconciliationNo: 'REC-invoice-java-001',
        invoiceId: 'invoice-java-001',
        supplierId: 'ent-supplier-sunrise',
        orderId: 'po-java-001',
        stage: '待付款',
        nextAction: '跟进回款',
        orderAmount: 118000,
        invoiceAmount: 118000,
        varianceAmount: 0,
        receiptStatus: '已收货',
        paymentStatus: '待付款',
        createdAt: '2026-06-15T13:10:00+08:00',
        updatedAt: '2026-06-15T13:20:00+08:00',
      }],
      notifications: [{
        id: 'notice-paid-001',
        tenantId: 'tenant-acme',
        recipientId: 'supplier-user-1',
        title: '发票已付款',
        content: '采购方已登记发票 INV-001 的付款状态：已付款。',
        read: false,
        createdAt: '2026-06-21T10:00:00+08:00',
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
    expect(nextWorkspace.invoices[0]).toMatchObject({
      reconciliationNo: 'REC-invoice-java-001',
      reconciliationStage: '待付款',
      nextReconciliationAction: '跟进回款',
      orderAmount: 118000,
      varianceAmount: 0,
      receiptStatus: '已收货',
      reconciliationStatus: '待付款',
    });
    expect(nextWorkspace.notifications?.[0].title).toBe('发票已付款');
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
