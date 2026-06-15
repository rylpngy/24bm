// LEGACY NODE PROTOTYPE: retained only as a reference for early MVP flow tests.
// New backend business work belongs in backend-java.
import {
  buildProcurementMvpModel,
  type ApprovalStatus,
  type PurchaseDemand,
  type PurchaseOrder,
  type Rfq,
  type RfqQuote,
} from '../data/procurementModel.ts';

type BackendScope = 'platform' | 'buyer' | 'supplier';

export interface BackendPrincipal {
  scope: BackendScope;
  userId: string;
  tenantId?: string;
  supplierId?: string;
}

export interface ApprovalTaskRecord {
  id: string;
  tenantId: string;
  bizType: 'purchase_demand' | 'supplier_relation' | 'award_decision';
  bizId: string;
  assigneeRole: string;
  status: '待审批' | '已通过' | '已驳回';
}

export interface AwardDecisionRecord {
  id: string;
  tenantId: string;
  rfqId: string;
  quoteId: string;
  supplierId: string;
  amount: number;
  reason: string;
  approvedStatus: '待审批' | '已通过';
}

interface CreateDemandInput {
  title: string;
  department: string;
  requester: string;
  budget: number;
  lineItems: PurchaseDemand['lineItems'];
}

interface CreateRfqInput {
  title: string;
  demandIds: string[];
  invitedSupplierIds: string[];
  deadline: string;
}

interface SubmitQuoteInput {
  amount: number;
  taxRate: number;
  deliveryDays: number;
}

interface AwardRfqInput {
  quoteId: string;
  reason: string;
}

