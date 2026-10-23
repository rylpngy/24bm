package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.supplier.api.AutoScoreSuggestionResponse;
import com.procurement.supplier.api.ConfirmCooperationTierRequest;
import com.procurement.supplier.api.CreateSupplierEvaluationRequest;
import com.procurement.supplier.api.SupplierEvaluationResponse;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.SupplierCooperationTier;
import com.procurement.supplier.domain.SupplierEvaluation;
import com.procurement.supplier.domain.SupplierFulfillmentMetrics;
import com.procurement.supplier.domain.SupplierPerformanceScoring;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierEvaluationMapper;
import com.procurement.supplier.infrastructure.SupplierFulfillmentMetricsMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** SRM 绩效考核：多维周期评估 + 综合分驱动的生命周期标记建议与调级。 */
@Service
public class SupplierEvaluationApplicationService {
  private static final BigDecimal DEFAULT_DIMENSION = new BigDecimal("80");

  private final SupplierEvaluationMapper evaluationMapper;
  private final BuyerSupplierRelationMapper relationMapper;
  private final SupplierFulfillmentMetricsMapper metricsMapper;
  private final AuditLogApplicationService audit;

  public SupplierEvaluationApplicationService(
      SupplierEvaluationMapper evaluationMapper,
      BuyerSupplierRelationMapper relationMapper,
      SupplierFulfillmentMetricsMapper metricsMapper,
      AuditLogApplicationService audit) {
    this.evaluationMapper = evaluationMapper;
    this.relationMapper = relationMapper;
    this.metricsMapper = metricsMapper;
    this.audit = audit;
  }

  // 按实测履约自动评分:质量=合格率、交付=准时率;价格/服务无客观数据,取默认基准 80。
  public AutoScoreSuggestionResponse autoScore(String relationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    SupplierFulfillmentMetrics m = metricsMapper.aggregate(tenantId, relation.supplierId());
    int receiptCount = m == null ? 0 : m.receiptCount();
    if (receiptCount == 0) {
      return new AutoScoreSuggestionResponse(
          null, null, null, null, null, null, 0, false,
          "暂无收货验收数据,无法按实测履约自动评分。");
    }
    BigDecimal quality = m.totalReceived() > 0
        ? BigDecimal.valueOf(Math.round(m.totalQualified() * 100f / m.totalReceived()))
        : DEFAULT_DIMENSION;
    BigDecimal delivery = BigDecimal.valueOf(Math.round(m.onTimeCount() * 100f / receiptCount));
    BigDecimal total =
        SupplierPerformanceScoring.totalScore(quality, delivery, DEFAULT_DIMENSION, DEFAULT_DIMENSION);
    String tier = SupplierPerformanceScoring.suggestTier(total);
    return new AutoScoreSuggestionResponse(
        quality, delivery, DEFAULT_DIMENSION, DEFAULT_DIMENSION, total, tier, receiptCount, true,
        "基于 " + receiptCount + " 次收货验收:质量=合格率 " + quality + "、交付=准时率 " + delivery
            + ";价格/服务取默认基准 80。");
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

    audit.recordCurrentTenantAction("supplier_evaluation.created", AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId, "考核单=" + id + "，周期=" + request.period() + "，综合分=" + total + "，建议层级=" + suggestedTier);

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
    if (request.evaluationScore() != null) {
      SupplierPerformanceScoring.requireValidScore(request.evaluationScore(), "调级依据");
    }
    relationMapper.updateCooperationTier(
        tenantId, relationId, request.cooperationTier(), request.evaluationScore());
    audit.recordCurrentTenantAction("supplier_cooperation_tier.confirmed", AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId, "合作层级=" + request.cooperationTier() + "，依据分数="
            + (request.evaluationScore() == null ? "未提供" : request.evaluationScore()));
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
