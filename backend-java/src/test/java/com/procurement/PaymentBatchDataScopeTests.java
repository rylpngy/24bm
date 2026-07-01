package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.application.FinanceActionApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentBlockResolutionMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.finance.infrastructure.VarianceHandlingMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PaymentBatchDataScopeTests {
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper =
      org.mockito.Mockito.mock(PaymentArchiveExceptionRequestMapper.class);
  private final PaymentBlockResolutionMapper paymentBlockResolutionMapper =
      org.mockito.Mockito.mock(PaymentBlockResolutionMapper.class);
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper =
      org.mockito.Mockito.mock(PaymentExecutionRecordMapper.class);
  private final PaymentRequestMapper paymentRequestMapper = org.mockito.Mockito.mock(PaymentRequestMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final VarianceHandlingMapper varianceHandlingMapper = org.mockito.Mockito.mock(VarianceHandlingMapper.class);
  private final PaymentApplicationService paymentApplicationService =
      org.mockito.Mockito.mock(PaymentApplicationService.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      org.mockito.Mockito.mock(ApprovalTaskApplicationService.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final PermissionService permissionService = org.mockito.Mockito.mock(PermissionService.class);
  private final DataScopeService dataScopeService = org.mockito.Mockito.mock(DataScopeService.class);
  private final FinanceActionApplicationService service = new FinanceActionApplicationService(
      invoiceMapper,
      purchaseOrderMapper,
      paymentBatchMapper,
      paymentArchiveExceptionRequestMapper,
      paymentBlockResolutionMapper,
      paymentExecutionRecordMapper,
      paymentRequestMapper,
      threeWayMatchMapper,
      varianceHandlingMapper,
      paymentApplicationService,
      approvalTaskApplicationService,
      approvalTaskMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      permissionService,
      dataScopeService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listPaymentBatchesPassesVisibleDepartmentsToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(DataScope.departments(List.of("dept-it", "dept-ops")));
    when(paymentBatchMapper.listByTenantFiltered(
        "tenant-1",
        "可安排付款",
        "supplier-1",
        List.of("dept-it", "dept-ops"),
        null))
        .thenReturn(List.of());

    service.listCurrentTenantPaymentBatches("可安排付款", "supplier-1");

    verify(paymentExecutionRecordMapper).refreshTenantFromPaymentRequests("tenant-1");
    verify(paymentBatchMapper).listByTenantFiltered(
        "tenant-1",
        "可安排付款",
        "supplier-1",
        List.of("dept-it", "dept-ops"),
        null);
  }

  @Test
  void listPaymentBatchesPassesRequesterScopeToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.self("buyer-user"));
    when(paymentBatchMapper.listByTenantFiltered("tenant-1", null, null, null, "buyer-user"))
        .thenReturn(List.of());

    service.listCurrentTenantPaymentBatches(null, null);

    verify(paymentBatchMapper).listByTenantFiltered("tenant-1", null, null, null, "buyer-user");
  }

  @Test
  void listPaymentBatchesReturnsEmptyWithoutQueryWhenScopeBlocksAll() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.departments(List.of()));

    var responses = service.listCurrentTenantPaymentBatches("可安排付款", null);

    assertThat(responses).isEmpty();
    verify(paymentBatchMapper, never()).listByTenantFiltered(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }
}