interface CreateOrderInput {
  expectedReceiptDate: string;
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const assertBuyer = (principal: BackendPrincipal): string => {
  if (principal.scope !== 'buyer' || !principal.tenantId) {
    throw new ForbiddenError('Buyer tenant scope is required.');
  }
  return principal.tenantId;
};

const assertSupplier = (principal: BackendPrincipal): string => {
  if (principal.scope !== 'supplier' || !principal.supplierId) {
    throw new ForbiddenError('Supplier scope is required.');
  }
  return principal.supplierId;
};

const createIdFactory = () => {
  const counters = new Map<string, number>();

  return (prefix: string) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}-${String(next).padStart(4, '0')}`;
  };
};

const clone = <T>(value: T): T => structuredClone(value);

export const createBackendContext = () => {
  const model = buildProcurementMvpModel();
  const nextId = createIdFactory();
  const approvalTasks: ApprovalTaskRecord[] = [];
  const awards: AwardDecisionRecord[] = [];

  const findDemandForTenant = (tenantId: string, demandId: string) => {
    const demand = model.demands.find((item) => item.id === demandId && item.tenantId === tenantId);
    if (!demand) {
      throw new NotFoundError(`Demand not found in tenant scope: ${demandId}`);
    }
    return demand;
  };

  const findRfqForTenant = (tenantId: string, rfqId: string) => {
    const rfq = model.rfqs.find((item) => item.id === rfqId && item.tenantId === tenantId);
    if (!rfq) {
      throw new NotFoundError(`RFQ not found in tenant scope: ${rfqId}`);
    }
    return rfq;
  };

  const findRfqForSupplier = (supplierId: string, rfqId: string) => {
    const rfq = model.rfqs.find((item) => item.id === rfqId);
    if (!rfq) {
      throw new NotFoundError(`RFQ not found: ${rfqId}`);
    }
    if (!rfq.invitedSupplierIds.includes(supplierId)) {
      throw new ForbiddenError(`Supplier is not invited to RFQ: ${rfqId}`);
    }
    return rfq;
  };

  return {
    model,
    auth: {
      asPlatform(userId: string): BackendPrincipal {
        const user = model.users.find((item) => item.id === userId && item.scope === 'platform');
        if (!user) {
          throw new ForbiddenError(`Platform user is not valid: ${userId}`);
        }
        return { scope: 'platform', userId };
      },
      asBuyer(tenantId: string, userId: string): BackendPrincipal {
        const user = model.users.find((item) => item.id === userId && item.scope === 'buyer' && item.tenantId === tenantId);
        if (!user) {
          throw new ForbiddenError(`Buyer user cannot access tenant: ${tenantId}`);
        }
        return { scope: 'buyer', tenantId, userId };
      },
      asSupplier(supplierId: string, userId: string): BackendPrincipal {
        const knownSupplier = model.enterprises.some((item) => item.id === supplierId && item.type === 'supplier');
        if (!knownSupplier) {
          throw new ForbiddenError(`Supplier does not exist: ${supplierId}`);
        }
        const knownUser = model.users.some((item) => item.id === userId && item.scope === 'supplier' && item.supplierId === supplierId);
        if (!knownUser) {
          throw new ForbiddenError(`Supplier user cannot access supplier: ${supplierId}`);
        }
        return { scope: 'supplier', supplierId, userId };
      },
    },
    demands: {
      list(principal: BackendPrincipal): PurchaseDemand[] {
        const tenantId = assertBuyer(principal);
        return clone(model.demands.filter((item) => item.tenantId === tenantId));
      },
      get(principal: BackendPrincipal, demandId: string): PurchaseDemand {
        const tenantId = assertBuyer(principal);
        return clone(findDemandForTenant(tenantId, demandId));
      },
      create(principal: BackendPrincipal, input: CreateDemandInput): PurchaseDemand {
        const tenantId = assertBuyer(principal);
        if (input.budget <= 0) {
          throw new ValidationError('Demand budget must be greater than 0.');
        }
        if (input.lineItems.length === 0) {
          throw new ValidationError('Demand must include at least one line item.');
        }

        const tenantMaterialIds = new Set(model.materials.filter((item) => item.tenantId === tenantId).map((item) => item.id));
        const invalidLine = input.lineItems.find((line) => !tenantMaterialIds.has(line.materialId) || line.quantity <= 0);
        if (invalidLine) {
          throw new ValidationError(`Invalid tenant material or quantity: ${invalidLine.materialId}`);
        }

        const demand: PurchaseDemand = {
          id: nextId('dem'),
          tenantId,
          title: input.title,
          department: input.department,
          requester: input.requester,
          budget: input.budget,
          status: '草稿',
          lineItems: input.lineItems,
        };
        model.demands.push(demand);
        return clone(demand);
      },
      submit(principal: BackendPrincipal, demandId: string): ApprovalTaskRecord {
        const tenantId = assertBuyer(principal);
        const demand = findDemandForTenant(tenantId, demandId);
        if (demand.status !== '草稿') {
          throw new ValidationError(`Only draft demands can be submitted: ${demandId}`);
        }
        demand.status = '审批中';
        const task: ApprovalTaskRecord = {
          id: nextId('approval'),
          tenantId,
          bizType: 'purchase_demand',
          bizId: demandId,
          assigneeRole: '采购方管理员',
          status: '待审批',
        };
        approvalTasks.push(task);
        return task;
      },
    },
    rfqs: {
      create(principal: BackendPrincipal, input: CreateRfqInput): Rfq {
        const tenantId = assertBuyer(principal);
        if (input.invitedSupplierIds.length === 0) {
          throw new ValidationError('RFQ must invite at least one supplier.');
        }

        const demands = input.demandIds.map((demandId) => {
          const demand = model.demands.find((item) => item.id === demandId);
          if (!demand) {
            throw new NotFoundError(`Demand not found: ${demandId}`);
          }
          if (demand.tenantId !== tenantId) {
            throw new ValidationError(`Demand is outside tenant scope: ${demandId}`);
          }
          return demand;
        });
        const invalidDemand = demands.find((demand) => demand.status !== '已通过');
        if (invalidDemand) {
          throw new ValidationError(`RFQ can only use approved demands: ${invalidDemand.id}`);
        }

        const approvedSupplierIds = new Set(
          model.supplierRelations
            .filter((relation) => relation.tenantId === tenantId && relation.status === '已准入')
            .map((relation) => relation.supplierId),
        );
        const invalidSupplier = input.invitedSupplierIds.find((supplierId) => !approvedSupplierIds.has(supplierId));
        if (invalidSupplier) {
          throw new ValidationError(`Supplier is not approved for tenant RFQ: ${invalidSupplier}`);
        }

        const rfq: Rfq = {
          id: nextId('rfq'),
          tenantId,
          demandIds: input.demandIds,
          title: input.title,
          status: '报价中',
          deadline: input.deadline,
          owner: principal.userId,
          invitedSupplierIds: input.invitedSupplierIds,
          quotes: [],
        };
        model.rfqs.push(rfq);
        return clone(rfq);
      },
      list(principal: BackendPrincipal): Rfq[] {
        const tenantId = assertBuyer(principal);
        return clone(model.rfqs.filter((item) => item.tenantId === tenantId));
      },
      award(principal: BackendPrincipal, rfqId: string, input: AwardRfqInput): AwardDecisionRecord {
        const tenantId = assertBuyer(principal);
        const rfq = findRfqForTenant(tenantId, rfqId);
        const quote = rfq.quotes.find((item) => item.id === input.quoteId);
        if (!quote || quote.status !== '已提交') {
          throw new ValidationError(`Award requires a submitted quote: ${input.quoteId}`);
        }
        if (!rfq.invitedSupplierIds.includes(quote.supplierId)) {
          throw new ValidationError('Awarded quote supplier must be invited.');
        }

        rfq.status = '已定标';
        rfq.awardedSupplierId = quote.supplierId;
        const award: AwardDecisionRecord = {
          id: nextId('award'),
          tenantId,
          rfqId,
          quoteId: input.quoteId,
          supplierId: quote.supplierId,
          amount: quote.amount,
          reason: input.reason,
          approvedStatus: '已通过',
        };
        awards.push(award);
        return award;
      },
    },
    quotes: {
      submit(principal: BackendPrincipal, rfqId: string, input: SubmitQuoteInput): RfqQuote {
        const supplierId = assertSupplier(principal);
        const rfq = findRfqForSupplier(supplierId, rfqId);
        if (rfq.status !== '报价中') {
          throw new ValidationError(`RFQ is not open for quotes: ${rfqId}`);
        }
        if (input.amount <= 0 || input.deliveryDays <= 0) {
          throw new ValidationError('Quote amount and delivery days must be greater than 0.');
        }

        const existing = rfq.quotes.find((item) => item.supplierId === supplierId && item.status === '已提交');
        if (existing) {
          throw new ValidationError(`Supplier has already submitted a quote: ${rfqId}`);
        }

        const quote: RfqQuote = {
          id: nextId('quote'),
          tenantId: rfq.tenantId,
          rfqId,
          supplierId,
          amount: input.amount,
          taxRate: input.taxRate,
          deliveryDays: input.deliveryDays,
          status: '已提交',
        };
        rfq.quotes.push(quote);
        return quote;
      },
    },
    orders: {
      createFromAward(principal: BackendPrincipal, awardId: string, input: CreateOrderInput): PurchaseOrder {
        const tenantId = assertBuyer(principal);
        const award = awards.find((item) => item.id === awardId && item.tenantId === tenantId);
        if (!award) {
          throw new NotFoundError(`Award not found in tenant scope: ${awardId}`);
        }
        const existingOrder = model.orders.find((item) => item.tenantId === tenantId && item.rfqId === award.rfqId && item.supplierId === award.supplierId);
        if (existingOrder) {
          return existingOrder;
        }

        const order: PurchaseOrder = {
          id: nextId('po'),
          tenantId,
          rfqId: award.rfqId,
          supplierId: award.supplierId,
          amount: award.amount,
          status: '待供应商确认',
          expectedReceiptDate: input.expectedReceiptDate,
        };
        model.orders.push(order);
        return order;
      },
    },
    approvals: {
      list(principal: BackendPrincipal): ApprovalTaskRecord[] {
        const tenantId = assertBuyer(principal);
        return approvalTasks.filter((item) => item.tenantId === tenantId);
      },
    },
    awards: {
      list(principal: BackendPrincipal): AwardDecisionRecord[] {
        const tenantId = assertBuyer(principal);
        return awards.filter((item) => item.tenantId === tenantId);
      },
    },
  };
};
