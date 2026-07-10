package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.RfqSupplierPerformanceResponse;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.SupplierEvaluation;
import com.procurement.supplier.infrastructure.SupplierEvaluationMapper;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

// 绩效复盘联动定标:为某 RFQ 当前轮的报价供应商带出最新历史绩效(总分+分级),供定标参考。
@Service
public class RfqSupplierPerformanceApplicationService {

  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final SupplierEvaluationMapper supplierEvaluationMapper;

  public RfqSupplierPerformanceApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      SupplierEvaluationMapper supplierEvaluationMapper) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.supplierEvaluationMapper = supplierEvaluationMapper;
  }

  public List<RfqSupplierPerformanceResponse> listForRfq(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    // 去重保序:当前轮每个报价供应商各取一次。
    Set<String> supplierIds = new LinkedHashSet<>();
    for (Quote q : quoteMapper.listByTenantAndRfqAndRound(tenantId, rfqId, rfq.currentRound())) {
      supplierIds.add(q.supplierId());
    }
    return supplierIds.stream().map(id -> toResponse(tenantId, id)).toList();
  }

  private RfqSupplierPerformanceResponse toResponse(String tenantId, String supplierId) {
    List<SupplierEvaluation> history = supplierEvaluationMapper.listBySupplier(tenantId, supplierId);
    if (history.isEmpty()) {
      return new RfqSupplierPerformanceResponse(supplierId, null, null, null, false);
    }
    SupplierEvaluation latest = history.get(0);
    return new RfqSupplierPerformanceResponse(
        supplierId, latest.totalScore(), latest.suggestedTier(), latest.period(), true);
  }
}
