package com.procurement.supplier.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;

/** 收货登记时间按上海时区归属周期，起点包含，终点不包含。 */
public record SupplierPerformancePeriod(String period, LocalDate startDate, LocalDate endDateExclusive) {
  private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

  public static SupplierPerformancePeriod parse(String value) {
    String period = SupplierEvaluationPeriod.normalize(value);
    int year = Integer.parseInt(period.substring(0, 4));
    LocalDate start = LocalDate.of(year, 1, 1);
    LocalDate end;
    if (period.length() == 4) {
      end = start.plusYears(1);
    } else if (period.charAt(5) == 'Q') {
      start = start.withMonth((period.charAt(6) - '1') * 3 + 1);
      end = start.plusMonths(3);
    } else {
      start = start.withMonth(Integer.parseInt(period.substring(5)));
      end = start.plusMonths(1);
    }
    return new SupplierPerformancePeriod(period, start, end);
  }

  public OffsetDateTime startAt() {
    return startDate.atStartOfDay(SHANGHAI).toOffsetDateTime();
  }

  public OffsetDateTime endAt() {
    return endDateExclusive.atStartOfDay(SHANGHAI).toOffsetDateTime();
  }
}
