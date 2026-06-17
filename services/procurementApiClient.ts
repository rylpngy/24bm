import {
  buildProcurementMvpModel,
  getBuyerWorkspace,
  getSupplierWorkspace,
  getTenantKpis,
  type AuditLogRecord,
  type BuyerWorkspace,
  type DepartmentItem,
  type Delivery,
  type Enterprise,
  type InvoiceRecord,
  type MaterialItem,
  type ProcurementMvpModel,
  type PurchaseDemand,
  type PurchaseOrder,
  type Rfq,
  type RfqQuote,
  type SupplierLevel,
  type SupplierRelation,
  type SupplierRelationStatus,
  type SupplierWorkspace,
  type TenantKpis,
  type UserAccount,
} from '../data/procurementModel';
import type { AwardDecisionRecord } from '../server/procurementBackend';

export interface PlatformWorkspaceData {
  model: ProcurementMvpModel;
  tenants: ProcurementMvpModel['tenants'];
  enterprises: ProcurementMvpModel['enterprises'];
  platformOverview?: JavaPlatformOverviewDto;
}

export interface BuyerWorkspaceData {
  workspace: BuyerWorkspace;
  kpis: TenantKpis;
}

export type SupplierWorkspaceData = SupplierWorkspace;

export interface CreateDemandPayload {
  title: string;
  department: string;
  requester: string;
  budget: number;
  lineItems: PurchaseDemand['lineItems'];
}

export interface CreateRfqPayload {
  title: string;
  demandIds: string[];
  invitedSupplierIds: string[];
  deadline: string;
}

export interface SubmitQuotePayload {
  amount: number;
  taxRate: number;
  deliveryDays: number;
}

export interface AwardRfqPayload {
  quoteId: string;
  reason: string;
}

export interface CreateOrderPayload {
  awardId: string;
  expectedReceiptDate: string;
}

export interface CreateDeliveryPayload {
  carrier: string;
  trackingNo: string;
}

export interface CreateReceiptPayload {
  result: string;
}

export interface CreateInvoicePayload {
  amount: number;
  invoiceNo: string;
}

export interface RegisterPaymentPayload {
  paymentStatus: string;
}

export interface CreateDepartmentPayload {
  name: string;
  parentId?: string | null;
}

export interface ReviewApprovalPayload {
  approved: boolean;
}

export type AppRuntimeDataSource =
  | { mode: 'java'; javaApiBaseUrl: string }
  | { mode: 'mock' }
  | { mode: 'misconfigured'; message: string };

export const resolveAppRuntimeDataSource = (env: Record<string, string | undefined>): AppRuntimeDataSource => {
  if (env.VITE_DATA_SOURCE === 'mock') {
    return { mode: 'mock' };
  }

  if (env.VITE_DATA_SOURCE && env.VITE_DATA_SOURCE !== 'java') {
    return {
      mode: 'misconfigured',
      message: 'VITE_DATA_SOURCE must be java or mock.',
    };
  }

  if (env.VITE_JAVA_API_BASE_URL) {
    return { mode: 'java', javaApiBaseUrl: env.VITE_JAVA_API_BASE_URL };
  }

  return {
    mode: 'misconfigured',
    message: 'VITE_JAVA_API_BASE_URL is required unless VITE_DATA_SOURCE=mock is set.',
  };
};

export interface ProcurementApiClient {
  getPlatformWorkspace(): Promise<PlatformWorkspaceData>;
  getBuyerWorkspace(tenantId: string): Promise<BuyerWorkspaceData>;
  getSupplierWorkspace(supplierId: string): Promise<SupplierWorkspaceData>;
  listDemands(): Promise<PurchaseDemand[]>;
  createDemand(payload: CreateDemandPayload): Promise<PurchaseDemand>;
  createRfq(payload: CreateRfqPayload): Promise<Rfq>;
  submitQuote(rfqId: string, payload: SubmitQuotePayload): Promise<RfqQuote>;
  awardRfq(rfqId: string, payload: AwardRfqPayload): Promise<AwardDecisionRecord>;
  createOrder(payload: CreateOrderPayload): Promise<PurchaseOrder>;
}

const model = buildProcurementMvpModel();

