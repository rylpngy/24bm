package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.api.SubmitSupplierExitRequest;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierExitApplicationService implements WorkflowBusinessCompletionHandler {
  public static final String BUSINESS_TYPE = "buyer_supplier_exit";
  private final BuyerSupplierRelationMapper relations;
  private final org.springframework.beans.factory.ObjectProvider<UnifiedWorkflowApplicationService> workflows;
  private final AuditLogApplicationService audit;
  private final NotificationApplicationService notifications;

  public SupplierExitApplicationService(BuyerSupplierRelationMapper relations,
      org.springframework.beans.factory.ObjectProvider<UnifiedWorkflowApplicationService> workflows,
      AuditLogApplicationService audit, NotificationApplicationService notifications) {
    this.relations = relations;
    this.workflows = workflows;
    this.audit = audit;
    this.notifications = notifications;
  }

  @Override public String businessType() { return BUSINESS_TYPE; }

  @Transactional
  public WorkflowStartResult submit(String relationId, SubmitSupplierExitRequest request) {
    String tenant = TenantAccessGuard.requireTenantId("supplier exit");
    if (request.reason() == null || request.reason().isBlank() || request.reason().length() > 2000) {
      throw new IllegalArgumentException("请填写不超过2000字的退出原因");
    }
    BuyerSupplierRelation relation = lockedRelation(tenant, relationId);
    if (!BuyerSupplierRelationStatus.ADMITTED.equals(relation.status())) {
      throw new IllegalStateException("只有已准入供应商可以申请退出，不能重复提交");
    }
    requireSettled(tenant, relation);
    changeStatus(tenant, relationId, relation.status(), BuyerSupplierRelationStatus.IN_EXIT_APPROVAL);
    WorkflowStartResult result = workflows.getObject().start(new WorkflowStartCommand(
        BUSINESS_TYPE, relationId, null, null, request.formData() == null ? Map.of() : request.formData(),
        Map.of("supplierId", relation.supplierId(), "supplierName", relation.supplierName(),
            "exitReason", request.reason().trim(), "unreceivedOrderCount", 0, "unpaidInvoiceCount", 0)));
    audit.recordCurrentTenantAction("buyer_supplier_exit.submitted", "buyer_supplier_relation", relationId, request.reason().trim());
    return result;
  }

  @Override
  @Transactional
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    BuyerSupplierRelation relation = lockedRelation(instance.tenantId(), instance.businessId());
    if (!BuyerSupplierRelationStatus.IN_EXIT_APPROVAL.equals(relation.status())) {
      throw new IllegalStateException("供应商不处于退出审批中，不能重复处理");
    }
    if (completion.approved()) requireSettled(instance.tenantId(), relation);
    changeStatus(instance.tenantId(), relation.id(), relation.status(), completion.approved()
        ? BuyerSupplierRelationStatus.EXITED : BuyerSupplierRelationStatus.ADMITTED);
    audit.recordTenantAction(instance.tenantId(), completion.approved()
        ? "buyer_supplier_exit.approved" : "buyer_supplier_exit.rejected",
        "buyer_supplier_relation", relation.id(), completion.comment());
    notifications.notifyActiveTenantUsers(instance.tenantId(), "供应商退出审批结果",
        relation.supplierName() + (completion.approved() ? "已退出，历史业务保留。" : "退出申请已驳回，恢复已准入。"));
  }

  private BuyerSupplierRelation lockedRelation(String tenant, String id) {
    if (relations.lockRelation(tenant, id) == null) throw new IllegalArgumentException("未找到本企业供应商关系");
    return relations.findByTenantAndId(tenant, id);
  }

  private void requireSettled(String tenant, BuyerSupplierRelation relation) {
    var risk = relations.exitRisk(tenant, relation.supplierId());
    if (risk.unreceivedOrderCount() > 0 || risk.unpaidInvoiceCount() > 0) {
      throw new IllegalStateException("仍有未收货订单或未付清发票，请先处理未结业务后再退出");
    }
  }

  private void changeStatus(String tenant, String id, String expected, String next) {
    if (relations.updateStatus(tenant, id, expected, next) != 1) {
      throw new IllegalStateException("供应商状态已变化，请刷新后重试");
    }
  }
}
