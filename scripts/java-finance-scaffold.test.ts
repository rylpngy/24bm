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
    expect(mapper).toContain('payment_status');
    expect(mapper).toContain('updatePaymentStatus');
  });

  it('keeps invoice creation supplier scoped and payment tenant scoped', () => {
    const invoiceService = read('backend-java/src/main/java/com/procurement/finance/application/InvoiceApplicationService.java');
    const paymentService = read('backend-java/src/main/java/com/procurement/finance/application/PaymentApplicationService.java');

    expect(invoiceService).toContain('TenantAccessGuard.requireSupplierId');
    expect(invoiceService).toContain('TenantFeatureApplicationService');
    expect(invoiceService).toContain('FINANCE_FEATURE');
    expect(invoiceService).toContain('requireEnabled(order.tenantId(), FINANCE_FEATURE)');
    expect(invoiceService).toContain('已收货');
    expect(invoiceService).toContain('待付款');
    expect(invoiceService).toContain('findBySupplierAndId');
    expect(paymentService).toContain('TenantAccessGuard.requireTenantId');
    expect(paymentService).toContain('requireEnabled(tenantId, FINANCE_FEATURE)');
    expect(paymentService).toContain('listCurrentTenantInvoices');
    expect(paymentService).toContain('updatePaymentStatus');
  });

  it('documents the finance Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('POST /api/v1/supplier/orders/{orderId}/invoices');
    expect(readme).toContain('GET /api/v1/buyer/invoices');
    expect(readme).toContain('POST /api/v1/buyer/invoices/{invoiceId}/payments');
    expect(readme).toContain('`finance` feature enabled');
    expect(architecture).toContain('财务协同 Java API');
    expect(architecture).toContain('当前租户必须启用 `finance` 功能开关');
  });
});
