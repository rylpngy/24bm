package com.procurement.supplier.application;

import com.procurement.common.tenant.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.CreateSupplierEvaluationRequest;
import com.procurement.supplier.api.PerformanceTaskRequests.*;
import com.procurement.supplier.api.PerformanceTaskResponse;
import com.procurement.supplier.api.PerformanceTaskResponse.Assignee;
import com.procurement.supplier.domain.PerformanceTask;
import com.procurement.supplier.domain.SupplierEvaluationPeriod;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.PerformanceTaskMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerformanceTaskApplicationService {
  private final PerformanceTaskMapper mapper;
  private final BuyerSupplierRelationMapper relations;
  private final SupplierEvaluationApplicationService evaluations;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;

  public PerformanceTaskApplicationService(PerformanceTaskMapper mapper, BuyerSupplierRelationMapper relations,
      SupplierEvaluationApplicationService evaluations, PermissionService permissions, AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.relations = relations;
    this.evaluations = evaluations;
    this.permissions = permissions;
    this.audit = audit;
  }

  public List<PerformanceTaskResponse> listBuyer(String relationId) {
    buyerActor(false);
    requireRelation(relationId);
    return mapper.listBuyer(tenantId(), relationId).stream().map(this::response).toList();
  }

  public List<Assignee> assignees(String relationId) {
    buyerActor(false);
    requireRelation(relationId);
    return mapper.assignees(tenantId());
  }

  @Transactional
  public PerformanceTaskResponse create(String relationId, Create request) {
    String actor = buyerActor(true);
    var relation = requireRelation(relationId);
    String period = normalizePeriod(request.period());
    validateDueDate(request.dueDate());
    evaluations.requireAvailableTaskPeriod(relationId, period);
    Assignee assignee = mapper.assignees(tenantId()).stream()
        .filter(a -> a.id().equals(request.assigneeId())).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("负责人必须是本企业具备供应商管理权限的在职采购用户"));
    String id = "perf-" + UUID.randomUUID();
    var task = new PerformanceTask(id, relation.tenantId(), relation.supplierId(), relation.id(),
        relation.supplierName(), null, period, assignee.id(), assignee.displayName(), request.dueDate(),
        "assigned", null, null, null, null, 0L);
    try {
      mapper.insert(task);
    } catch (DuplicateKeyException ex) {
      throw new IllegalStateException("该供应商本周期已存在考核任务", ex);
    }
    event(task, "assigned", actor, "负责人：" + assignee.displayName() + "；截止日期：" + request.dueDate());
    return response(mapper.lockBuyer(task.tenantId(), relationId, id));
  }

  @Transactional
  public PerformanceTaskResponse evaluate(String relationId, String taskId, Evaluate request) {
    String actor = buyerActor(true);
    var task = buyerTask(relationId, taskId);
    if (!task.assigneeId().equals(userId())) {
      throw new PermissionDeniedException("仅任务指定负责人可提交考核");
    }
    requireStatus(task, "assigned");
    String comment = requiredText(request.comment());
    var evaluation = evaluations.createAssignedEvaluation(relationId, taskId, new CreateSupplierEvaluationRequest(
        task.period(), request.qualityScore(), request.deliveryScore(), request.priceScore(),
        request.serviceScore(), comment));
    mapper.update(task.id(), task.tenantId(), "evaluated", evaluation.id(), evaluation.totalScore(),
        null, null, task.dueDate());
    event(task, "evaluated", actor, comment);
    return response(mapper.lockBuyer(task.tenantId(), relationId, taskId));
  }

  @Transactional
  public PerformanceTaskResponse requestRemediation(String relationId, String taskId, Remediation request) {
    String actor = buyerActor(true);
    var task = buyerTask(relationId, taskId);
    requireStatus(task, "evaluated");
    String requirement = requiredText(request.requirement());
    validateDueDate(request.dueDate());
    mapper.update(task.id(), task.tenantId(), "remediation_requested", task.evaluationId(), task.totalScore(),
        requirement, null, request.dueDate());
    event(task, "remediation_requested", actor, requirement + "\n截止日期：" + request.dueDate());
    return response(mapper.lockBuyer(task.tenantId(), relationId, taskId));
  }

  @Transactional
  public PerformanceTaskResponse review(String relationId, String taskId, Review request) {
    String actor = buyerActor(true);
    var task = buyerTask(relationId, taskId);
    requireVersion(task, request.expectedVersion());
    requireStatus(task, "remediation_submitted");
    String comment = requiredText(request.comment());
    if (request.approved() == null) throw new IllegalArgumentException("请选择复核结论");
    String status = request.approved() ? "closed" : "remediation_requested";
    mapper.update(task.id(), task.tenantId(), status, task.evaluationId(), task.totalScore(),
        task.requirement(), task.response(), task.dueDate());
    event(task, request.approved() ? "closed" : "remediation_rejected", actor, comment);
    return response(mapper.lockBuyer(task.tenantId(), relationId, taskId));
  }

  public List<PerformanceTaskResponse> listSupplier() {
    supplierActor(false);
    return mapper.listSupplier(supplierId()).stream().map(this::response).toList();
  }

  @Transactional
  public PerformanceTaskResponse respond(String taskId, Response request) {
    String actor = supplierActor(true);
    var task = mapper.lockSupplier(supplierId(), taskId);
    if (task == null) throw new IllegalArgumentException("绩效任务不存在");
    requireVersion(task, request.expectedVersion());
    requireStatus(task, "remediation_requested");
    String text = requiredText(request.response());
    mapper.update(task.id(), task.tenantId(), "remediation_submitted", task.evaluationId(), task.totalScore(),
        task.requirement(), text, task.dueDate());
    event(task, "remediation_submitted", actor, text);
    return response(mapper.lockSupplier(supplierId(), taskId));
  }

  public static String normalizePeriod(String period) {
    return SupplierEvaluationPeriod.normalize(period);
  }

  public static void validateDueDate(LocalDate date) {
    if (date == null || date.isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai")))) {
      throw new IllegalArgumentException("截止日期不得早于今天");
    }
  }

  private String buyerActor(boolean write) {
    String tenantId = TenantAccessGuard.requireTenantId("performance tasks");
    String userId = TenantAccessGuard.requireUserId("performance tasks");
    permissions.require("buyer:supplier:" + (write ? "manage" : "read"));
    String name = mapper.buyerActor(tenantId, userId);
    if (name == null) throw new PermissionDeniedException("需要有效的采购方用户身份");
    return name;
  }

  private String supplierActor(boolean write) {
    String supplierId = TenantAccessGuard.requireSupplierId("performance tasks");
    String userId = TenantAccessGuard.requireUserId("performance tasks");
    // Same permission mapping as PortalPermissionPolicy, also enforced for direct service callers.
    permissions.require("supplier:profile:" + (write ? "manage" : "read"));
    String name = mapper.supplierActor(supplierId, userId);
    if (name == null) throw new PermissionDeniedException("需要有效的供应商用户身份");
    return name;
  }

  private com.procurement.supplier.domain.BuyerSupplierRelation requireRelation(String id) {
    var relation = relations.findByTenantAndId(tenantId(), id);
    if (relation == null) throw new IllegalArgumentException("供应商关系不存在");
    return relation;
  }

  private PerformanceTask buyerTask(String relationId, String id) {
    var task = mapper.lockBuyer(tenantId(), relationId, id);
    if (task == null) throw new IllegalArgumentException("绩效任务不存在");
    return task;
  }

  private void requireStatus(PerformanceTask task, String status) {
    if (!status.equals(task.status())) throw new IllegalStateException("当前任务状态不允许执行此操作");
  }

  private void requireVersion(PerformanceTask task, Long expectedVersion) {
    if (expectedVersion == null || expectedVersion < 0) {
      throw new IllegalArgumentException("必须提供有效的任务版本号");
    }
    if (task.version() != expectedVersion) {
      throw new IllegalStateException("任务已更新，请刷新后重试");
    }
  }

  private String requiredText(String text) {
    if (text == null || text.isBlank() || text.length() > 10000) {
      throw new IllegalArgumentException("内容不能为空且不得超过10000字");
    }
    return text.strip();
  }

  private void event(PerformanceTask task, String action, String actor, String comment) {
    mapper.event(task.id(), action, userId(), actor, comment);
    audit.recordTenantAction(task.tenantId(), "supplier_performance_task." + action,
        "supplier_performance_task", task.id(), comment);
  }

  private PerformanceTaskResponse response(PerformanceTask task) {
    return new PerformanceTaskResponse(task.id(), task.relationId(), task.supplierName(), task.buyerName(),
        task.period(), task.assigneeId(), task.assigneeName(), task.dueDate(), task.status(), task.evaluationId(),
        task.totalScore(), task.requirement(), task.response(), mapper.history(task.id()), task.version());
  }

  private String tenantId() { return TenantAccessGuard.requireTenantId("performance tasks"); }
  private String supplierId() { return TenantAccessGuard.requireSupplierId("performance tasks"); }
  private String userId() { return TenantAccessGuard.requireUserId("performance tasks"); }
}
