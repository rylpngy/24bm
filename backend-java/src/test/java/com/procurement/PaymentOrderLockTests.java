package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractInstallmentService;
import com.procurement.contract.application.ContractPaymentPolicyService;
import com.procurement.finance.api.RecordPaymentAmountRequest;
import com.procurement.finance.api.ReversePaymentRequest;
import com.procurement.finance.application.*;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PaymentOrderLockTests {
  private final InvoiceMapper invoices = mock(InvoiceMapper.class);
  private final PaymentRequestMapper requests = mock(PaymentRequestMapper.class);
  private final PaymentEntryMapper entries = mock(PaymentEntryMapper.class);
  private final PaymentAuthorizationService authorization = new PaymentAuthorizationService(requests,
      mock(PaymentBatchMapper.class), mock(PaymentExecutionRecordMapper.class), mock(ThreeWayMatchMapper.class),
      mock(FinanceAccessService.class), mock(ContractPaymentPolicyService.class), invoices, entries,
      mock(ContractInstallmentService.class));

  private Invoice invoice() {
    return new Invoice("i", "t", "s", "o", BigDecimal.TEN, "INV-1", "待付款", null,
        null, null, null, null, null);
  }

  @AfterEach void cleanup() { TenantContext.clear(); }

  @Test void fullPaymentLocksOrderBeforeInvoiceAndApprovalRequest() {
    when(invoices.lockOrderForInvoice("t", "i")).thenReturn("o");
    when(invoices.lockByTenantAndId("t", "i")).thenReturn(invoice());
    when(entries.balance("t", "i")).thenReturn(BigDecimal.ZERO);
    assertThatThrownBy(() -> authorization.requireReady(invoice(), "已付款")).hasMessageContaining("付款申请");
    var sequence = inOrder(invoices, requests);
    sequence.verify(invoices).lockOrderForInvoice("t", "i");
    sequence.verify(invoices).lockByTenantAndId("t", "i");
    sequence.verify(invoices).lockOrderForInvoice("t", "i");
    sequence.verify(requests).lockByTenantAndInvoice("t", "i");
  }

  @Test void changedOrderBindingFailsBeforeAnyChildLock() {
    when(invoices.lockOrderForInvoice("t", "i")).thenReturn("other-order");
    assertThatThrownBy(() -> authorization.requireReady(invoice(), "已付款")).hasMessageContaining("关联订单已变化");
    verify(invoices, never()).lockByTenantAndId(anyString(), anyString());
    verifyNoInteractions(requests);
  }

  @ParameterizedTest @ValueSource(booleans = {true, false})
  void amountAndReversalEntryPointsLockOrderBeforeInvoice(boolean reverse) {
    TenantContext.set("t", null, "buyer");
    when(invoices.lockOrderForInvoice("t", "i")).thenReturn("o");
    when(invoices.lockByTenantAndId("t", "i")).thenReturn(invoice());
    var mockedAuthorization = mock(PaymentAuthorizationService.class);
    var ledger = new PaymentLedgerApplicationService(invoices, entries, mock(FinanceAccessService.class),
        mockedAuthorization, mock(PaymentApplicationService.class), mock(ContractInstallmentService.class),
        mock(PaymentExecutionRecordMapper.class), mock(AuditLogApplicationService.class));
    if (reverse) {
      assertThatThrownBy(() -> ledger.reverse("i", "missing", new ReversePaymentRequest("key", "撤销")))
          .hasMessageContaining("付款流水不存在");
    } else {
      when(entries.balance("t", "i")).thenReturn(BigDecimal.ZERO);
      doThrow(new IllegalStateException("guard reached")).when(mockedAuthorization).requireApproved(any(), eq(true));
      assertThatThrownBy(() -> ledger.record("i", new RecordPaymentAmountRequest("key", BigDecimal.ONE, null, "proof", "")))
          .hasMessageContaining("guard reached");
    }
    var sequence = inOrder(invoices);
    sequence.verify(invoices).lockOrderForInvoice("t", "i");
    sequence.verify(invoices).lockByTenantAndId("t", "i");
  }
}
