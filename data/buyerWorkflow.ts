import type { InvoiceRecord, PurchaseOrder, Rfq, RfqQuote } from './procurementModel';

export interface BuyerNextAction {
  title: string;
  detail: string;
  tone: 'slate' | 'blue' | 'amber' | 'emerald';
}

export const selectRecommendedQuote = (rfq: Rfq): RfqQuote | undefined =>
  [...rfq.quotes]
    .filter((quote) => quote.status === '已提交')
    .sort((left, right) => {
      const amountDelta = left.amount - right.amount;
      if (amountDelta !== 0) return amountDelta;
      return left.deliveryDays - right.deliveryDays;
    })[0];

export const canSubmitAwardApproval = (rfq: Rfq): boolean =>
  (rfq.status === '报价中' || rfq.status === '已截标')
  && !rfq.awardedSupplierId
  && Boolean(selectRecommendedQuote(rfq));

export const canCreateOrderFromAward = (
  rfq: Rfq,
  approvedAwardId: string | undefined,
  orders: PurchaseOrder[],
): boolean => {
  const hasGeneratedOrder = orders.some((order) =>
    order.rfqId === rfq.id && (!rfq.awardedSupplierId || order.supplierId === rfq.awardedSupplierId));

  return Boolean(approvedAwardId) && rfq.status === '已定标' && !hasGeneratedOrder;
};

export const describeRfqNextAction = (
  rfq: Rfq,
  approvedAwardId: string | undefined,
  orders: PurchaseOrder[],
): BuyerNextAction => {
  if (canCreateOrderFromAward(rfq, approvedAwardId, orders)) {
    return {
      title: '可生成采购订单',
      detail: '定标审批已通过，生成订单后进入供应商确认和发货。',
      tone: 'emerald',
    };
  }

  if (rfq.status === '定标审批中') {
    return {
      title: '定标审批中',
      detail: '审批通过后可生成采购订单。',
      tone: 'amber',
    };
  }

  if (canSubmitAwardApproval(rfq)) {
    return {
      title: '可提交定标审批',
      detail: '系统已按价格和交期推荐报价，提交后进入定标审批。',
      tone: 'blue',
    };
  }

  if (rfq.quotes.length === 0) {
    return {
      title: '等待供应商报价',
      detail: '收到有效报价后，可按推荐报价提交定标审批。',
      tone: 'slate',
    };
  }

  return {
    title: '流程已处理',
    detail: '当前询价项目暂无需要采购方立即处理的动作。',
    tone: 'slate',
  };
};

export const describeOrderNextAction = (order: PurchaseOrder): BuyerNextAction => {
  if (order.status === '已发货') {
    return {
      title: '待采购方收货',
      detail: '供应商已发货，可登记收货验收。',
      tone: 'emerald',
    };
  }

  if (order.status === '待供应商确认') {
    return {
      title: '等待供应商确认',
      detail: '供应商确认订单后，将进入发货环节。',
      tone: 'amber',
    };
  }

  if (order.status === '待发货') {
    return {
      title: '等待供应商发货',
      detail: '供应商提交物流信息后，可跟踪收货验收。',
      tone: 'amber',
    };
  }

  if (order.status === '待收货') {
    return {
      title: '待收货验收',
      detail: '确认到货和验收结果后，进入发票付款协同。',
      tone: 'blue',
    };
  }

  return {
    title: '履约已完成',
    detail: '订单履约已完成，可继续关注发票和付款状态。',
    tone: 'slate',
  };
};

export const describeInvoiceNextAction = (invoice: InvoiceRecord): BuyerNextAction => {
  if (invoice.paymentStatus === '待付款') {
    return {
      title: '待登记付款',
      detail: '确认付款信息后，可登记付款状态。',
      tone: 'blue',
    };
  }

  if (invoice.paymentStatus === '部分付款') {
    return {
      title: '继续跟进尾款',
      detail: '仍有未结清金额，需继续跟进付款状态。',
      tone: 'amber',
    };
  }

  return {
    title: '付款已完成',
    detail: '付款状态已完成，可通过审计日志追踪操作记录。',
    tone: 'slate',
  };
};
