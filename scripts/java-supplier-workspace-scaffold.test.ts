import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java supplier workspace scaffold', () => {
  it('exposes supplier workspace list endpoints', () => {
    const profileController = read('backend-java/src/main/java/com/procurement/supplier/api/SupplierProfileController.java');
    const qualificationController = read('backend-java/src/main/java/com/procurement/supplier/api/SupplierQualificationController.java');
    const userController = read('backend-java/src/main/java/com/procurement/supplier/api/SupplierUserController.java');
    const rfqController = read('backend-java/src/main/java/com/procurement/sourcing/api/SupplierQuoteController.java');
    const quoteController = read('backend-java/src/main/java/com/procurement/sourcing/api/SupplierQuoteListController.java');
    const orderController = read('backend-java/src/main/java/com/procurement/order/api/SupplierOrderController.java');
    const invoiceController = read('backend-java/src/main/java/com/procurement/finance/api/SupplierReceivableController.java');

    expect(profileController).toContain('@RequestMapping("/api/v1/supplier/profile")');
    expect(profileController).toContain('@GetMapping');
    expect(qualificationController).toContain('@RequestMapping("/api/v1/supplier/qualifications")');
    expect(qualificationController).toContain('@GetMapping');
    expect(qualificationController).toContain('@PostMapping');
    expect(userController).toContain('@RequestMapping("/api/v1/supplier/users")');
    expect(userController).toContain('@GetMapping');
    expect(userController).toContain('@PostMapping');
    expect(rfqController).toContain('@GetMapping');
    expect(quoteController).toContain('@RequestMapping("/api/v1/supplier/quotes")');
    expect(quoteController).toContain('@GetMapping');
    expect(orderController).toContain('@RequestMapping("/api/v1/supplier/orders")');
    expect(orderController).toContain('@GetMapping');
    expect(invoiceController).toContain('@RequestMapping("/api/v1/supplier/invoices")');
    expect(invoiceController).toContain('@GetMapping');
  });

  it('keeps supplier list queries scoped to the authenticated supplier', () => {
    const supplierService = read('backend-java/src/main/java/com/procurement/supplier/application/SupplierProfileApplicationService.java');
    const qualificationService = read('backend-java/src/main/java/com/procurement/supplier/application/SupplierQualificationApplicationService.java');
    const userService = read('backend-java/src/main/java/com/procurement/supplier/application/SupplierUserApplicationService.java');
    const quoteService = read('backend-java/src/main/java/com/procurement/sourcing/application/QuoteApplicationService.java');
    const orderService = read('backend-java/src/main/java/com/procurement/order/application/PurchaseOrderApplicationService.java');
    const invoiceService = read('backend-java/src/main/java/com/procurement/finance/application/InvoiceApplicationService.java');

    expect(supplierService).toContain('TenantAccessGuard.requireSupplierId');
    expect(qualificationService).toContain('TenantAccessGuard.requireSupplierId');
    expect(qualificationService).toContain('listActiveBySupplier');
    expect(userService).toContain('TenantAccessGuard.requireSupplierId');
    expect(userService).toContain('passwordEncoder.encode');
    expect(userService).toContain('supplier_user.created');
    expect(quoteService).toContain('listSupplierRfqs');
    expect(quoteService).toContain('listSupplierQuotes');
    expect(orderService).toContain('listCurrentSupplierOrders');
    expect(invoiceService).toContain('listCurrentSupplierInvoices');
  });

  it('documents the supplier workspace Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const localGuide = read('docs/local-java-integration.md');

    expect(readme).toContain('GET /api/v1/supplier/profile');
    expect(readme).toContain('GET /api/v1/supplier/qualifications');
    expect(readme).toContain('POST /api/v1/supplier/qualifications');
    expect(readme).toContain('GET /api/v1/supplier/users');
    expect(readme).toContain('POST /api/v1/supplier/users');
    expect(readme).toContain('supplier_qualifications');
    expect(readme).toContain('GET /api/v1/supplier/rfqs');
    expect(readme).toContain('GET /api/v1/supplier/quotes');
    expect(readme).toContain('GET /api/v1/supplier/orders');
    expect(readme).toContain('GET /api/v1/supplier/invoices');
    expect(localGuide).toContain('GET /api/v1/supplier/workspace');
  });
});
