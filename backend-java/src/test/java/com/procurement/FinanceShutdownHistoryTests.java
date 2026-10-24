package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreatePaymentRequestRequest;
import com.procurement.finance.application.*;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.infrastructure.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FinanceShutdownHistoryTests {
  final InvoiceMapper invoices = mock(InvoiceMapper.class);
  final PaymentRequestMapper requests = mock(PaymentRequestMapper.class);
  final ThreeWayMatchMapper matches = mock(ThreeWayMatchMapper.class);
  final TenantFeatureMapper featureMapper = mock(TenantFeatureMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final FinanceAccessService access = mock(FinanceAccessService.class);
  final UnifiedWorkflowApplicationService workflow = mock(UnifiedWorkflowApplicationService.class);
  final FinanceActionApplicationService service = new FinanceActionApplicationService(
      invoices, mock(PurchaseOrderMapper.class), mock(PaymentBatchMapper.class), mock(PaymentBlockResolutionMapper.class),
      mock(PaymentExecutionRecordMapper.class), requests, matches, mock(VarianceHandlingMapper.class),
      mock(PaymentApplicationService.class), mock(AuditLogApplicationService.class),
      new TenantFeatureApplicationService(featureMapper, new ObjectMapper()), permissions, access, workflow,
      mock(PaymentBatchApplicationService.class), mock(PaymentArchiveExceptionApplicationService.class));
  final OffsetDateTime time = OffsetDateTime.parse("2026-06-15T10:00:00+08:00");

  @BeforeEach void prepare() {
    TenantContext.set("t", null, "u");
    when(featureMapper.findEnabledFeaturesJson("t")).thenReturn("[]");
    when(invoices.findByTenantAndId("t", "i"))
        .thenReturn(new Invoice("i", "t", "s", "o", BigDecimal.TEN, "INV", "待付款", null, time, time, null, null, null));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  private CreatePaymentRequestRequest request(String status) {
    return new CreatePaymentRequestRequest("i", status, "batch", "历史发票履约");
  }
  private void savedRequest(String status) {
    when(requests.findByTenantAndInvoice("t", "i")).thenReturn(null,
        new PaymentRequest("pr", "t", "i", "s", "o", BigDecimal.TEN, status, "batch", null, "u", time, time));
  }

  @Test void existingInvoiceMayStartItsNecessaryPaymentRequestWithFinanceOff() {
    savedRequest("付款申请待提交");
    assertThat(service.createCurrentTenantPaymentRequest(request("付款申请待提交")).invoiceId()).isEqualTo("i");
    verify(permissions).require("buyer:payment:register");
    verify(access, atLeastOnce()).requireInvoice("i", "buyer:payment:register");
    verifyNoInteractions(workflow);
  }

  @Test void submittingHistoricalPaymentStillStartsTheApprovalWorkflow() {
    savedRequest("付款申请审批中");
    assertThat(service.createCurrentTenantPaymentRequest(request("付款申请审批中")).requestStatus()).isEqualTo("付款申请审批中");
    verify(workflow).start(argThat(command -> command.businessType().equals("payment_request")
        && command.businessId().equals("pr") && command.businessSnapshot().get("invoiceId").equals("i")));
  }

  @Test void historicalPaymentCannotInventAnApprovedStatus() {
    assertThatThrownBy(() -> service.createCurrentTenantPaymentRequest(request("付款申请已通过")))
        .hasMessageContaining("审批结果由 Flowable 回写");
    verify(requests, never()).upsert(anyString(), anyString(), anyString(), anyString(), anyString(),
        any(), anyString(), anyString(), any(), anyString());
    verifyNoInteractions(workflow);
  }

  @Test void matchingProblemsStillBlockHistoricalPaymentRequests() {
    when(matches.paymentBlockingReason("t", "i")).thenReturn("验收数量不符");
    assertThatThrownBy(() -> service.createCurrentTenantPaymentRequest(request("付款申请待提交")))
        .hasMessageContaining("验收数量不符");
    verifyNoInteractions(requests, workflow);
  }

  @Test void crossTenantOrMissingInvoicesCannotBecomeHistoricalRequests() {
    when(invoices.findByTenantAndId("t", "i")).thenReturn(null);
    assertThatThrownBy(() -> service.createCurrentTenantPaymentRequest(request("付款申请待提交")))
        .hasMessageContaining("Invoice not found in tenant scope");
    verifyNoInteractions(requests, workflow);
  }

  @Test void historicalFulfillmentDoesNotGrantPermissionOrDataScope() {
    doThrow(new PermissionDeniedException("无发票范围权限")).when(access).requireInvoice("i", "buyer:payment:register");
    assertThatThrownBy(() -> service.createCurrentTenantPaymentRequest(request("付款申请待提交")))
        .isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(invoices, requests, workflow);
  }
}
