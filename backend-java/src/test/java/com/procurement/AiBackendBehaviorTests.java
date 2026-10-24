package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.api.AiReviewDtos.*;
import com.procurement.ai.application.*;
import com.procurement.ai.infrastructure.*;
import com.procurement.attachment.application.AttachmentTextExtractor;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.*;

class AiBackendBehaviorTests {
  ObjectMapper json = new ObjectMapper().findAndRegisterModules();
  AiReviewMapper mapper = mock(AiReviewMapper.class);
  PermissionService permissions = mock(PermissionService.class);
  AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  AiSubjectAdapter adapter = mock(AiSubjectAdapter.class);
  AiModelGateway gateway = mock(AiModelGateway.class);
  AiPolicyApplicationService policies = mock(AiPolicyApplicationService.class);
  AiReviewApplicationService service;
  Snapshot snapshot = new Snapshot("revision-1", List.of(AiSupport.field("budget", "Budget", "-1", "d1", "hash")),
      List.of(AiSupport.finding("negative-budget", "risk", "Negative budget", "Budget must not be negative", "budget")),
      List.of(), List.of());
  @BeforeEach void setup() {
    TenantContext.set("t1", null, "u1"); when(adapter.subjectType()).thenReturn("demand");
    when(adapter.capture("d1")).thenReturn(snapshot); when(policies.published("demand")).thenReturn(List.of());
    when(gateway.analyze(any())).thenReturn(new ModelResult("RULE_ASSISTED", null, "not_configured", "Rules only"));
    service = new AiReviewApplicationService(List.of(adapter), mapper, permissions, audit, json, gateway, policies,new AiReviewPersistence(mapper,audit));
  }
  @AfterEach void cleanup() { TenantContext.clear(); }
  @Test void sourceRevisionConflictHasNoProviderOrPersistenceSideEffects() {
    assertThatThrownBy(() -> service.create(new CreateReview("demand", "d1", "old"))).isInstanceOf(AiConflictException.class);
    verifyNoInteractions(gateway); verifyNoInteractions(mapper);
  }
  @Test void noPolicyRetainsRisksAndDisclosesManualVerification() {
    Review result = service.create(new CreateReview("demand", "d1", "revision-1"));
    assertThat(result.findings()).containsExactlyElementsOf(snapshot.findings());
    assertThat(result.limitations()).anyMatch(s -> s.contains("制度"));
    assertThat(result.mode()).isEqualTo("RULE_ASSISTED");
    verify(mapper).insertRun(any(), eq("t1"), eq("demand"), eq("d1"), eq("revision-1"), any(), any(), eq("u1"), any());
  }
  @Test void historicalReadsRecheckCurrentSourceAuthorizationAndRejectTamperedPayload() throws Exception {
    Review result = service.create(new CreateReview("demand", "d1", null));
    var captor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(mapper).insertRun(any(), any(), any(), any(), any(), captor.capture(), any(), any(), any());
    String payload = captor.getValue();
    when(mapper.find("t1", result.runId())).thenReturn(new AiReviewMapper.RunRow(result.runId(), "t1", "demand", "d1", payload,
        AiSupport.hash(AiSupport.utf8(payload)), result.createdAt()));
    assertThat(service.detail(result.runId()).evidence()).isEqualTo(result.evidence());
    doThrow(new PermissionDeniedException("scope revoked")).when(adapter).authorize("d1");
    assertThatThrownBy(() -> service.detail(result.runId())).isInstanceOf(PermissionDeniedException.class);
    reset(adapter); when(adapter.subjectType()).thenReturn("demand");
    when(mapper.find("t1", result.runId())).thenReturn(new AiReviewMapper.RunRow(result.runId(), "t1", "demand", "d1", payload + " ", "bad", result.createdAt()));
    assertThatThrownBy(() -> service.detail(result.runId())).isInstanceOf(IllegalStateException.class);
  }
  @Test void forgedFindingFeedbackIsRejected() {
    Review result = service.create(new CreateReview("demand", "d1", null));
    var captor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(mapper).insertRun(any(), any(), any(), any(), any(), captor.capture(), any(), any(), any());
    String payload = captor.getValue();
    when(mapper.find("t1", result.runId())).thenReturn(new AiReviewMapper.RunRow(result.runId(), "t1", "demand", "d1", payload, AiSupport.hash(AiSupport.utf8(payload)), result.createdAt()));
    assertThatThrownBy(() -> service.feedback(result.runId(), new SubmitFeedback("forged", "adopted", null)))
        .isInstanceOf(IllegalArgumentException.class);
    verify(mapper, never()).saveFeedback(any(), any(), any(), any(), any(), any(), any());
  }
  @Test void gatewayWithoutCredentialsNeverMakesAnExternalCall() {
    var g = new OpenAiCompatibleGateway(json, true, "http://127.0.0.1:1/chat/completions", "", "m");
    assertThat(g.analyze(snapshot).mode()).isEqualTo("RULE_ASSISTED");
    assertThat(g.analyze(snapshot).fallbackReason()).contains("未配置");
  }
  @Test void txtAndDocxHaveLocatorsAndUnsupportedFilesAreNotAssessed() throws Exception {
    var extractor = new AttachmentTextExtractor();
    assertThat(extractor.extract("a.txt", "budget\nacceptance".getBytes(StandardCharsets.UTF_8)).segments())
        .extracting(AttachmentTextExtractor.Segment::locator).containsExactly("line:1", "line:2");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try (var doc = new XWPFDocument()) {
      doc.createParagraph().createRun().setText("body text");
      doc.createTable(1, 1).getRow(0).getCell(0).setText("table text"); doc.write(out);
    }
    var extracted = extractor.extract("a.docx", out.toByteArray());
    assertThat(extracted.segments()).extracting(AttachmentTextExtractor.Segment::text).contains("body text", "table text");
    assertThat(extractor.extract("a.pdf", new byte[0]).limitations()).anyMatch(s -> s.contains("未评估"));
    assertThat(extractor.extract("huge.txt", new byte[2 * 1024 * 1024 + 1]).segments()).isEmpty();
    assertThat(extractor.extract("bad.docx", new byte[] {1,2,3}).limitations()).isNotEmpty();
  }
}
