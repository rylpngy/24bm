package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.order.api.CreateDeliveryRequest;
import com.procurement.order.api.UpdateDeliveryRequest;
import jakarta.validation.Validation;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class SupplierSubmissionValidationTests {
  @Test
  void shipmentQuantityAllowsOmissionButRejectsExplicitZeroOrNegativeOnCreateAndUpdate() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      for (Integer quantity : new Integer[] {null, 1, 0, -1}) {
        boolean valid = quantity == null || quantity > 0;
        assertThat(validator.validate(new CreateDeliveryRequest("Carrier", "Tracking", quantity, null, null, null)).isEmpty()).isEqualTo(valid);
        assertThat(validator.validate(new UpdateDeliveryRequest("Carrier", "Tracking", quantity, null, null, null)).isEmpty()).isEqualTo(valid);
      }
    }
  }

  @Test
  void invoiceTaxRatePreservesZeroAndRejectsOutOfRangeValues() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      for (String value : new String[] {"0", "13", "100", "-1", "101"}) {
        var rate = new BigDecimal(value);
        assertThat(validator.validate(new CreateInvoiceRequest(BigDecimal.TEN, "INV", null, null, rate)).isEmpty())
            .isEqualTo(rate.signum() >= 0 && rate.compareTo(new BigDecimal("100")) <= 0);
      }
    }
  }
}
