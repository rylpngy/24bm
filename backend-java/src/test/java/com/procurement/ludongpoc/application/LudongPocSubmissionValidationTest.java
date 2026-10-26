package com.procurement.ludongpoc.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.ludongpoc.domain.LudongPocApplication;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import com.procurement.ludongpoc.infrastructure.LudongPocReviewRecordMapper;
import com.procurement.organization.application.DepartmentApplicationService;
import com.procurement.organization.domain.Department;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowDefinitionPublicationService;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class LudongPocSubmissionValidationTest {
  private final LudongPocApplicationMapper mapper = mock(LudongPocApplicationMapper.class);
  private final UnifiedWorkflowApplicationService workflows = mock(UnifiedWorkflowApplicationService.class);
  private final WorkflowDefinitionPublicationService definitions = mock(WorkflowDefinitionPublicationService.class);
  private final DepartmentApplicationService departments = mock(DepartmentApplicationService.class);
  private final LudongPocApplicationService service = new LudongPocApplicationService(mapper, definitions, workflows,
      mock(PermissionService.class), mock(AuditLogApplicationService.class), new ObjectMapper(),
      mock(LudongPocReviewRecordMapper.class), mock(MaterialApplicationService.class), departments,
      mock(com.procurement.attachment.infrastructure.AttachmentMapper.class));

  @AfterEach void clear() { TenantContext.clear(); }

  @Test void rejectsIncompleteHistoricalDraftBeforeCreatingFlowableInstance() {
    TenantContext.set("t", null, "applicant");
    when(mapper.findByTenantAndIdForUpdate("t", "app")).thenReturn(new LudongPocApplication(
        "app", "t", "NO", "旧演示草稿", "学院", "dept", BigDecimal.TEN, "draft", "{}", "[]",
        "applicant", null, null, null, null, null, null));
    when(departments.findCurrentTenantActiveDepartment("dept")).thenReturn(new Department("dept", "t", "学院", "parent", "active"));
    assertThrows(IllegalArgumentException.class, () -> service.submit("app"));
    verify(mapper, never()).markSubmitted(anyString(), anyString(), anyString());
    verifyNoInteractions(workflows, definitions);
  }

  @Test void foreignOrMissingApplicationCannotBeSubmitted() {
    TenantContext.set("t", null, "applicant");
    assertThrows(IllegalArgumentException.class, () -> service.submit("foreign-app"));
    verifyNoInteractions(workflows, definitions);
    verify(mapper, never()).markSubmitted(anyString(), anyString(), anyString());
  }
}
