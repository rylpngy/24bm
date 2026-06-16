import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java finance invoice and payment scaffold', () => {
  it('exposes supplier invoice and buyer payment endpoints', () => {
    const invoiceController = read('backend-java/src/main/java/com/procurement/finance/api/SupplierInvoiceController.java');
    const paymentController = read('backend-java/src/main/java/com/procurement/finance/api/BuyerPaymentController.java');

    expect(invoiceController).toContain('@RequestMapping("/api/v1/supplier/orders")');
    expect(invoiceController).toContain('@PostMapping("/{orderId}/invoices")');
    expect(paymentController).toContain('@RequestMapping("/api/v1/buyer/invoices")');
    expect(paymentController).toContain('@GetMapping');
    expect(paymentController).toContain('@PostMapping("/{invoiceId}/payments")');
    expect(paymentController).toContain('@GetMapping("/{invoiceId}/payment-audit-logs")');
  });

  it('defines request and response DTOs for invoices and payments', () => {
    const invoiceRequest = read('backend-java/src/main/java/com/procurement/finance/api/CreateInvoiceRequest.java');
    const paymentRequest = read('backend-java/src/main/java/com/procurement/finance/api/RegisterPaymentRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/finance/api/InvoiceResponse.java');

    expect(invoiceRequest).toContain('amount');
    expect(invoiceRequest).toContain('invoiceNo');
    expect(paymentRequest).toContain('paymentStatus');
    expect(response).toContain('tenantId');
    expect(response).toContain('supplierId');
    expect(response).toContain('orderId');
    expect(response).toContain('paymentStatus');
  });

  it('uses a MyBatis mapper for invoices table operations', () => {
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/InvoiceMapper.java');

    expect(mapper).toContain('@Mapper');
    expect(mapper).toContain('invoices');
    expect(mapper).toContain('listByTenant');
    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('findBySupplierAndId');
    expect(mapper).toContain('payment_status');
    expect(mapper).toContain('countByTenantAndOrder');
    expect(mapper).toContain('updatePaymentStatus');
  });

  it('keeps invoice creation supplier scoped and payment tenant scoped', () => {
    const invoiceService = read('backend-java/src/main/java/com/procurement/finance/application/InvoiceApplicationService.java');
    const paymentService = read('backend-java/src/main/java/com/procurement/finance/application/PaymentApplicationService.java');
    const invoiceAuditAction = read('backend-java/src/main/java/com/procurement/finance/domain/InvoiceAuditAction.java');
    const auditTargetType = read('backend-java/src/main/java/com/procurement/audit/domain/AuditTargetType.java');
    const tenantFeatureKey = read('backend-java/src/main/java/com/procurement/tenant/domain/TenantFeatureKey.java');
    const auditService = read('backend-java/src/main/java/com/procurement/audit/application/AuditLogApplicationService.java');
    const notificationTitle = read('backend-java/src/main/java/com/procurement/notification/domain/NotificationTitle.java');
    const invoiceCreationStatusPolicy = read('backend-java/src/main/java/com/procurement/finance/domain/InvoiceCreationStatusPolicy.java');
    const invoiceAmountPolicy = read('backend-java/src/main/java/com/procurement/finance/domain/InvoiceAmountPolicy.java');
    const documentUniquenessPolicy = read('backend-java/src/main/java/com/procurement/order/domain/PurchaseOrderDocumentUniquenessPolicy.java');
    const paymentPolicy = read('backend-java/src/main/java/com/procurement/supplier/domain/BuyerSupplierPaymentPolicy.java');

    expect(invoiceService).toContain('TenantAccessGuard.requireSupplierId');
    expect(invoiceService).toContain('TenantFeatureApplicationService');
    expect(invoiceService).toContain('requireEnabled(order.tenantId(), TenantFeatureKey.FINANCE)');
    expect(invoiceService).toContain('InvoiceCreationStatusPolicy.requireReceivedOrder');
    expect(invoiceService).toContain('InvoicePaymentStatus.PENDING_PAYMENT');
    expect(invoiceService).toContain('InvoiceAmountPolicy.requireInvoiceCreationAmountMatchesOrder');
    expect(invoiceService).toContain('PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice');
    expect(invoiceService).toContain('countByTenantAndOrder');
    expect(invoiceService).toContain('findBySupplierAndId');
    expect(invoiceService).toContain('listCurrentSupplierPaymentAuditLogs');
    expect(invoiceService).toContain('InvoiceAuditAction.CREATED');
    expect(invoiceService).toContain('InvoiceAuditAction.PAID');
    expect(invoiceService).toContain('InvoiceAuditAction.PARTIAL_PAID');
    expect(invoiceService).toContain('AuditTargetType.INVOICE');
    expect(invoiceService).toContain('NotificationTitle.INVOICE_CREATED');
    expect(paymentService).toContain('TenantAccessGuard.requireTenantId');
    expect(paymentService).toContain('BuyerSupplierRelationMapper');
    expect(paymentService).toContain('PurchaseOrderMapper');
    expect(paymentService).toContain('requireEnabled(tenantId, TenantFeatureKey.FINANCE)');
    expect(paymentService).toContain('BuyerSupplierRelationStatus.BLACKLISTED');
    expect(paymentService).toContain('BuyerSupplierPaymentPolicy.requirePayable');
    expect(paymentService).toContain('requireInvoiceAmountMatchesOrder');
    expect(paymentService).toContain('InvoiceAmountPolicy.requirePaymentAmountStillMatchesOrder');
    expect(paymentService).toContain('countByTenantSupplierAndStatus');
    expect(paymentService).toContain('listCurrentTenantInvoices');
    expect(paymentService).toContain('listCurrentTenantPaymentAuditLogs');
    expect(paymentService).toContain('InvoiceAuditAction.PAID');
    expect(paymentService).toContain('InvoiceAuditAction.PARTIAL_PAID');
    expect(paymentService).toContain('AuditTargetType.INVOICE');
    expect(paymentService).toContain('listByTenantFiltered');
    expect(paymentService).toContain('updatePaymentStatus');
    expect(paymentService).toContain('InvoicePaymentStatusTransition');
    expect(paymentService).toContain('isIdempotentRegistration');
    expect(paymentService).toContain('requireTransition');
    expect(paymentService).toContain('notifyActiveSupplierUsers');
    expect(paymentService).toContain('NotificationTitle.INVOICE_PAID');
    expect(paymentService).toContain('NotificationTitle.INVOICE_PARTIAL_PAID');
    const paymentTransition = read('backend-java/src/main/java/com/procurement/finance/domain/InvoicePaymentStatusTransition.java');
    expect(paymentTransition).toContain('isIdempotentRegistration');
    expect(paymentTransition).toContain('Paid invoices cannot be changed');
    expect(invoiceAuditAction).toContain('CREATED = "invoice.created"');
    expect(invoiceAuditAction).toContain('PAID = "invoice.paid"');
    expect(invoiceAuditAction).toContain('PARTIAL_PAID = "invoice.partial_paid"');
    expect(auditTargetType).toContain('INVOICE = "invoice"');
    expect(tenantFeatureKey).toContain('FINANCE = "finance"');
    expect(auditService).toContain('listCurrentTenantTargetActions');
    expect(notificationTitle).toContain('INVOICE_CREATED = "供应商已登记发票"');
    expect(invoiceCreationStatusPolicy).toContain('Only received purchase orders can be invoiced');
    expect(invoiceAmountPolicy).toContain('Invoice amount must equal purchase order amount');
    expect(invoiceAmountPolicy).toContain('Invoice amount no longer matches purchase order amount');
    expect(documentUniquenessPolicy).toContain('Purchase order already has an invoice');
    expect(paymentPolicy).toContain('Blacklisted supplier cannot be paid');
  });

  it('documents the finance Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/supplier/orders/{orderId}/invoices');
    expect(readme).toContain('GET /api/v1/buyer/invoices');
    expect(readme).toContain('The buyer invoice list accepts optional `paymentStatus`, `supplierId`, and `orderId` filters');
    expect(readme).toContain('POST /api/v1/buyer/invoices/{invoiceId}/payments');
    expect(readme).toContain('GET /api/v1/buyer/invoices/{invoiceId}/payment-audit-logs');
    expect(readme).toContain('The buyer payment audit log list returns current-tenant `invoice.paid` and `invoice.partial_paid` audit entries');
    expect(readme).toContain('Payment registration rejects invoices whose current-tenant supplier relation is `黑名单`');
    expect(readme).toContain('Invoice creation requires the order to belong to the current supplier, be `已收货`');
    expect(readme).toContain('Invoice creation requires `amount` to equal the purchase order amount');
    expect(readme).toContain('MVP invoice creation allows only one invoice per purchase order');
    expect(readme).toContain('Payment registration rechecks that the invoice amount still equals the purchase order amount');
    expect(readme).toContain('Repeated registration of the current `部分付款` or `已付款` status is idempotent');
    expect(readme).toContain('A `部分付款` invoice can later be completed to `已付款`');
    expect(readme).toContain('`finance` feature enabled');
    expect(architecture).toContain('财务协同 Java API');
    expect(architecture).toContain('当前租户必须启用 `finance` 功能开关');
    expect(architecture).toContain('发票金额必须等于采购订单金额');
    expect(architecture).toContain('MVP 阶段同一采购订单只能登记一张发票');
    expect(architecture).toContain('付款登记前会重新校验发票金额仍等于采购订单金额');
    expect(architecture).toContain('发票供应商在当前采购方私域供应商关系中不能是 `黑名单`');
    expect(architecture).toContain('`部分付款` 可继续登记为 `已付款`');
    expect(architecture).toContain('`已付款` 不允许回退为 `部分付款`');
  });
});
