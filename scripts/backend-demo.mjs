// LEGACY NODE PROTOTYPE: demos the old in-memory service layer only.
// New backend business work belongs in backend-java.
import { createBackendContext } from '../server/procurementBackend.ts';

const backend = createBackendContext();
const buyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');
const supplier = backend.auth.asSupplier('supplier-orbit', 'u-orbit-sales');

const demand = backend.demands.create(buyer, {
  title: '后端骨架演示采购需求',
  department: '信息化部',
  requester: '演示用户',
  budget: 120000,
  lineItems: [{ materialId: 'mat-acme-1', quantity: 5 }],
});
const approval = backend.demands.submit(buyer, demand.id);
backend.model.demands.find((item) => item.id === demand.id).status = '已通过';

const rfq = backend.rfqs.create(buyer, {
  title: '后端骨架演示询价',
  demandIds: [demand.id],
  invitedSupplierIds: ['supplier-orbit'],
  deadline: '2026-08-10',
});
const quote = backend.quotes.submit(supplier, rfq.id, {
  amount: 118000,
  taxRate: 13,
  deliveryDays: 8,
});
const award = backend.rfqs.award(buyer, rfq.id, {
  quoteId: quote.id,
  reason: '演示报价满足预算和交付要求',
});
const order = backend.orders.createFromAward(buyer, award.id, {
  expectedReceiptDate: '2026-08-25',
});

console.log(
  JSON.stringify(
    {
      demand: { id: demand.id, submittedApproval: approval.id },
      rfq: { id: rfq.id, quoteId: quote.id },
      award: { id: award.id, supplierId: award.supplierId },
      order: { id: order.id, status: order.status, amount: order.amount },
    },
    null,
    2,
  ),
);
