package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.SupplierPerformancePeriod;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class SupplierPerformancePeriodTests {
  @Test
  void normalizesAndUsesShanghaiHalfOpenBoundaries() {
    var quarter = SupplierPerformancePeriod.parse("\t2001-q4\n");
    assertThat(quarter.period()).isEqualTo("2001-Q4");
    assertThat(quarter.startDate()).isEqualTo(LocalDate.of(2001, 10, 1));
    assertThat(quarter.endDateExclusive()).isEqualTo(LocalDate.of(2002, 1, 1));
    assertThat(quarter.startAt()).isEqualTo(OffsetDateTime.parse("2001-10-01T00:00:00+08:00"));
    assertThat(quarter.endAt()).isEqualTo(OffsetDateTime.parse("2002-01-01T00:00:00+08:00"));
    assertThat(SupplierPerformancePeriod.parse("2001-02").endDateExclusive())
        .isEqualTo(LocalDate.of(2001, 3, 1));
    assertThat(SupplierPerformancePeriod.parse("2001").startDate()).isEqualTo(LocalDate.of(2001, 1, 1));
    assertThat(SupplierPerformancePeriod.parse("2001").endDateExclusive()).isEqualTo(LocalDate.of(2002, 1, 1));
  }

  @Test
  void rejectsMissingBlankAndMalformedPeriods() {
    for (String period : new String[]{null, "", "  ", "2001-Q0", "2001-13", "2001-1", "2001-01-01", "0000"}) {
      assertThatThrownBy(() -> SupplierPerformancePeriod.parse(period)).isInstanceOf(IllegalArgumentException.class);
    }
  }
}