export const mockApiClient: ProcurementApiClient = {
  async getPlatformWorkspace() {
    return {
      model,
      tenants: model.tenants,
      enterprises: model.enterprises,
    };
  },
  async getBuyerWorkspace(tenantId: string) {
    return {
      workspace: getBuyerWorkspace(model, tenantId),
      kpis: getTenantKpis(model, tenantId),
    };
  },
  async getSupplierWorkspace(supplierId: string) {
    return getSupplierWorkspace(model, supplierId);
  },
  async listDemands() {
    return getBuyerWorkspace(model, 'tenant-acme').demands;
  },
  async createDemand(payload: CreateDemandPayload) {
    const demand: PurchaseDemand = {
      id: `mock-demand-${Date.now()}`,
      tenantId: 'tenant-acme',
      status: '草稿',
      ...payload,
    };
    model.demands.push(demand);
    return demand;
  },
  async createRfq(payload: CreateRfqPayload) {
    const rfq: Rfq = {
      id: `mock-rfq-${Date.now()}`,
      tenantId: 'tenant-acme',
      status: '报价中',
      owner: 'u-acme-admin',
      quotes: [],
      ...payload,
    };
    model.rfqs.push(rfq);
    return rfq;
  },
  async submitQuote(rfqId: string, payload: SubmitQuotePayload) {
    const quote: RfqQuote = {
      id: `mock-quote-${Date.now()}`,
      rfqId,
      tenantId: 'tenant-acme',
      supplierId: 'supplier-orbit',
      status: '已提交',
      ...payload,
    };
    const rfq = model.rfqs.find((item) => item.id === rfqId);
    rfq?.quotes.push(quote);
    return quote;
  },
  async awardRfq(rfqId: string, payload: AwardRfqPayload) {
    const rfq = model.rfqs.find((item) => item.id === rfqId);
    const quote = rfq?.quotes.find((item) => item.id === payload.quoteId);
    if (!rfq || !quote) throw new Error('Mock RFQ quote not found.');
    rfq.status = '已定标';
    rfq.awardedSupplierId = quote.supplierId;
    return {
      id: `mock-award-${Date.now()}`,
      tenantId: rfq.tenantId,
      rfqId,
      quoteId: quote.id,
      supplierId: quote.supplierId,
      amount: quote.amount,
      reason: payload.reason,
      approvedStatus: '已通过',
    };
  },
  async createOrder(payload: CreateOrderPayload) {
    const order: PurchaseOrder = {
      id: `mock-order-${Date.now()}`,
      tenantId: 'tenant-acme',
      rfqId: payload.awardId,
      supplierId: 'supplier-orbit',
      amount: 0,
      status: '待供应商确认',
      expectedReceiptDate: payload.expectedReceiptDate,
    };
    model.orders.push(order);
    return order;
  },
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpApiClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
  platform?: { userId: string };
  buyer: { tenantId: string; userId: string };
  supplier: { supplierId: string; userId: string };
}

export type JavaIdentityScope = 'PLATFORM' | 'BUYER' | 'SUPPLIER';

export interface JavaLoginPayload {
  account: string;
  password: string;
  scope: JavaIdentityScope;
  tenantId?: string;
  supplierId?: string;
}

export interface JavaLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userId: string;
  displayName: string;
  scope: JavaIdentityScope;
  tenantId: string | null;
  supplierId: string | null;
  roles: string[];
}

export interface BuyerSupplierRelationDto {
  id: string;
  tenantId: string;
  supplierId: string;
  supplierName: string;
  status: string;
  level: string;
  categories: string[];
  performanceScore: number;
}

export interface MaterialDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
}

export interface DepartmentDto {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  status: string;
}

export interface BuyerRoleDto {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
}

export interface BuyerUserDto {
  id: string;
  tenantId: string;
  name: string;
  mobile: string | null;
  email: string | null;
  status: string;
  departmentId: string;
  roleId: string;
}

export interface JavaPurchaseDemandDto {
  id: string;
  tenantId: string;
  title: string;
  departmentId: string;
  requesterId: string;
  budget: number;
  status: string;
  lineItems: Array<{
    id: string;
    materialId: string;
    quantity: number;
  }>;
}

export interface JavaApprovalTaskDto {
  id: string;
  tenantId: string;
  bizType: string;
  bizId: string;
  parentBizId?: string | null;
  summaryTitle?: string;
  businessStatus?: string;
  priority?: number;
  submittedById?: string | null;
  submittedByName?: string | null;
  amount?: number | null;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  assigneeId: string | null;
  status: string;
  createdAt: string;
  actedAt?: string | null;
}

export interface JavaApprovalTemplateDto {
  templateCode: string;
  bizType: string;
  name: string;
  defaultApproverRoleId: string;
  status: string;
}

