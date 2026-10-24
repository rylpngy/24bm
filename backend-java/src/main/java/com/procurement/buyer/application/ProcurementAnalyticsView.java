package com.procurement.buyer.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Public read projection; report consumers do not depend on buyer's private HTTP DTOs. */
public interface ProcurementAnalyticsView {
  BigDecimal totalSpend();
  int orderCount();
  int supplierCount();
  BigDecimal biddingSavings();
  Integer topSupplierSharePercent();
  List<? extends Monthly> monthlySpend();
  List<? extends Supplier> supplierSpend();
  List<? extends Status> statusDistribution();
  List<? extends Category> categoryDemandEstimate();
  Metadata metadata();

  interface Monthly { String period(); BigDecimal totalAmount(); int orderCount(); }
  interface Supplier { String supplierId(); String supplierName(); BigDecimal totalAmount(); int orderCount(); Integer sharePercent(); }
  interface Status { String status(); int orderCount(); BigDecimal totalAmount(); }
  interface Category { String category(); BigDecimal totalAmount(); }
  interface Filters { LocalDate fromDate(); LocalDate toDate(); String supplierId(); String status(); }
  interface Metadata {
    Filters appliedFilters();
    String definitionVersion();
    Instant createdAt();
    String timezone();
    String scopeDescription();
    String orderAmountBasis();
    String quoteDifferenceBasis();
    String estimateBoundary();
  }
}
