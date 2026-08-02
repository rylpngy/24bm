package com.procurement.platform.application;

import com.procurement.platform.api.SupplierCreditProfileResponse;
import com.procurement.platform.domain.SupplierCreditFacts;
import com.procurement.platform.domain.SupplierCreditPolicy;
import com.procurement.platform.infrastructure.SupplierCreditMapper;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

/** 供应商信用画像(D-3):跨租户履约事实 → 加权信用分与等级。 */
@Service
public class SupplierCreditApplicationService {
  private final SupplierCreditMapper supplierCreditMapper;

  public SupplierCreditApplicationService(SupplierCreditMapper supplierCreditMapper) {
    this.supplierCreditMapper = supplierCreditMapper;
  }

  /** 信用榜:有履约样本者按信用分降序在前,无样本者按名称排在后。 */
  public List<SupplierCreditProfileResponse> listProfiles() {
    return supplierCreditMapper.listAll().stream()
        .map(SupplierCreditApplicationService::toProfile)
        .sorted(Comparator
            .comparing(SupplierCreditProfileResponse::scoreable).reversed()
            .thenComparing(p -> p.creditScore() == null ? BigDecimal.valueOf(-1) : p.creditScore(),
                Comparator.reverseOrder())
            .thenComparing(SupplierCreditProfileResponse::supplierName,
                Comparator.nullsLast(Comparator.naturalOrder())))
        .toList();
  }

  public SupplierCreditProfileResponse profile(String supplierId) {
    SupplierCreditFacts facts = supplierCreditMapper.findBySupplier(supplierId);
    if (facts == null) {
      throw new IllegalArgumentException("供应商不存在: " + supplierId);
    }
    return toProfile(facts);
  }

  private static SupplierCreditProfileResponse toProfile(SupplierCreditFacts f) {
    BigDecimal winRate = SupplierCreditPolicy.rate(f.awardedProjects(), f.participatedProjects());
    BigDecimal completionRate = SupplierCreditPolicy.rate(f.completedOrderCount(), f.orderCount());
    BigDecimal onTimeRate = SupplierCreditPolicy.rate(f.onTimeReceiptCount(), f.completedOrderCount());
    BigDecimal reconciliationRate =
        SupplierCreditPolicy.rate(f.cleanReconciliationCount(), f.invoiceCount());
    boolean scoreable = SupplierCreditPolicy.scoreable(f);
    BigDecimal score = scoreable
        ? SupplierCreditPolicy.creditScore(winRate, completionRate, onTimeRate, reconciliationRate)
        : null;
    return new SupplierCreditProfileResponse(
        f.supplierId(), f.supplierName(), f.verified(),
        f.participatedProjects(), f.awardedProjects(), winRate,
        f.orderCount(), f.completedOrderCount(), completionRate,
        f.onTimeReceiptCount(), onTimeRate,
        f.invoiceCount(), f.cleanReconciliationCount(), reconciliationRate,
        f.servedTenantCount(), f.totalOrderAmount(),
        scoreable, score, SupplierCreditPolicy.creditLevel(score));
  }
}