export interface JavaNotificationDto {
  id: string;
  tenantId: string;
  recipientId: string;
  title: string;
  content: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface UpdateApprovalTemplatePayload {
  defaultApproverRoleId: string;
  status: 'active' | 'inactive';
}

export interface JavaRfqDto {
  id: string;
  tenantId: string;
  title: string;
  status: string;
  deadlineAt: string;
  ownerId: string;
  awardedSupplierId: string | null;
  demandIds: string[];
  invitedSupplierIds: string[];
  quotes?: JavaQuoteDto[];
}

export interface JavaQuoteDto {
  id: string;
  tenantId: string;
  rfqId: string;
  supplierId: string;
  amount: number;
  taxRate: number;
  deliveryDays: number;
  status: string;
}

export interface JavaAwardDecisionDto {
  id: string;
  tenantId: string;
  rfqId: string;
  quoteId: string;
  supplierId: string;
  amount: number;
  reason: string;
  approvedStatus: string;
  createdAt: string;
}

export interface JavaPurchaseOrderDto {
  id: string;
  tenantId: string;
  rfqId: string;
  supplierId: string;
  amount: number;
  status: string;
  expectedReceiptDate: string;
}

export interface JavaDeliveryDto {
  id: string;
  tenantId: string;
  orderId: string;
  supplierId: string;
  carrier: string;
  trackingNo: string;
  status: string;
  createdAt: string;
}

export interface JavaReceiptDto {
  id: string;
  tenantId: string;
  orderId: string;
  receiverId: string;
  result: string;
  receivedAt: string;
}

export interface JavaInvoiceDto {
  id: string;
  tenantId: string;
  supplierId: string;
  orderId: string;
  amount: number;
  invoiceNo: string;
  paymentStatus: string;
}

export interface JavaSupplierProfileDto {
  id: string;
  name: string;
  type: 'supplier';
  industry: string;
  verified: boolean;
  connectedBuyerNames: string[];
}

export interface JavaPlatformOverviewDto {
  scope: 'platform';
  tenantCount: number;
  publicSupplierCount: number;
  pendingEnterpriseReviews: number;
}

export interface JavaPlatformTenantDto {
  id: string;
  name: string;
  plan: string;
  status: string;
  enabledFeatures: string[];
  userLimit: number;
}

export interface JavaEnterpriseReviewDto {
  id: string;
  name: string;
  type: Enterprise['type'];
  verified: boolean;
  reviewStatus: string;
}

export interface JavaAuditLogDto extends AuditLogRecord {}

export interface JavaProcurementApiClient {
  loginPlatform(): Promise<JavaLoginResponse>;
  loginBuyer(): Promise<JavaLoginResponse>;
  loginSupplier(): Promise<JavaLoginResponse>;
  getPlatformWorkspace(): Promise<JavaPlatformWorkspaceData>;
  getPlatformOverview(): Promise<JavaPlatformOverviewDto>;
  listPlatformTenants(): Promise<JavaPlatformTenantDto[]>;
  listPlatformEnterpriseReviews(): Promise<JavaEnterpriseReviewDto[]>;
  getBuyerWorkspace(): Promise<JavaBuyerMasterData>;
  listBuyerSuppliers(): Promise<BuyerSupplierRelationDto[]>;
  submitBuyerSupplierAdmission(relationId: string): Promise<JavaApprovalTaskDto>;
  listBuyerMaterials(): Promise<MaterialDto[]>;
  listBuyerDepartments(): Promise<DepartmentDto[]>;
  createBuyerDepartment(payload: CreateDepartmentPayload): Promise<DepartmentDto>;
  disableBuyerDepartment(departmentId: string): Promise<DepartmentDto>;
  listBuyerRoles(): Promise<BuyerRoleDto[]>;
  listBuyerUsers(): Promise<BuyerUserDto[]>;
  changeBuyerUserRole(userId: string, roleId: string): Promise<BuyerUserDto>;
  changeBuyerUserStatus(userId: string, status: 'active' | 'inactive'): Promise<BuyerUserDto>;
  listBuyerDemands(): Promise<PurchaseDemand[]>;
  createBuyerDemand(payload: CreateDemandPayload): Promise<PurchaseDemand>;
  submitBuyerDemand(demandId: string): Promise<JavaApprovalTaskDto>;
  listBuyerPendingApprovals(): Promise<JavaApprovalTaskDto[]>;
  listBuyerRecentApprovals(): Promise<JavaApprovalTaskDto[]>;
  listBuyerNotifications(): Promise<JavaNotificationDto[]>;
  listBuyerApprovalTemplates(): Promise<JavaApprovalTemplateDto[]>;
  updateBuyerApprovalTemplate(
    templateCode: string,
    payload: UpdateApprovalTemplatePayload,
  ): Promise<JavaApprovalTemplateDto>;
  listBuyerAuditLogs(): Promise<JavaAuditLogDto[]>;
  reviewBuyerDemandApproval(demandId: string, approved: boolean): Promise<JavaApprovalTaskDto>;
  reviewBuyerSupplierAdmission(relationId: string, approved: boolean): Promise<JavaApprovalTaskDto>;
  reviewBuyerAwardApproval(rfqId: string, awardId: string, approved: boolean): Promise<JavaAwardDecisionDto>;
  listBuyerRfqs(): Promise<Rfq[]>;
  createBuyerRfq(payload: CreateRfqPayload): Promise<Rfq>;
  submitSupplierQuote(rfqId: string, payload: SubmitQuotePayload): Promise<RfqQuote>;
  awardBuyerRfq(rfqId: string, payload: AwardRfqPayload): Promise<JavaAwardDecisionDto>;
  listBuyerOrders(): Promise<PurchaseOrder[]>;
  createBuyerOrder(payload: CreateOrderPayload): Promise<PurchaseOrder>;
  confirmSupplierOrder(orderId: string): Promise<PurchaseOrder>;
  createSupplierDelivery(orderId: string, payload: CreateDeliveryPayload): Promise<Delivery>;
  createBuyerReceipt(orderId: string, payload: CreateReceiptPayload): Promise<JavaReceiptDto>;
  listBuyerInvoices(): Promise<InvoiceRecord[]>;
  createSupplierInvoice(orderId: string, payload: CreateInvoicePayload): Promise<InvoiceRecord>;
  registerBuyerPayment(invoiceId: string, payload: RegisterPaymentPayload): Promise<InvoiceRecord>;
  getSupplierWorkspace(): Promise<JavaSupplierWorkspaceData>;
  getSupplierProfile(): Promise<JavaSupplierProfileDto>;
  listSupplierRfqs(): Promise<Rfq[]>;
  listSupplierQuotes(): Promise<RfqQuote[]>;
  listSupplierOrders(): Promise<PurchaseOrder[]>;
  listSupplierInvoices(): Promise<InvoiceRecord[]>;
}

export interface JavaBuyerMasterData {
  suppliers: BuyerSupplierRelationDto[];
  materials: MaterialDto[];
  departments?: DepartmentDto[];
  users: BuyerUserDto[];
  roles: BuyerRoleDto[];
  demands: PurchaseDemand[];
  rfqs: Rfq[];
  orders: PurchaseOrder[];
  invoices: InvoiceRecord[];
  pendingApprovals: JavaApprovalTaskDto[];
  recentApprovals: JavaApprovalTaskDto[];
  notifications: JavaNotificationDto[];
  approvalTemplates: JavaApprovalTemplateDto[];
  auditLogs: JavaAuditLogDto[];
}

export interface JavaSupplierWorkspaceData {
  profile: JavaSupplierProfileDto;
  opportunities: Rfq[];
  quotes: RfqQuote[];
  orders: PurchaseOrder[];
  invoices: InvoiceRecord[];
}

export interface JavaPlatformWorkspaceData {
  overview: JavaPlatformOverviewDto;
  tenants: JavaPlatformTenantDto[];
  enterpriseReviews: JavaEnterpriseReviewDto[];
}

export interface JavaMvpWorkflowResult {
  rfq: Rfq;
  quote: RfqQuote;
  award: JavaAwardDecisionDto;
  order: PurchaseOrder;
  confirmedOrder: PurchaseOrder;
  delivery: Delivery;
  receipt: JavaReceiptDto;
  invoice: InvoiceRecord;
  paidInvoice: InvoiceRecord;
}

export interface JavaMvpWorkflowOptions {
  now?: Date;
  title?: string;
}

export interface JavaProcurementApiClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
  platformLogin?: JavaLoginPayload;
  buyerLogin: JavaLoginPayload;
  supplierLogin?: JavaLoginPayload;
}

