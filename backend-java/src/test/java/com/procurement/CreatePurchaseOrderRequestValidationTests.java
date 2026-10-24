package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.order.api.CreatePurchaseOrderRequest;
import jakarta.validation.Validation;
import jakarta.validation.constraints.NotNull;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class CreatePurchaseOrderRequestValidationTests {
  @Test
  void requiresExpectedReceiptDateAndRejectsPastDatesButAcceptsTodayAndFuture() {
    Clock clock = Clock.fixed(Instant.parse("2026-10-24T12:00:00Z"), ZoneOffset.UTC);
    try (var factory = Validation.byDefaultProvider().configure()
        .clockProvider(() -> clock).buildValidatorFactory()) {
      var validator = factory.getValidator();
      var missing = validator.validate(new CreatePurchaseOrderRequest("award-1", null));
      assertThat(missing).anySatisfy(violation -> {
        assertThat(violation.getPropertyPath().toString()).isEqualTo("expectedReceiptDate");
        assertThat(violation.getConstraintDescriptor().getAnnotation()).isInstanceOf(NotNull.class);
      });
      LocalDate today = LocalDate.now(clock);
      assertThat(validator.validate(new CreatePurchaseOrderRequest("award-1", today.minusDays(1)))).isNotEmpty();
      assertThat(validator.validate(new CreatePurchaseOrderRequest("award-1", today))).isEmpty();
      assertThat(validator.validate(new CreatePurchaseOrderRequest("award-1", today.plusDays(1)))).isEmpty();
    }
  }
}
