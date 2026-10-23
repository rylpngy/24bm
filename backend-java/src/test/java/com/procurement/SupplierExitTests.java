package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.api.*;
import com.procurement.supplier.application.SupplierExitApplicationService;
import com.procurement.supplier.domain.*;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;

class SupplierExitTests {
  final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  final UnifiedWorkflowApplicationService workflow = mock(UnifiedWorkflowApplicationService.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final NotificationApplicationService notices = mock(NotificationApplicationService.class);
  final ObjectProvider<UnifiedWorkflowApplicationService> provider = mock(ObjectProvider.class);
  final SupplierExitApplicationService service = new SupplierExitApplicationService(relations, provider, audit, notices);
  @BeforeEach void setup() {
    TenantContext.set("tenant", null, "user");
    when(provider.getObject()).thenReturn(workflow);
    when(relations.lockRelation("tenant", "rel")).thenReturn("rel");
    status("已准入");
    when(relations.exitRisk("tenant", "supplier")).thenReturn(new SupplierExitRiskResponse(0, 0, BigDecimal.ZERO));
    when(relations.updateStatus(anyString(), anyString(), anyString(), anyString())).thenReturn(1);
  }
  @AfterEach void clear() { TenantContext.clear(); }
  void status(String status) {
    when(relations.findByTenantAndId("tenant", "rel")).thenReturn(new BuyerSupplierRelation(
        "rel", "tenant", "supplier", "测试供应商", status, "B", "[]", null, null, null,
        null, null, null, null, null, null, null, null));
  }
  WorkflowBusinessInstance instance() {
    return new WorkflowBusinessInstance("instance", "tenant", "buyer_supplier_exit", "rel", "v1", "flow",
        "processing", "user", null, null, "{}", "{}", null, null, null, null);
  }
  @Test void startsWorkflowWithReasonSnapshot() {
    service.submit("rel", new SubmitSupplierExitRequest("合作结束", Map.of()));
    verify(workflow).start(argThat(c -> c.businessType().equals("buyer_supplier_exit")
        && c.businessSnapshot().get("exitReason").equals("合作结束")));
    verify(relations).updateStatus("tenant", "rel", "已准入", "退出审批中");
  }
  @Test void rejectsForeignRelation() {
    when(relations.lockRelation("tenant", "rel")).thenReturn(null);
    assertThatThrownBy(() -> service.submit("rel", new SubmitSupplierExitRequest("结束", null))).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(workflow);
  }
  @Test void rejectsBlankReason() {
    assertThatThrownBy(() -> service.submit("rel", new SubmitSupplierExitRequest(" ", null))).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(workflow);
  }
  @Test void blocksUnsettledBusiness() {
    when(relations.exitRisk("tenant", "supplier")).thenReturn(new SupplierExitRiskResponse(0, 1, BigDecimal.TEN));
    assertThatThrownBy(() -> service.submit("rel", new SubmitSupplierExitRequest("结束", null))).isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(workflow);
  }
  @Test void blocksDuplicateSubmission() {
    status("退出审批中");
    assertThatThrownBy(() -> service.submit("rel", new SubmitSupplierExitRequest("结束", null))).isInstanceOf(IllegalStateException.class);
  }
  @Test void approvalExitsAndAudits() {
    status("退出审批中");
    service.onCompleted(instance(), new WorkflowCompletion(true, "reviewer", "同意"));
    verify(relations).updateStatus("tenant", "rel", "退出审批中", "已退出");
    verify(audit).recordTenantAction("tenant", "buyer_supplier_exit.approved", "buyer_supplier_relation", "rel", "同意");
  }
  @Test void rejectionRestoresAdmission() {
    status("退出审批中");
    service.onCompleted(instance(), new WorkflowCompletion(false, "reviewer", "继续合作"));
    verify(relations).updateStatus("tenant", "rel", "退出审批中", "已准入");
  }
  @Test void rechecksRiskOnApproval() {
    status("退出审批中");
    when(relations.exitRisk("tenant", "supplier")).thenReturn(new SupplierExitRiskResponse(1, 0, BigDecimal.ZERO));
    assertThatThrownBy(() -> service.onCompleted(instance(), new WorkflowCompletion(true, "reviewer", "同意"))).isInstanceOf(IllegalStateException.class);
    verify(relations, never()).updateStatus(anyString(), anyString(), anyString(), anyString());
  }
  @Test void cannotManuallyBypassExitApproval() {
    assertThatThrownBy(() -> new BuyerSupplierManualStatusTransition().requireTransition("退出审批中", "黑名单", "rel"))
        .isInstanceOf(IllegalStateException.class);
    new BuyerSupplierManualStatusTransition().requireTransition("已退出", "待准入", "rel");
  }
}
