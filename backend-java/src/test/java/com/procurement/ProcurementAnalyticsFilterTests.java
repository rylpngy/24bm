package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.buyer.domain.ProcurementAnalyticsFilter;
import java.time.*;
import org.junit.jupiter.api.Test;

class ProcurementAnalyticsFilterTests {
  private final Clock clock = Clock.fixed(Instant.parse("2024-10-31T17:00:00Z"), ZoneOffset.UTC);

  @Test void defaultsToTwelveShanghaiCalendarMonths() {
    var filter = ProcurementAnalyticsFilter.resolve(null, null, " ", " ", clock);
    assertThat(filter.fromDate()).isEqualTo(LocalDate.parse("2023-12-01"));
    assertThat(filter.toDate()).isEqualTo(LocalDate.parse("2024-11-30"));
    assertThat(filter.startInclusive()).isEqualTo(Instant.parse("2023-11-30T16:00:00Z"));
    assertThat(filter.endExclusive()).isEqualTo(Instant.parse("2024-11-30T16:00:00Z"));
    assertThat(filter.supplierId()).isNull();
    assertThat(filter.status()).isNull();
  }

  @Test void includesLeapDayAndNormalizesOnlyBlankFilters() {
    var filter = ProcurementAnalyticsFilter.resolve(LocalDate.parse("2024-02-29"), LocalDate.parse("2024-02-29"), " supplier ", "已取消", clock);
    assertThat(Duration.between(filter.startInclusive(), filter.endExclusive()).toHours()).isEqualTo(24);
    assertThat(filter.supplierId()).isEqualTo("supplier");
    assertThat(filter.status()).isEqualTo("已取消");
  }

  @Test void boundsInclusiveCalendarMonthCountAndRejectsReversal() {
    assertThatCode(() -> ProcurementAnalyticsFilter.resolve(LocalDate.parse("2020-01-01"), LocalDate.parse("2024-12-31"), null, null, clock)).doesNotThrowAnyException();
    assertThatThrownBy(() -> ProcurementAnalyticsFilter.resolve(LocalDate.parse("2019-12-31"), LocalDate.parse("2024-12-01"), null, null, clock)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ProcurementAnalyticsFilter.resolve(LocalDate.parse("2024-02-01"), LocalDate.parse("2024-01-31"), null, null, clock)).isInstanceOf(IllegalArgumentException.class);
  }
}
