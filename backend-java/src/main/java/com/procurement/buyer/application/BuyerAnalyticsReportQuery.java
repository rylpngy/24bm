package com.procurement.buyer.application;

import java.time.LocalDate;
import org.springframework.stereotype.Service;

/** Calls the analytics bean through its transaction proxy; never repeats the aggregate SQL. */
@Service
public class BuyerAnalyticsReportQuery {
  private final BuyerAnalyticsApplicationService analytics;

  public BuyerAnalyticsReportQuery(BuyerAnalyticsApplicationService analytics) { this.analytics = analytics; }

  public ProcurementAnalyticsView procurementAnalytics(LocalDate fromDate, LocalDate toDate, String supplierId, String status) {
    return analytics.procurementAnalytics(fromDate, toDate, supplierId, status);
  }
}
