package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.finance.domain.InvoiceInstallmentPolicy;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class InvoiceInstallmentPolicyTests {
  final InvoiceInstallmentPolicy.Balance line =
      new InvoiceInstallmentPolicy.Balance(
          "line",
          "电脑",
          "台",
          new BigDecimal("3"),
          new BigDecimal("100"),
          new BigDecimal("300"),
          BigDecimal.ONE,
          new BigDecimal("100"));

  @Test
  void issuesOnlySelectedRemainingQuantityAtOriginalPrice() {
    var result =
        InvoiceInstallmentPolicy.select(
            List.of(line),
            List.of(new InvoiceInstallmentPolicy.Selection("line", BigDecimal.ONE)),
            new BigDecimal("100"));
    assertThat(result.getFirst().amount()).isEqualByComparingTo("100");
    assertThat(line.invoicedQuantity()).isEqualByComparingTo("1");
  }

  @Test
  void rejectsDuplicateForeignAndExcessiveLines() {
    for (var s :
        List.of(
            List.of(new InvoiceInstallmentPolicy.Selection("foreign", BigDecimal.ONE)),
            List.of(new InvoiceInstallmentPolicy.Selection("line", new BigDecimal("3"))),
            List.of(
                new InvoiceInstallmentPolicy.Selection("line", BigDecimal.ONE),
                new InvoiceInstallmentPolicy.Selection("line", BigDecimal.ONE))))
      assertThatThrownBy(
              () -> InvoiceInstallmentPolicy.select(List.of(line), s, new BigDecimal("100")))
          .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void cannotChangePriceBySendingAnotherTotal() {
    assertThatThrownBy(
            () ->
                InvoiceInstallmentPolicy.select(
                    List.of(line),
                    List.of(new InvoiceInstallmentPolicy.Selection("line", BigDecimal.ONE)),
                    new BigDecimal("99")))
        .hasMessageContaining("金额");
  }

  @Test
  void rejectsZeroNegativeAndExcessivePrecision() {
    for (var q : List.of(BigDecimal.ZERO, new BigDecimal("-1"), new BigDecimal("0.00001")))
      assertThatThrownBy(
              () ->
                  InvoiceInstallmentPolicy.select(
                      List.of(line),
                      List.of(new InvoiceInstallmentPolicy.Selection("line", q)),
                      BigDecimal.ONE))
          .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsFractionalSplitsWhichWouldStrandARoundingDifference() {
    var l =
        new InvoiceInstallmentPolicy.Balance(
            "line",
            "零件",
            "件",
            BigDecimal.ONE,
            new BigDecimal("0.01"),
            new BigDecimal("0.01"),
            BigDecimal.ZERO,
            BigDecimal.ZERO);
    assertThatThrownBy(
            () ->
                InvoiceInstallmentPolicy.select(
                    List.of(l),
                    List.of(new InvoiceInstallmentPolicy.Selection("line", new BigDecimal("0.5"))),
                    new BigDecimal("0.01")))
        .hasMessageContaining("分币");
  }

  @Test
  void allowsFreeAccessoryWithPositiveInvoiceButNotZeroFaceInvoice() {
    var free =
        new InvoiceInstallmentPolicy.Balance(
            "free",
            "赠品",
            "件",
            BigDecimal.ONE,
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            BigDecimal.ZERO);
    assertThat(
            InvoiceInstallmentPolicy.select(
                List.of(line, free),
                List.of(
                    new InvoiceInstallmentPolicy.Selection("line", BigDecimal.ONE),
                    new InvoiceInstallmentPolicy.Selection("free", BigDecimal.ONE)),
                new BigDecimal("100")))
        .hasSize(2);
    assertThatThrownBy(
            () ->
                InvoiceInstallmentPolicy.select(
                    List.of(free),
                    List.of(new InvoiceInstallmentPolicy.Selection("free", BigDecimal.ONE)),
                    BigDecimal.ZERO))
        .hasMessageContaining("大于零");
  }
}
