package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.api.AiReviewDtos.*;
import com.procurement.ai.application.*;
import com.procurement.ai.infrastructure.*;
import com.procurement.attachment.application.*;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.sourcing.application.ProcurementRiskAiSubjectAdapter;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;

class AiReviewFreezeRegressionTests {
  ObjectMapper json=new ObjectMapper().findAndRegisterModules();
  PermissionService permissions=mock(PermissionService.class);
  AuditLogApplicationService audit=mock(AuditLogApplicationService.class);
  AiReviewMapper runs=mock(AiReviewMapper.class);
  AiPolicyApplicationService policySource=mock(AiPolicyApplicationService.class);
  AiModelGateway gateway=snapshot -> new ModelResult("RULE_ASSISTED",null,"未配置","规则辅助");
  @BeforeEach void context() { TenantContext.set("t1",null,"u1"); }
  @AfterEach void cleanup() { TenantContext.clear(); }
  private AiReviewApplicationService service(AiSubjectAdapter adapter) {
    return new AiReviewApplicationService(List.of(adapter),runs,permissions,audit,json,gateway,policySource,new AiReviewPersistence(runs,audit));
  }
  @Test void workflowInstancesAreImmutableAuthorizationTargets() throws Exception {
    var fixture=new ProcurementExecutionServiceTests(); fixture.setup();
    try {
      var now=OffsetDateTime.parse("2026-10-24T10:00:00+08:00");
      var instance=new WorkflowBusinessInstance("workflow-1","t","rfq_award","r","v1","flow-1","processing","u","dept",BigDecimal.ONE,"{}","{}",null,null,now,now);
      when(fixture.workflow.procurementExecutionHistory(anyList())).thenReturn(List.of(new UnifiedWorkflowApplicationService.ProcurementExecutionHistory(instance,List.of())));
      var adapter=new ProcurementRiskAiSubjectAdapter(fixture.service); var snapshot=adapter.capture("r");
      assertThat(snapshot.accessTargets()).contains(new AccessTarget("workflow_instance","workflow-1"));
    } finally { fixture.clear(); }
  }
  @Test void revokedWorkflowScopeBlocksDetailHistoryAndFeedbackForPersistedRiskRun() throws Exception {
    var fixture=new ProcurementExecutionServiceTests(); fixture.setup();
    try {
      var now=OffsetDateTime.parse("2026-10-24T10:00:00+08:00");
      var instance=new WorkflowBusinessInstance("workflow-1","t","rfq_award","r","v1","flow-1","processing","u","dept",BigDecimal.ONE,"{}","{}",null,null,now,now);
      when(fixture.workflow.procurementExecutionHistory(anyList())).thenReturn(List.of(new UnifiedWorkflowApplicationService.ProcurementExecutionHistory(instance,List.of())));
      when(policySource.published("procurement_risk")).thenReturn(List.of());
      var service=service(new ProcurementRiskAiSubjectAdapter(fixture.service)); var run=service.create(new CreateReview("procurement_risk","r",null));
      var payload=org.mockito.ArgumentCaptor.forClass(String.class);
      verify(runs).insertRun(any(),any(),any(),any(),any(),payload.capture(),any(),any(),any());
      var row=new AiReviewMapper.RunRow(run.runId(),"t","procurement_risk","r",payload.getValue(),AiSupport.hash(AiSupport.utf8(payload.getValue())),run.createdAt());
      when(runs.find("t",run.runId())).thenReturn(row); when(runs.history("t","procurement_risk","r",10)).thenReturn(List.of(row));
      doThrow(new PermissionDeniedException("workflow scope revoked")).when(fixture.workflow).requireCurrentTenantInstanceReadAccess("workflow-1");
      assertThatThrownBy(() -> service.detail(run.runId())).isInstanceOf(PermissionDeniedException.class);
      assertThatThrownBy(() -> service.history("procurement_risk","r",10)).isInstanceOf(PermissionDeniedException.class);
      assertThatThrownBy(() -> service.feedback(run.runId(),new SubmitFeedback(run.findings().getFirst().id(),"adopted",null)))
          .isInstanceOf(PermissionDeniedException.class);
      verify(runs,never()).saveFeedback(any(),any(),any(),any(),any(),any(),any());
    } finally { fixture.clear(); }
  }
  private AttachmentAiSubjectAdapter attachment() {
    var metadata=mock(AttachmentMapper.class); var files=mock(AttachmentApplicationService.class);
    byte[] content="验收要求".getBytes(StandardCharsets.UTF_8); String hash=AiSupport.hash(content);
    when(metadata.findByTenantAndId("t1","a1")).thenReturn(new Attachment("a1","t1","demand","d1","a.txt","t1/demand/d1/a1","u1","buyer_internal","active",OffsetDateTime.now()));
    when(metadata.fingerprint("t1","a1")).thenReturn(new AttachmentMapper.Fingerprint((long)content.length,hash));
    when(files.loadCurrentTenantObject("a1")).thenReturn(new AttachmentApplicationService.DownloadedObject("a.txt",content,"text/plain"))
        .thenThrow(new IllegalStateException("file became unavailable"));
    return new AttachmentAiSubjectAdapter(files,mock(AttachmentAccessService.class),metadata,new AttachmentTextExtractor());
  }
  @Test void attachmentSuccessAndReadFailureHaveDifferentRevisions() {
    var adapter=attachment(); var success=adapter.capture("a1"); var failed=adapter.capture("a1");
    assertThat(success.sourceRevision()).isNotEqualTo(failed.sourceRevision());
    assertThat(failed.evidence()).filteredOn(e -> e.id().equals("actualHash")).allSatisfy(e -> {
      assertThat(e.value()).isEmpty(); assertThat(e.sourceHash()).isNull();
    });
  }
  @Test void attachmentBecomingUnreadableDuringReviewConflictsAndWritesNothing() {
    when(policySource.published("attachment")).thenReturn(List.of());
    assertThatThrownBy(() -> service(attachment()).create(new CreateReview("attachment","a1",null))).isInstanceOf(AiConflictException.class);
    verifyNoInteractions(runs);
  }
  @Test void tenantVersionCapIsCheckedBeforeInsertUnderGlobalThenKeyLocks() {
    var mapper=mock(AiPolicyMapper.class); when(mapper.countVersions("t1")).thenReturn(200);
    var policies=new AiPolicyApplicationService(mapper,permissions,audit,json);
    assertThatThrownBy(() -> policies.create(new CreatePolicy("new","制度",List.of("demand"),List.of(new Clause("c1","条款","正文")),0)))
        .isInstanceOf(AiConflictException.class).hasMessageContaining("200");
    var order=inOrder(mapper); order.verify(mapper).lock("t1:ai-policies"); order.verify(mapper).lock("t1:ai-policy:new");
    verify(mapper,never()).insert(any(),any(),any(),anyInt(),any(),any(),any(),any());
  }
  @Test void publishedPolicyFilteringHappensBeforeTheBoundedRead() {
    var mapper=mock(AiPolicyMapper.class); when(mapper.publishedForSubject("t1","demand")).thenReturn(List.of());
    assertThat(new AiPolicyApplicationService(mapper,permissions,audit,json).published("demand")).isEmpty();
    verify(mapper).publishedForSubject("t1","demand");
  }
  @Test void publicationRefusesExcessSubjectPoliciesBeforeRetiringTheExistingVersion() throws Exception {
    var mapper=mock(AiPolicyMapper.class);
    String content=json.writeValueAsString(Map.of("subjectTypes",List.of("demand"),"clauses",List.of(new Clause("c1","条款","正文"))));
    String hash=AiSupport.revision(Map.of("key","new","version",1,"title","制度","content",content));
    var row=new AiPolicyMapper.PolicyRow("p1","new",1,"制度",content,"draft",hash,"u1",OffsetDateTime.now());
    when(mapper.find("t1","p1")).thenReturn(row); when(mapper.latest("t1","new")).thenReturn(1);
    when(mapper.countPublishedForSubject("t1","demand","new")).thenReturn(50);
    assertThatThrownBy(() -> new AiPolicyApplicationService(mapper,permissions,audit,json).publish("p1"))
        .isInstanceOf(AiConflictException.class).hasMessageContaining("50");
    verify(mapper,never()).retirePublished(any(),any()); verify(mapper,never()).transition(any(),any(),any(),any());
  }
}
