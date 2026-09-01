package com.procurement.ludongpoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.ludongpoc.api.LudongPocAiReviewFeedbackRequest;
import com.procurement.ludongpoc.api.LudongPocAiReviewMetricsResponse;
import com.procurement.ludongpoc.api.LudongPocAiReviewResponse;
import com.procurement.ludongpoc.infrastructure.LudongPocAiReviewMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LudongPocAiReviewRegistry {
  private final LudongPocAiReviewMapper mapper;
  private final LudongPocAiEvaluationService evaluationService;
  private final PermissionService permissionService;
  private final AuditLogApplicationService auditService;
  private final ObjectMapper objectMapper;

  public LudongPocAiReviewRegistry(
      LudongPocAiReviewMapper mapper,
      LudongPocAiEvaluationService evaluationService,
      PermissionService permissionService,
      AuditLogApplicationService auditService,
      ObjectMapper objectMapper) {
    this.mapper = mapper;
    this.evaluationService = evaluationService;
    this.permissionService = permissionService;
    this.auditService = auditService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public LudongPocAiReviewResponse record(
      String applicationId, String nodeId, LudongPocAiReviewResponse response) {
    permissionService.require("buyer:ludong-poc:read");
    try {
      mapper.insertRun(
          response.runId(), tenant(), applicationId, normalizeNodeId(nodeId), response.analysisMode(),
          response.modelName(), response.knowledgeVersion(), objectMapper.writeValueAsString(response), user());
    } catch (Exception exception) {
      throw new IllegalStateException("AI 辅助评审结果保存失败", exception);
    }
    auditService.recordCurrentTenantAction(
        "ludong_poc.ai_review.generated", "ludong_project_application", applicationId,
        "节点 " + normalizeNodeId(nodeId) + " 生成 " + response.analysisMode()
            + " 辅助评审，知识版本 " + response.knowledgeVersion());
    return response;
  }

  @Transactional
  public void feedback(
      String applicationId, String runId, LudongPocAiReviewFeedbackRequest request) {
    permissionService.require("buyer:ludong-poc:review");
    if (!mapper.runBelongsToApplication(tenant(), applicationId, runId)) {
      throw new IllegalArgumentException("AI 评审记录不存在或不属于当前项目");
    }
    mapper.upsertFeedback(
        "ldu-ai-feedback-" + UUID.randomUUID(), tenant(), runId, request.findingId(), user(),
        request.disposition(), blankToNull(request.comment()));
    auditService.recordCurrentTenantAction(
        "ludong_poc.ai_review.feedback", "ludong_project_application", applicationId,
        "结论 " + request.findingId() + " 标记为 " + request.disposition());
  }

  public LudongPocAiReviewMetricsResponse metrics() {
    permissionService.require("buyer:ludong-poc:read");
    LudongPocAiEvaluationService.EvaluationResult evaluation = evaluationService.evaluate();
    int feedback = mapper.countFeedback(tenant());
    int adopted = mapper.countFeedbackByDisposition(tenant(), "adopted");
    int falsePositive = mapper.countFeedbackByDisposition(tenant(), "false_positive");
    return new LudongPocAiReviewMetricsResponse(
        evaluation.datasetVersion(), evaluation.sampleCount(), evaluation.expectedRiskCount(),
        evaluation.detectedRiskCount(), evaluation.truePositiveCount(), evaluation.falsePositiveCount(),
        evaluation.riskRecall(), evaluation.riskPrecision(), feedback, adopted, falsePositive,
        feedback == 0 ? 0 : Math.round(adopted * 10000.0 / feedback) / 10000.0);
  }

  private static String normalizeNodeId(String nodeId) {
    String value = nodeId == null ? "" : nodeId.trim();
    return value.startsWith("task_") ? value.substring(5) : value;
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String tenant() {
    return TenantAccessGuard.requireTenantId("Ludong AI review APIs");
  }

  private static String user() {
    return TenantAccessGuard.requireUserId("Ludong AI review APIs");
  }
}
