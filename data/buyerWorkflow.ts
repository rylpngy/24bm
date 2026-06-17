import type { PurchaseOrder, Rfq, RfqQuote } from './procurementModel';

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
