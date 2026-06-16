package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.finance.domain.InvoiceAmountPolicy;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class InvoiceAmountPolicyTests {
  @Test
  void acceptsEqualInvoiceAndOrderAmounts() {
    assertThatCode(() -> InvoiceAmountPolicy.requireInvoiceCreationAmountMatchesOrder(
            BigDecimal.valueOf(100),
            BigDecimal.valueOf(100),
            "po-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> InvoiceAmountPolicy.requirePaymentAmountStillMatchesOrder(
            BigDecimal.valueOf(100),
            BigDecimal.valueOf(100),
            "invoice-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsInvoiceCreationAmountDifferentFromOrderAmount() {
    assertThatThrownBy(() -> InvoiceAmountPolicy.requireInvoiceCreationAmountMatchesOrder(
            BigDecimal.valueOf(99),
            BigDecimal.valueOf(100),
            "po-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invoice amount must equal purchase order amount");
  }

  @Test
  void rejectsPaymentWhenInvoiceAmountNoLongerMatchesOrderAmount() {
    assertThatThrownBy(() -> InvoiceAmountPolicy.requirePaymentAmountStillMatchesOrder(
            BigDecimal.valueOf(100),
            BigDecimal.valueOf(99),
            "invoice-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Invoice amount no longer matches purchase order amount");
  }
}
