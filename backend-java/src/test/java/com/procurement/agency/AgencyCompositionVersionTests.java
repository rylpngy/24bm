package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyExecutionRecords.Document;
import com.procurement.agency.domain.AgencyExecutionRecords.Job;
import com.procurement.agency.infrastructure.*;
import com.procurement.attachment.application.AttachmentArtifactWriter;
import com.procurement.identity.application.PermissionService;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AgencyCompositionVersionTests {
  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void asynchronousCompletionNeverAttachesOutputAfterDraftOrPublicBasisChanged(
      boolean draftChanged) {
    var guard = mock(AgencyGuard.class);
    var permissions = mock(PermissionService.class);
    when(guard.tenant()).thenReturn("t");
    when(guard.permissions()).thenReturn(permissions);
    var mapper = mock(AgencyExecutionMapper.class);
    var packages = mock(AgencyMapper.class);
    var packageRow =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .convertValue(
                java.util.Map.of("id", "p", "tenantId", "t", "businessStatus", "in_progress"),
                com.procurement.agency.domain.AgencyRecords.PackageRow.class);
    when(packages.lock("t", "p")).thenReturn(packageRow);
    var writer = mock(AttachmentArtifactWriter.class);
    var support =
        new AgencyExecutionSupport(guard, packages, mapper, null, null, null, null, writer, null);
    var basis = mock(AgencyDocumentBasis.class);
    var doc =
        new Document(
            "d",
            "t",
            "p",
            "purchase",
            null,
            "[]",
            "{}",
            "{}",
            draftChanged ? 2 : 1,
            "draft",
            null,
            "u",
            null);
    var job =
        new Job(
            "j",
            "t",
            "p",
            "compose",
            "d",
            1L,
            "{}",
            "processing",
            1,
            "{}",
            null,
            "u",
            null,
            null,
            null);
    when(mapper.document("t", "d")).thenReturn(doc);
    when(mapper.lockDocument("t", "d")).thenReturn(doc);
    when(mapper.lockJob("t", "j")).thenReturn(job);
    when(basis.stale("t", "p", "{}")).thenReturn(!draftChanged);
    var service = new AgencyDocumentService(support, basis, null, null, null);
    assertThat(service.finishComposition(job, new byte[] {1, 2})).isNull();
    verify(mapper).finishJob("t", "j", "stale", "{}", "输入版本已变化，输出未挂入当前稿");
    verifyNoInteractions(writer);
    verify(mapper, never())
        .revisionCreate(
            anyString(),
            anyString(),
            anyString(),
            anyLong(),
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            any(),
            anyString());
  }

  @org.junit.jupiter.api.Test
  void generalTemplateAuditDoesNotDuplicateConfidentialChapterBodies() {
    var audit = mock(com.procurement.audit.application.AuditLogApplicationService.class);
    var json = new AgencyJson(new com.fasterxml.jackson.databind.ObjectMapper());
    var support = new AgencyExecutionSupport(null, null, null, json, null, null, null, null, audit);
    support.templateEvent(
        "template-1", null, java.util.Map.of("body", "PRIVATE-CHAPTER-CONTENT"), "保存版本");
    var detail = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(audit)
        .recordCurrentTenantAction(
            eq("agency.template.changed"),
            eq("agency_template"),
            eq("template-1"),
            detail.capture());
    assertThat(detail.getValue()).doesNotContain("PRIVATE-CHAPTER-CONTENT");
    assertThat(json.tree(detail.getValue()).path("afterHash").asText()).hasSize(64);
  }

  @org.junit.jupiter.api.Test
  void reclaimedExecutionRejectsOldClaimEvenWhenExplicitRetryReusesAttemptNumber() {
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    when(guard.permissions()).thenReturn(mock(PermissionService.class));
    var mapper = mock(AgencyExecutionMapper.class);
    var packages = mock(AgencyMapper.class);
    var packageRow =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .convertValue(
                java.util.Map.of("id", "p", "tenantId", "t", "businessStatus", "in_progress"),
                com.procurement.agency.domain.AgencyRecords.PackageRow.class);
    when(packages.lock("t", "p")).thenReturn(packageRow);
    var writer = mock(AttachmentArtifactWriter.class);
    var support =
        new AgencyExecutionSupport(guard, packages, mapper, null, null, null, null, writer, null);
    var doc =
        new Document(
            "d", "t", "p", "purchase", null, "[]", "{}", "{}", 1, "draft", null, "u", null);
    var oldTime = java.time.OffsetDateTime.parse("2026-11-08T01:00:00Z");
    var former =
        new Job(
            "j",
            "t",
            "p",
            "compose",
            "d",
            1L,
            "{}",
            "processing",
            1,
            "{}",
            null,
            "u",
            null,
            oldTime,
            null);
    var newer =
        new Job(
            "j",
            "t",
            "p",
            "compose",
            "d",
            1L,
            "{}",
            "processing",
            1,
            "{}",
            null,
            "u",
            null,
            oldTime.plusMinutes(10),
            null);
    when(mapper.document("t", "d")).thenReturn(doc);
    when(mapper.lockDocument("t", "d")).thenReturn(doc);
    when(mapper.lockJob("t", "j")).thenReturn(newer);
    var service = new AgencyDocumentService(support, null, null, null, null);
    assertThatThrownBy(() -> service.finishComposition(former, new byte[] {1}))
        .hasMessageContaining("任务状态已变化");
    verifyNoInteractions(writer);
    verify(mapper, never()).finishJob(anyString(), anyString(), anyString(), anyString(), any());
  }
}
