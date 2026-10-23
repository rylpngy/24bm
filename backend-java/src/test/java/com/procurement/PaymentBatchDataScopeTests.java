package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.application.PaymentBatchApplicationService;
import com.procurement.finance.application.FinanceAccessService;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PaymentBatchDataScopeTests {
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper =
      org.mockito.Mockito.mock(PaymentExecutionRecordMapper.class);
  private final FinanceAccessService financeAccess = org.mockito.Mockito.mock(FinanceAccessService.class);
  private final PaymentBatchApplicationService service = new PaymentBatchApplicationService(
      paymentBatchMapper, paymentExecutionRecordMapper,
      org.mockito.Mockito.mock(AuditLogApplicationService.class),
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class),
      org.mockito.Mockito.mock(PermissionService.class), financeAccess,
      org.mockito.Mockito.mock(UnifiedWorkflowApplicationService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listPaymentBatchesPassesVisibleDepartmentsToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(financeAccess.readScope())
        .thenReturn(DataScope.departments(List.of("dept-it", "dept-ops")));
    when(paymentBatchMapper.listVisible(
        "tenant-1",
        "可安排付款",
        "supplier-1",
        DataScope.departments(List.of("dept-it", "dept-ops"))))
        .thenReturn(List.of());

    service.listCurrentTenantPaymentBatches("可安排付款", "supplier-1");

    verify(paymentExecutionRecordMapper).refreshVisible("tenant-1", DataScope.departments(List.of("dept-it", "dept-ops")));
    verify(paymentBatchMapper).listVisible(
        "tenant-1",
        "可安排付款",
        "supplier-1",
        DataScope.departments(List.of("dept-it", "dept-ops")));
  }

  @Test
  void listPaymentBatchesPassesRequesterScopeToMapper() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(financeAccess.readScope()).thenReturn(DataScope.self("buyer-user"));
    when(paymentBatchMapper.listVisible("tenant-1", null, null, DataScope.self("buyer-user")))
        .thenReturn(List.of());

    service.listCurrentTenantPaymentBatches(null, null);

    verify(paymentBatchMapper).listVisible("tenant-1", null, null, DataScope.self("buyer-user"));
  }

  @Test
  void listPaymentBatchesReturnsEmptyWithoutQueryWhenScopeBlocksAll() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(financeAccess.readScope()).thenReturn(DataScope.departments(List.of()));

    var responses = service.listCurrentTenantPaymentBatches("可安排付款", null);

    assertThat(responses).isEmpty();
    verify(paymentBatchMapper, never()).listVisible(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }
}
