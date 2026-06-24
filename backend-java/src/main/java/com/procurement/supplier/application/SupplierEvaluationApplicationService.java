package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.ConfirmCooperationTierRequest;
import com.procurement.supplier.api.CreateSupplierEvaluationRequest;
import com.procurement.supplier.api.SupplierEvaluationResponse;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.SupplierCooperationTier;
import com.procurement.supplier.domain.SupplierEvaluation;
import com.procurement.supplier.domain.SupplierPerformanceScoring;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierEvaluationMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** SRM 绩效考核：多维周期评估 + 综合分驱动的生命周期标记建议与调级。 */
@Service
public class SupplierEvaluationApplicationService {
  private final SupplierEvaluationMapper evaluationMapper;
  private final BuyerSupplierRelationMapper relationMapper;

  public SupplierEvaluationApplicationService(
      SupplierEvaluationMapper evaluationMapper, BuyerSupplierRelationMapper relationMapper) {
    this.evaluationMapper = evaluationMapper;
    this.relationMapper = relationMapper;
  }

  public List<SupplierEvaluationResponse> listEvaluations(String relationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    return evaluationMapper.listBySupplier(tenantId, relation.supplierId()).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public SupplierEvaluationResponse createEvaluation(
      String relationId, CreateSupplierEvaluationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    String userId = TenantAccessGuard.requireUserId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);

    SupplierPerformanceScoring.requireValidScore(request.qualityScore(), "质量");
    SupplierPerformanceScoring.requireValidScore(request.deliveryScore(), "交付");
    SupplierPerformanceScoring.requireValidScore(request.priceScore(), "价格");
    SupplierPerformanceScoring.requireValidScore(request.serviceScore(), "服务");

    if (evaluationMapper.countByPeriod(tenantId, relation.supplierId(), request.period()) > 0) {
      throw new IllegalStateException("该周期已存在考核单: " + request.period());
    }

    BigDecimal total = SupplierPerformanceScoring.totalScore(
        request.qualityScore(), request.deliveryScore(), request.priceScore(), request.serviceScore());
    String suggestedTier = SupplierPerformanceScoring.suggestTier(total);

    String id = "eval-" + UUID.randomUUID();
    evaluationMapper.insert(
        id,
        tenantId,
        relation.supplierId(),
        request.period(),
        request.qualityScore(),
        request.deliveryScore(),
        request.priceScore(),
        request.serviceScore(),
        total,
        suggestedTier,
        request.comment(),
        userId);

    return evaluationMapper.listBySupplier(tenantId, relation.supplierId()).stream()
        .filter(e -> e.id().equals(id))
        .map(this::toResponse)
        .findFirst()
        .orElseThrow();
  }

  /** 采购方确认调级：把生命周期标记写入私域关系（保留人控权）。 */
  @Transactional
  public void confirmTier(String relationId, ConfirmCooperationTierRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    requireRelation(tenantId, relationId);
    SupplierCooperationTier.requireValid(request.cooperationTier());
    relationMapper.updateCooperationTier(
        tenantId, relationId, request.cooperationTier(), request.evaluationScore());
  }

  private BuyerSupplierRelation requireRelation(String tenantId, String relationId) {
    BuyerSupplierRelation relation = relationMapper.findByTenantAndId(tenantId, relationId);
    if (relation == null) {
      throw new IllegalArgumentException("供应商关系不存在: " + relationId);
    }
    return relation;
  }

  private SupplierEvaluationResponse toResponse(SupplierEvaluation e) {
    return new SupplierEvaluationResponse(
        e.id(),
        e.supplierId(),
        e.period(),
        e.qualityScore(),
        e.deliveryScore(),
        e.priceScore(),
        e.serviceScore(),
        e.totalScore(),
        e.suggestedTier(),
        e.comment(),
        e.evaluatedBy(),
        e.createdAt());
  }
}
