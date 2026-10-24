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
import com.procurement.supplier.domain.SupplierEvaluationPeriod;
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
  private final SupplierFulfillmentMetricsService metrics;
  private final SupplierEvaluationTemplateService templates;
  private final AuditLogApplicationService audit;

  public SupplierEvaluationApplicationService(
      SupplierEvaluationMapper evaluationMapper,
      BuyerSupplierRelationMapper relationMapper,
      SupplierFulfillmentMetricsService metrics,
      AuditLogApplicationService audit,
      SupplierEvaluationTemplateService templates) {
    this.evaluationMapper = evaluationMapper;
    this.relationMapper = relationMapper;
    this.metrics = metrics;
    this.templates = templates;
    this.audit = audit;
  }

  public AutoScoreSuggestionResponse autoScore(String relationId) {
    return autoScore(relationId, null);
  }

  public AutoScoreSuggestionResponse autoScore(String relationId, String period) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    var m = metrics.metricsForSupplier(relation.supplierId(), period);
    int receiptCount = m.receiptCount();
    if (receiptCount == 0) {
      return new AutoScoreSuggestionResponse(
          null, null, null, null, null, null, 0, false,
          "暂无收货验收数据,无法按实测履约自动评分。");
    }
    BigDecimal quality = m.derivedQualityScore() == null ? null : BigDecimal.valueOf(m.derivedQualityScore());
    BigDecimal delivery = m.derivedDeliveryScore() == null ? null : BigDecimal.valueOf(m.derivedDeliveryScore());
    return new AutoScoreSuggestionResponse(
        quality, delivery, null, null, null, null, receiptCount, quality != null || delivery != null,
        "基于可见收货验收数据，仅提供实测质量/交付参考；价格、服务需人工评分后计算综合分。");
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
    return createEvaluation(relationId, request, null);
  }

  // Only the assignment service calls this within its row-locked, authorized transaction.
  SupplierEvaluationResponse createAssignedEvaluation(
      String relationId, String taskId, CreateSupplierEvaluationRequest request) {
    return createEvaluation(relationId, request, taskId);
  }

  void requireAvailableTaskPeriod(String relationId, String period) {
    period = SupplierEvaluationPeriod.normalize(period);
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    evaluationMapper.lockRelation(tenantId, relationId);
    if (evaluationMapper.countNormalizedPeriod(tenantId, relation.supplierId(), period,
        SupplierEvaluationPeriod.STRIP_CHARACTERS) > 0) {
      throw new IllegalStateException("该供应商本周期已有考核记录，不能创建考核任务");
    }
  }

  private SupplierEvaluationResponse createEvaluation(
      String relationId, CreateSupplierEvaluationRequest request, String taskId) {
    String period = SupplierEvaluationPeriod.normalize(request.period());
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier evaluation APIs");
    String userId = TenantAccessGuard.requireUserId("buyer supplier evaluation APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);

    evaluationMapper.lockRelation(tenantId, relationId);
    String assignedTaskId = evaluationMapper.assignedTaskId(tenantId, relation.supplierId(), period);
    if ((taskId == null && assignedTaskId != null)
        || (taskId != null && !taskId.equals(assignedTaskId))) {
      throw new IllegalStateException("该周期已有指定考核任务，请由任务负责人通过任务提交考核");
    }

    SupplierPerformanceScoring.requireValidScore(request.qualityScore(), "质量");
    SupplierPerformanceScoring.requireValidScore(request.deliveryScore(), "交付");
    SupplierPerformanceScoring.requireValidScore(request.priceScore(), "价格");
    SupplierPerformanceScoring.requireValidScore(request.serviceScore(), "服务");

    if (evaluationMapper.countNormalizedPeriod(tenantId, relation.supplierId(), period,
        SupplierEvaluationPeriod.STRIP_CHARACTERS) > 0) {
      throw new IllegalStateException("该周期已存在考核单: " + period);
    }

    var scoring = taskId == null ? templates.selectForCreate(request.templateVersionId())
        : templates.assigned(tenantId, evaluationMapper.taskTemplateVersionId(tenantId, taskId));
    BigDecimal total = scoring.total(
        request.qualityScore(), request.deliveryScore(), request.priceScore(), request.serviceScore());
    String suggestedTier = SupplierPerformanceScoring.suggestTier(total);

    String id = "eval-" + UUID.randomUUID();
    evaluationMapper.insert(
        id,
        tenantId,
        relation.supplierId(),
        period,
        request.qualityScore(),
        request.deliveryScore(),
        request.priceScore(),
        request.serviceScore(),
        total,
        suggestedTier,
        request.comment(),
        userId,
        templates.snapshot(scoring));

    audit.recordCurrentTenantAction("supplier_evaluation.created", AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId, "考核单=" + id + "，周期=" + period + "，综合分=" + total + "，建议层级=" + suggestedTier);

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
        e.createdAt(),
        templates.readSnapshot(evaluationMapper.scoringSnapshot(e.tenantId(), e.id())));
  }
}
