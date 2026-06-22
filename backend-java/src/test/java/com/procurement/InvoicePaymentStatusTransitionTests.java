package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import org.junit.jupiter.api.Test;

class InvoicePaymentStatusTransitionTests {

  private final InvoicePaymentStatusTransition transition = new InvoicePaymentStatusTransition();

  @Test
  void supportsOnlyPartialAndFullPaymentTargets() {
    assertThat(transition.isSupportedTarget(InvoicePaymentStatus.PARTIAL_PAID)).isTrue();
    assertThat(transition.isSupportedTarget(InvoicePaymentStatus.PAID)).isTrue();
    assertThat(transition.isSupportedTarget(InvoicePaymentStatus.PENDING_PAYMENT)).isFalse();
    assertThat(transition.isSupportedTarget("已作废")).isFalse();
  }

  @Test
  void requiresSupportedPaymentTarget() {
    assertThatCode(() -> transition.requireSupportedTarget(InvoicePaymentStatus.PARTIAL_PAID))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(InvoicePaymentStatus.PAID))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> transition.requireSupportedTarget("已作废"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported payment status: 已作废");
  }

  @Test
  void detectsRepeatedFinalOrPartialPaymentAsDuplicateRegistration() {
    assertThat(transition.isDuplicateRegistration(
        InvoicePaymentStatus.PARTIAL_PAID,
        InvoicePaymentStatus.PARTIAL_PAID))
        .isTrue();
    assertThat(transition.isDuplicateRegistration(
        InvoicePaymentStatus.PAID,
        InvoicePaymentStatus.PAID))
        .isTrue();
    assertThat(transition.isDuplicateRegistration(
        InvoicePaymentStatus.PENDING_PAYMENT,
        InvoicePaymentStatus.PENDING_PAYMENT))
        .isFalse();
  }

  @Test
  void allowsPendingPaymentToMoveToPartialOrPaid() {
    assertThatCode(() -> transition.requireTransition(
        InvoicePaymentStatus.PENDING_PAYMENT,
        InvoicePaymentStatus.PARTIAL_PAID,
        "invoice-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireTransition(
        InvoicePaymentStatus.PENDING_PAYMENT,
        InvoicePaymentStatus.PAID,
        "invoice-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void allowsPartialPaymentToBecomePaidOnly() {
    assertThatCode(() -> transition.requireTransition(
        InvoicePaymentStatus.PARTIAL_PAID,
        InvoicePaymentStatus.PAID,
        "invoice-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireTransition(
        InvoicePaymentStatus.PARTIAL_PAID,
        InvoicePaymentStatus.PENDING_PAYMENT,
        "invoice-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Unsupported payment status transition");
  }

  @Test
  void rejectsPaidInvoiceChanges() {
    assertThatThrownBy(() -> transition.requireTransition(
        InvoicePaymentStatus.PAID,
        InvoicePaymentStatus.PARTIAL_PAID,
        "invoice-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Paid invoices cannot be changed: invoice-1");
  }

  @Test
  void rejectsDuplicatePaymentRegistration() {
    assertThatThrownBy(() -> transition.requireTransition(
        InvoicePaymentStatus.PAID,
        InvoicePaymentStatus.PAID,
        "invoice-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment status already registered: invoice-1");
  }
}
