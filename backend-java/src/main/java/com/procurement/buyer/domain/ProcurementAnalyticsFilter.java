package com.procurement.buyer.domain;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/** Validated calendar dates shared by analytics and its export. */
public record ProcurementAnalyticsFilter(LocalDate fromDate, LocalDate toDate, String supplierId, String status) {
  public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

  public static ProcurementAnalyticsFilter resolve(LocalDate fromDate, LocalDate toDate,
      String supplierId, String status, Clock clock) {
    LocalDate end = toDate == null ? YearMonth.now(clock.withZone(ZONE)).atEndOfMonth() : toDate;
    LocalDate start = fromDate == null ? YearMonth.from(end).minusMonths(11).atDay(1) : fromDate;
    long months = ChronoUnit.MONTHS.between(YearMonth.from(start), YearMonth.from(end)) + 1;
    if (start.isAfter(end) || months > 60 || start.getYear() < 1 || end.getYear() > 9998) {
      throw new IllegalArgumentException("统计日期须起日不晚于末日，且最多跨60个自然月");
    }
    return new ProcurementAnalyticsFilter(start, end, blankToNull(supplierId), blankToNull(status));
  }

  public Instant startInclusive() { return fromDate.atStartOfDay(ZONE).toInstant(); }
  public Instant endExclusive() { return toDate.plusDays(1).atStartOfDay(ZONE).toInstant(); }

  private static String blankToNull(String value) {
    if (value == null || value.isBlank()) return null;
    if (value.length() > 200) throw new IllegalArgumentException("统计筛选值过长");
    return value.trim();
  }
}