const parseData = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? `API request failed with ${response.status}`);
  }
  return payload?.data as T;
};

export const createHttpApiClient = (options: HttpApiClientOptions): ProcurementApiClient => {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? '';
  const buyerHeaders = {
    'content-type': 'application/json',
    'X-Tenant-Id': options.buyer.tenantId,
    'X-User-Id': options.buyer.userId,
  };
  const supplierHeaders = {
    'content-type': 'application/json',
    'X-Supplier-Id': options.supplier.supplierId,
    'X-User-Id': options.supplier.userId,
  };
  const platformHeaders = {
    'content-type': 'application/json',
    'X-User-Id': options.platform?.userId ?? 'u-platform',
  };

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetcher(`${baseUrl}${path}`, init);
    return parseData<T>(response);
  };

  return {
    async getPlatformWorkspace() {
      return request<PlatformWorkspaceData>('/api/v1/platform/workspace', { headers: platformHeaders });
    },
    async getBuyerWorkspace() {
      return request<BuyerWorkspaceData>('/api/v1/buyer/workspace', { headers: buyerHeaders });
    },
    async getSupplierWorkspace() {
      return request<SupplierWorkspaceData>('/api/v1/supplier/workspace', { headers: supplierHeaders });
    },
    async listDemands() {
      return request<PurchaseDemand[]>('/api/v1/buyer/demands', { headers: buyerHeaders });
    },
    async createDemand(payload: CreateDemandPayload) {
      return request<PurchaseDemand>('/api/v1/buyer/demands', {
        method: 'POST',
        headers: buyerHeaders,
        body: JSON.stringify(payload),
      });
    },
    async createRfq(payload: CreateRfqPayload) {
      return request<Rfq>('/api/v1/buyer/rfqs', {
        method: 'POST',
        headers: buyerHeaders,
        body: JSON.stringify(payload),
      });
    },
    async submitQuote(rfqId: string, payload: SubmitQuotePayload) {
      return request<RfqQuote>(`/api/v1/supplier/rfqs/${rfqId}/quotes`, {
        method: 'POST',
        headers: supplierHeaders,
        body: JSON.stringify(payload),
      });
    },
    async awardRfq(rfqId: string, payload: AwardRfqPayload) {
      return request<AwardDecisionRecord>(`/api/v1/buyer/rfqs/${rfqId}/award`, {
        method: 'POST',
        headers: buyerHeaders,
        body: JSON.stringify(payload),
      });
    },
    async createOrder(payload: CreateOrderPayload) {
      return request<PurchaseOrder>('/api/v1/buyer/orders', {
        method: 'POST',
        headers: buyerHeaders,
        body: JSON.stringify(payload),
      });
    },
  };
};

export const createDemoHttpApiClient = (baseUrl: string): ProcurementApiClient =>
  createHttpApiClient({
    baseUrl,
    platform: { userId: 'u-platform' },
    buyer: { tenantId: 'tenant-acme', userId: 'u-acme-admin' },
    supplier: { supplierId: 'supplier-orbit', userId: 'u-orbit-sales' },
  });

export const createJavaProcurementApiClient = (options: JavaProcurementApiClientOptions): JavaProcurementApiClient => {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? '';
  let platformSession: JavaLoginResponse | null = null;
  let buyerSession: JavaLoginResponse | null = null;
  let supplierSession: JavaLoginResponse | null = null;
  let platformLoginPromise: Promise<JavaLoginResponse> | null = null;
  let buyerLoginPromise: Promise<JavaLoginResponse> | null = null;
  let supplierLoginPromise: Promise<JavaLoginResponse> | null = null;

  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetcher(`${baseUrl}${path}`, init);
    return parseData<T>(response);
  };

  const loginBuyer = async (): Promise<JavaLoginResponse> => {
    if (buyerSession) return buyerSession;
    if (buyerLoginPromise) return buyerLoginPromise;
    buyerLoginPromise = request<JavaLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.buyerLogin),
    });
    try {
      buyerSession = await buyerLoginPromise;
      return buyerSession;
    } finally {
      buyerLoginPromise = null;
    }
  };

  const loginPlatform = async (): Promise<JavaLoginResponse> => {
    if (platformSession) return platformSession;
    if (!options.platformLogin) {
      throw new Error('Platform login is required for Java platform APIs.');
    }
    if (platformLoginPromise) return platformLoginPromise;
    platformLoginPromise = request<JavaLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.platformLogin),
    });
    try {
      platformSession = await platformLoginPromise;
      return platformSession;
    } finally {
      platformLoginPromise = null;
    }
  };

  const loginSupplier = async (): Promise<JavaLoginResponse> => {
    if (supplierSession) return supplierSession;
    if (!options.supplierLogin) {
      throw new Error('Supplier login is required for Java supplier APIs.');
    }
    if (supplierLoginPromise) return supplierLoginPromise;
    supplierLoginPromise = request<JavaLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.supplierLogin),
    });
    try {
      supplierSession = await supplierLoginPromise;
      return supplierSession;
    } finally {
      supplierLoginPromise = null;
    }
  };

  const buyerRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const session = await loginBuyer();
    return request<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
    });
  };

  const platformRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const session = await loginPlatform();
    return request<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
    });
  };

  const supplierRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const session = await loginSupplier();
    return request<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `${session.tokenType} ${session.accessToken}`,
      },
    });
  };

  const toPurchaseDemand = (demand: JavaPurchaseDemandDto): PurchaseDemand => ({
    id: demand.id,
    tenantId: demand.tenantId,
    title: demand.title,
    department: demand.departmentId,
    requester: demand.requesterId,
    budget: Number(demand.budget),
    status: demand.status as PurchaseDemand['status'],
    lineItems: demand.lineItems.map((item) => ({
      materialId: item.materialId,
      quantity: Number(item.quantity),
    })),
  });

  const toRfq = (rfq: JavaRfqDto): Rfq => ({
    id: rfq.id,
    tenantId: rfq.tenantId,
    demandIds: rfq.demandIds,
    title: rfq.title,
    status: rfq.status as Rfq['status'],
    deadline: rfq.deadlineAt,
    owner: rfq.ownerId,
    invitedSupplierIds: rfq.invitedSupplierIds,
    awardedSupplierId: rfq.awardedSupplierId ?? undefined,
    quotes: (rfq.quotes ?? []).map(toQuote),
  });

  const toQuote = (quote: JavaQuoteDto): RfqQuote => ({
    id: quote.id,
    rfqId: quote.rfqId,
    tenantId: quote.tenantId,
    supplierId: quote.supplierId,
    amount: Number(quote.amount),
    taxRate: Number(quote.taxRate),
    deliveryDays: quote.deliveryDays,
    status: quote.status as RfqQuote['status'],
  });

  const toPurchaseOrder = (order: JavaPurchaseOrderDto): PurchaseOrder => ({
    id: order.id,
    tenantId: order.tenantId,
    supplierId: order.supplierId,
    rfqId: order.rfqId,
    amount: Number(order.amount),
    status: order.status as PurchaseOrder['status'],
    expectedReceiptDate: order.expectedReceiptDate,
  });

  const toDelivery = (delivery: JavaDeliveryDto): Delivery => ({
    id: delivery.id,
    tenantId: delivery.tenantId,
    supplierId: delivery.supplierId,
    orderId: delivery.orderId,
    carrier: delivery.carrier,
    trackingNo: delivery.trackingNo,
    status: delivery.status as Delivery['status'],
  });

  const toInvoice = (invoice: JavaInvoiceDto): InvoiceRecord => ({
    id: invoice.id,
    tenantId: invoice.tenantId,
    supplierId: invoice.supplierId,
    orderId: invoice.orderId,
    amount: Number(invoice.amount),
    paymentStatus: invoice.paymentStatus as InvoiceRecord['paymentStatus'],
  });

  return {
    loginPlatform,
    loginBuyer,
    loginSupplier,
    getPlatformWorkspace() {
      return platformRequest<JavaPlatformWorkspaceData>('/api/v1/platform/workspace');
    },
    getPlatformOverview() {
      return platformRequest<JavaPlatformOverviewDto>('/api/v1/platform/overview');
    },
    listPlatformTenants() {
      return platformRequest<JavaPlatformTenantDto[]>('/api/v1/platform/tenants');
    },
    listPlatformEnterpriseReviews() {
      return platformRequest<JavaEnterpriseReviewDto[]>('/api/v1/platform/enterprise-reviews');
    },
    getBuyerWorkspace() {
      return buyerRequest<Omit<JavaBuyerMasterData, 'demands' | 'rfqs' | 'orders' | 'invoices'> & {
        demands: JavaPurchaseDemandDto[];
        rfqs: JavaRfqDto[];
        orders: JavaPurchaseOrderDto[];
        invoices: JavaInvoiceDto[];
      }>('/api/v1/buyer/workspace')
        .then((workspace) => ({
          ...workspace,
          demands: workspace.demands.map(toPurchaseDemand),
          rfqs: workspace.rfqs.map(toRfq),
          orders: workspace.orders.map(toPurchaseOrder),
          invoices: workspace.invoices.map(toInvoice),
        }));
    },
    listBuyerSuppliers() {
      return buyerRequest<BuyerSupplierRelationDto[]>('/api/v1/buyer/suppliers');
    },
    submitBuyerSupplierAdmission(relationId: string) {
      return buyerRequest<JavaApprovalTaskDto>(`/api/v1/buyer/suppliers/${relationId}/submit`, {
        method: 'POST',
      });
    },
    listBuyerMaterials() {
      return buyerRequest<MaterialDto[]>('/api/v1/buyer/materials');
    },
    listBuyerDepartments() {
      return buyerRequest<DepartmentDto[]>('/api/v1/buyer/departments');
    },
    createBuyerDepartment(payload: CreateDepartmentPayload) {
      return buyerRequest<DepartmentDto>('/api/v1/buyer/departments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    disableBuyerDepartment(departmentId: string) {
      return buyerRequest<DepartmentDto>(`/api/v1/buyer/departments/${departmentId}/disable`, {
        method: 'POST',
      });
    },
    listBuyerRoles() {
      return buyerRequest<BuyerRoleDto[]>('/api/v1/buyer/roles');
    },
    listBuyerUsers() {
      return buyerRequest<BuyerUserDto[]>('/api/v1/buyer/users');
    },
    changeBuyerUserRole(userId: string, roleId: string) {
      return buyerRequest<BuyerUserDto>(`/api/v1/buyer/users/${userId}/role`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
    },
    changeBuyerUserStatus(userId: string, status: 'active' | 'inactive') {
      return buyerRequest<BuyerUserDto>(`/api/v1/buyer/users/${userId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    },
    async listBuyerDemands() {
      const demands = await buyerRequest<JavaPurchaseDemandDto[]>('/api/v1/buyer/demands');
      return demands.map(toPurchaseDemand);
    },
    async createBuyerDemand(payload: CreateDemandPayload) {
      const demand = await buyerRequest<JavaPurchaseDemandDto>('/api/v1/buyer/demands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          departmentId: payload.department,
          budget: payload.budget,
          lineItems: payload.lineItems,
        }),
      });
      return toPurchaseDemand(demand);
    },
    submitBuyerDemand(demandId: string) {
      return buyerRequest<JavaApprovalTaskDto>(`/api/v1/buyer/demands/${demandId}/submit`, {
        method: 'POST',
      });
    },
    listBuyerPendingApprovals() {
      return buyerRequest<JavaApprovalTaskDto[]>('/api/v1/buyer/approvals/pending');
    },
    listBuyerRecentApprovals() {
      return buyerRequest<JavaApprovalTaskDto[]>('/api/v1/buyer/approvals/recent');
    },
    listBuyerNotifications() {
      return buyerRequest<JavaNotificationDto[]>('/api/v1/buyer/notifications');
    },
    listBuyerApprovalTemplates() {
      return buyerRequest<JavaApprovalTemplateDto[]>('/api/v1/buyer/approvals/templates');
    },
    updateBuyerApprovalTemplate(templateCode: string, payload: UpdateApprovalTemplatePayload) {
      return buyerRequest<JavaApprovalTemplateDto>(`/api/v1/buyer/approvals/templates/${templateCode}/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    listBuyerAuditLogs() {
      return buyerRequest<JavaAuditLogDto[]>('/api/v1/buyer/audit-logs');
    },
    reviewBuyerDemandApproval(demandId: string, approved: boolean) {
      return buyerRequest<JavaApprovalTaskDto>(`/api/v1/buyer/demands/${demandId}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
    },
    reviewBuyerSupplierAdmission(relationId: string, approved: boolean) {
      return buyerRequest<JavaApprovalTaskDto>(`/api/v1/buyer/suppliers/${relationId}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
    },
    reviewBuyerAwardApproval(rfqId: string, awardId: string, approved: boolean) {
      return buyerRequest<JavaAwardDecisionDto>(`/api/v1/buyer/rfqs/${rfqId}/award/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ awardId, approved }),
      });
    },
    async listBuyerRfqs() {
      const rfqs = await buyerRequest<JavaRfqDto[]>('/api/v1/buyer/rfqs');
      return rfqs.map(toRfq);
    },
    async createBuyerRfq(payload: CreateRfqPayload) {
      const rfq = await buyerRequest<JavaRfqDto>('/api/v1/buyer/rfqs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          demandIds: payload.demandIds,
          invitedSupplierIds: payload.invitedSupplierIds,
          deadlineAt: payload.deadline,
        }),
      });
      return toRfq(rfq);
    },
    async submitSupplierQuote(rfqId: string, payload: SubmitQuotePayload) {
      const quote = await supplierRequest<JavaQuoteDto>(`/api/v1/supplier/rfqs/${rfqId}/quotes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return toQuote(quote);
    },
    awardBuyerRfq(rfqId: string, payload: AwardRfqPayload) {
      return buyerRequest<JavaAwardDecisionDto>(`/api/v1/buyer/rfqs/${rfqId}/award`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async listBuyerOrders() {
      const orders = await buyerRequest<JavaPurchaseOrderDto[]>('/api/v1/buyer/orders');
      return orders.map(toPurchaseOrder);
    },
    async createBuyerOrder(payload: CreateOrderPayload) {
      const order = await buyerRequest<JavaPurchaseOrderDto>('/api/v1/buyer/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return toPurchaseOrder(order);
    },
    async confirmSupplierOrder(orderId: string) {
      const order = await supplierRequest<JavaPurchaseOrderDto>(`/api/v1/supplier/orders/${orderId}/confirm`, {
        method: 'POST',
      });
      return toPurchaseOrder(order);
    },
    async createSupplierDelivery(orderId: string, payload: CreateDeliveryPayload) {
      const delivery = await supplierRequest<JavaDeliveryDto>(`/api/v1/supplier/orders/${orderId}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return toDelivery(delivery);
    },
    createBuyerReceipt(orderId: string, payload: CreateReceiptPayload) {
      return buyerRequest<JavaReceiptDto>(`/api/v1/buyer/orders/${orderId}/receipts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    async listBuyerInvoices() {
      const invoices = await buyerRequest<JavaInvoiceDto[]>('/api/v1/buyer/invoices');
      return invoices.map(toInvoice);
    },
    async createSupplierInvoice(orderId: string, payload: CreateInvoicePayload) {
      const invoice = await supplierRequest<JavaInvoiceDto>(`/api/v1/supplier/orders/${orderId}/invoices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return toInvoice(invoice);
    },
    async registerBuyerPayment(invoiceId: string, payload: RegisterPaymentPayload) {
      const invoice = await buyerRequest<JavaInvoiceDto>(`/api/v1/buyer/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return toInvoice(invoice);
    },
    async getSupplierWorkspace() {
      const workspace = await supplierRequest<{
        profile: JavaSupplierProfileDto;
        opportunities: JavaRfqDto[];
        quotes: JavaQuoteDto[];
        orders: JavaPurchaseOrderDto[];
        invoices: JavaInvoiceDto[];
      }>('/api/v1/supplier/workspace');
      return {
        profile: workspace.profile,
        opportunities: workspace.opportunities.map(toRfq),
        quotes: workspace.quotes.map(toQuote),
        orders: workspace.orders.map(toPurchaseOrder),
        invoices: workspace.invoices.map(toInvoice),
      };
    },
    getSupplierProfile() {
      return supplierRequest<JavaSupplierProfileDto>('/api/v1/supplier/profile');
    },
    async listSupplierRfqs() {
      const rfqs = await supplierRequest<JavaRfqDto[]>('/api/v1/supplier/rfqs');
      return rfqs.map(toRfq);
    },
    async listSupplierQuotes() {
      const quotes = await supplierRequest<JavaQuoteDto[]>('/api/v1/supplier/quotes');
      return quotes.map(toQuote);
    },
    async listSupplierOrders() {
      const orders = await supplierRequest<JavaPurchaseOrderDto[]>('/api/v1/supplier/orders');
      return orders.map(toPurchaseOrder);
    },
    async listSupplierInvoices() {
      const invoices = await supplierRequest<JavaInvoiceDto[]>('/api/v1/supplier/invoices');
      return invoices.map(toInvoice);
    },
  };
};

export const loadJavaBuyerMasterData = async (client: JavaProcurementApiClient): Promise<JavaBuyerMasterData> => {
  const [workspace, departments, roles, approvalTemplates] = await Promise.all([
    client.getBuyerWorkspace(),
    client.listBuyerDepartments(),
    client.listBuyerRoles(),
    client.listBuyerApprovalTemplates(),
  ]);
  return {
    ...workspace,
    departments,
    roles,
    approvalTemplates,
  };
};

export const applyJavaBuyerMasterData = (
  workspace: BuyerWorkspace,
  masterData: JavaBuyerMasterData,
): BuyerWorkspace => {
  const privateSupplierRelations: SupplierRelation[] = masterData.suppliers.map((supplier) => ({
    id: supplier.id,
    tenantId: supplier.tenantId,
    supplierId: supplier.supplierId,
    status: supplier.status as SupplierRelationStatus,
    level: supplier.level as SupplierLevel,
    categories: supplier.categories,
    performanceScore: supplier.performanceScore,
  }));

  const suppliers: Enterprise[] = masterData.suppliers.map((supplier) => ({
    id: supplier.supplierId,
    name: supplier.supplierName,
    type: 'supplier',
    industry: supplier.categories[0] ?? '供应商',
    verified: supplier.status === '已准入',
  }));

  const materials: MaterialItem[] = masterData.materials.map((material) => ({
    id: material.id,
    tenantId: material.tenantId,
    code: material.code,
    name: material.name,
    category: material.category,
    unit: material.unit,
    referencePrice: material.referencePrice,
  }));

  const users: UserAccount[] = masterData.users.map((user) => ({
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    role: '采购用户',
    scope: 'buyer',
  }));

  const departments: DepartmentItem[] = (masterData.departments ?? []).map((department) => ({
    id: department.id,
    tenantId: department.tenantId,
    name: department.name,
    parentId: department.parentId,
    status: department.status,
  }));

  return {
    ...workspace,
    users,
    departments,
    demands: masterData.demands,
    rfqs: masterData.rfqs,
    orders: masterData.orders,
    invoices: masterData.invoices,
    auditLogs: masterData.auditLogs,
    privateSupplierRelations,
    suppliers,
    materials,
  };
};

const toTenantPlan = (plan: string): ProcurementMvpModel['tenants'][number]['plan'] => {
  const planMap: Record<string, ProcurementMvpModel['tenants'][number]['plan']> = {
    MVP: '标准版',
    starter: '标准版',
    standard: '标准版',
    professional: '专业版',
    enterprise: '旗舰版',
  };
  return planMap[plan] ?? (plan as ProcurementMvpModel['tenants'][number]['plan']);
};

const toTenantStatus = (status: string): ProcurementMvpModel['tenants'][number]['status'] => {
  const statusMap: Record<string, ProcurementMvpModel['tenants'][number]['status']> = {
    active: '已启用',
    trial: '试用中',
    pending: '待审核',
  };
  return statusMap[status] ?? (status as ProcurementMvpModel['tenants'][number]['status']);
};

export const loadJavaPlatformWorkspaceData = async (
  client: JavaProcurementApiClient,
): Promise<JavaPlatformWorkspaceData> => {
  return client.getPlatformWorkspace();
};

export const applyJavaPlatformWorkspaceData = (
  workspace: PlatformWorkspaceData,
  platformData: JavaPlatformWorkspaceData,
): PlatformWorkspaceData => {
  const tenants: ProcurementMvpModel['tenants'] = platformData.tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    plan: toTenantPlan(tenant.plan),
    status: toTenantStatus(tenant.status),
    enabledFeatures: tenant.enabledFeatures,
    userLimit: tenant.userLimit,
  }));

  const buyerEnterprises: Enterprise[] = platformData.tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    type: 'buyer',
    industry: '采购企业',
    verified: tenant.status === 'active' || tenant.status === '已启用',
  }));

  const reviewEnterprises: Enterprise[] = platformData.enterpriseReviews.map((enterprise) => ({
    id: enterprise.id,
    name: enterprise.name,
    type: enterprise.type,
    industry: enterprise.type === 'supplier' ? '待审核企业' : '平台企业',
    verified: enterprise.verified,
  }));

  const nextModel: ProcurementMvpModel = {
    ...workspace.model,
    tenants,
    enterprises: [...buyerEnterprises, ...reviewEnterprises],
  };

  return {
    ...workspace,
    model: nextModel,
    tenants,
    enterprises: nextModel.enterprises,
    platformOverview: platformData.overview,
  };
};

export const loadJavaSupplierWorkspaceData = async (
  client: JavaProcurementApiClient,
): Promise<JavaSupplierWorkspaceData> => {
  return client.getSupplierWorkspace();
};

export const applyJavaSupplierWorkspaceData = (
  workspace: SupplierWorkspace,
  supplierData: JavaSupplierWorkspaceData,
): SupplierWorkspace => {
  const opportunities = supplierData.opportunities.map((rfq) => ({
    ...rfq,
    quotes: supplierData.quotes.filter((quote) => quote.rfqId === rfq.id),
  }));

  return {
    ...workspace,
    supplier: {
      id: supplierData.profile.id,
      name: supplierData.profile.name,
      type: 'supplier',
      industry: supplierData.profile.industry,
      verified: supplierData.profile.verified,
    },
    connectedBuyerNames: supplierData.profile.connectedBuyerNames,
    opportunities,
    quotes: supplierData.quotes,
    orders: supplierData.orders,
    invoices: supplierData.invoices,
  };
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const compactTimestamp = (date: Date) =>
  date.toISOString().replace(/\D/g, '').slice(0, 12);

export const runJavaMvpWorkflow = async (
  client: Pick<
    JavaProcurementApiClient,
    | 'listBuyerDemands'
    | 'listBuyerSuppliers'
    | 'createBuyerRfq'
    | 'submitSupplierQuote'
    | 'awardBuyerRfq'
    | 'createBuyerOrder'
    | 'confirmSupplierOrder'
    | 'createSupplierDelivery'
    | 'createBuyerReceipt'
    | 'createSupplierInvoice'
    | 'registerBuyerPayment'
  >,
  options: JavaMvpWorkflowOptions = {},
): Promise<JavaMvpWorkflowResult> => {
  const now = options.now ?? new Date();
  const [demands, suppliers] = await Promise.all([
    client.listBuyerDemands(),
    client.listBuyerSuppliers(),
  ]);

  const demand = demands.find((item) => item.status === '已通过') ?? demands[0];
  if (!demand) {
    throw new Error('Java MVP workflow requires at least one purchase demand.');
  }

  const supplier = suppliers.find((item) => item.status === '已准入') ?? suppliers[0];
  if (!supplier) {
    throw new Error('Java MVP workflow requires at least one buyer supplier relation.');
  }

  const rfq = await client.createBuyerRfq({
    title: options.title ?? 'Java MVP 全流程联调',
    demandIds: [demand.id],
    invitedSupplierIds: [supplier.supplierId],
    deadline: addDays(now, 14).toISOString(),
  });

  const quoteAmount = Math.max(1, Math.round(demand.budget * 0.98));
  const quote = await client.submitSupplierQuote(rfq.id, {
    amount: quoteAmount,
    taxRate: 13,
    deliveryDays: 7,
  });

  const award = await client.awardBuyerRfq(rfq.id, {
    quoteId: quote.id,
    reason: '自动联调报价',
  });

  const order = await client.createBuyerOrder({
    awardId: award.id,
    expectedReceiptDate: addDays(now, 21).toISOString().slice(0, 10),
  });
  const confirmedOrder = await client.confirmSupplierOrder(order.id);

  const timestamp = compactTimestamp(now);
  const delivery = await client.createSupplierDelivery(confirmedOrder.id, {
    carrier: '顺丰速运',
    trackingNo: `SF${timestamp}`,
  });

  const receipt = await client.createBuyerReceipt(order.id, {
    result: '验收通过',
  });

  const invoice = await client.createSupplierInvoice(order.id, {
    amount: order.amount,
    invoiceNo: `INV-${timestamp}`,
  });

  const paidInvoice = await client.registerBuyerPayment(invoice.id, {
    paymentStatus: '已付款',
  });

  return { rfq, quote, award, order, confirmedOrder, delivery, receipt, invoice, paidInvoice };
};

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

// LEGACY NODE PROTOTYPE adapter: VITE_API_BASE_URL is retained for old Hono demos only.
// New backend integration should use createJavaProcurementApiClient with VITE_JAVA_API_BASE_URL.
export const procurementApiClient: ProcurementApiClient = runtimeEnv.VITE_API_BASE_URL
  ? createDemoHttpApiClient(runtimeEnv.VITE_API_BASE_URL)
  : mockApiClient;
