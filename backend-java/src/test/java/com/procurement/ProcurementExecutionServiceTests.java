package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.domain.Attachment;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import com.procurement.sourcing.domain.ProcurementExecutionArchive;
import com.procurement.sourcing.infrastructure.ProcurementExecutionMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;

class ProcurementExecutionServiceTests {
  final ProcurementExecutionMapper mapper=mock(ProcurementExecutionMapper.class);
  final OrderAccessService access=mock(OrderAccessService.class);
  final PermissionService permissions=mock(PermissionService.class);
  final AttachmentApplicationService attachments=mock(AttachmentApplicationService.class);
  final UnifiedWorkflowApplicationService workflow=mock(UnifiedWorkflowApplicationService.class);
  final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
  final ProcurementExecutionApplicationService service=new ProcurementExecutionApplicationService(mapper,access,permissions,attachments,workflow,json);

  @BeforeEach void setup() throws Exception {
    TenantContext.set("t",null,"u");
    when(mapper.snapshot("t","r")).thenReturn(new ProcurementExecutionPolicyTests().complete().toString());
    when(mapper.lockRfq("t","r")).thenReturn("r"); when(mapper.archives("t","r")).thenReturn(List.of());
    when(mapper.closeoutBlockers("t","r")).thenReturn(List.of());
    when(workflow.procurementExecutionHistory(anyList())).thenReturn(List.of());
    when(attachments.listCurrentTenantAttachmentEntities(anyString(),anyString())).thenReturn(List.of());
    when(attachments.procurementExecutionAttachmentMetadata(anyString(),anyString())).thenReturn(List.of());
  }
  @AfterEach void clear() { TenantContext.clear(); }
  Attachment attachment(String id) { return new Attachment(id,"t","contract","c","../same.txt","private-key","u","buyer_internal","active",OffsetDateTime.now()); }
  AttachmentApplicationService.ProcurementExecutionAttachmentMetadata metadata(String id) {
    return new AttachmentApplicationService.ProcurementExecutionAttachmentMetadata(id,"t","contract","c","../same.txt",null,null);
  }

  @Test void readPermissionsAndEveryOrderScopeAreMandatory() {
    doThrow(new PermissionDeniedException("missing invoice read")).when(permissions).require("buyer:invoice:read");
    assertThatThrownBy(() -> service.get("r")).isInstanceOf(PermissionDeniedException.class);
    verify(mapper,never()).snapshot(anyString(),anyString());
    reset(permissions);
    doThrow(new PermissionDeniedException("scope")).when(access).requireOrder("o","buyer:order:read");
    assertThatThrownBy(() -> service.get("r")).isInstanceOf(PermissionDeniedException.class);
    verify(access).requireRfq("r","buyer:rfq:read");
  }

  @Test void missingOrUnreadableAttachmentFailsWholeArchiveAndWritesNothing() {
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(List.of(metadata("a")));
    when(attachments.loadCurrentTenantObject("a")).thenThrow(new IllegalStateException("missing object"));
    assertThatThrownBy(() -> service.archive("r","Archive")).isInstanceOf(IllegalStateException.class);
    verify(mapper,never()).insert(any());
  }

  @Test void attachmentCountAndTotalByteLimitCannotTruncateManifest() {
    var many=new ArrayList<AttachmentApplicationService.ProcurementExecutionAttachmentMetadata>(); for(int i=0;i<101;i++) many.add(metadata("a"+i));
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(many);
    when(attachments.loadCurrentTenantObject(anyString())).thenReturn(new AttachmentApplicationService.DownloadedObject("same.txt",new byte[0],"text/plain"));
    assertThatThrownBy(() -> service.archive("r","Archive")).hasMessageContaining("100");
    verify(mapper,never()).insert(any());
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(List.of(metadata("a")));
    when(attachments.loadCurrentTenantObject("a")).thenReturn(new AttachmentApplicationService.DownloadedObject("same.txt",new byte[(int)ProcurementExecutionApplicationService.MAX_ATTACHMENT_BYTES+1],"text/plain"));
    assertThatThrownBy(() -> service.archive("r","Archive")).hasMessageContaining("100MB");
    verify(mapper,never()).insert(any());
  }

  @Test void stableHashExcludesRemarkAndCreationTimeAndDownloadUsesOnlySavedAttachments() {
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(List.of(metadata("a")));
    when(attachments.loadCurrentTenantObject("a")).thenReturn(new AttachmentApplicationService.DownloadedObject("same.txt",new byte[]{1,2},"text/plain"));
    var first=service.archive("r","First");
    var saved=ArgumentCaptor.forClass(ProcurementExecutionArchive.class); verify(mapper).insert(saved.capture());
    when(mapper.archives("t","r")).thenReturn(List.of(saved.getValue()));
    assertThat(service.archive("r","Different remark").id()).isEqualTo(first.id());
    assertThat(service.get("r").archives()).allSatisfy(a -> assertThat(a.stale()).isFalse());
    when(mapper.archive("t","r",first.id())).thenReturn(saved.getValue());
    when(attachments.listCurrentTenantAttachmentEntities("contract","c")).thenReturn(List.of(attachment("a"),attachment("new")));
    assertThat(service.download("r",first.id())).isEqualTo(saved.getValue().zipData());
    verify(attachments,never()).loadCurrentTenantObject("new");
    when(attachments.loadCurrentTenantObject("a")).thenReturn(new AttachmentApplicationService.DownloadedObject("same.txt",new byte[]{3},"text/plain"));
    assertThatThrownBy(() -> service.download("r",first.id())).hasMessageContaining("SHA");
    when(attachments.loadCurrentTenantObject("a")).thenThrow(new PermissionDeniedException("revoked"));
    assertThatThrownBy(() -> service.download("r",first.id())).isInstanceOf(PermissionDeniedException.class);
  }

  @Test void progressReadsOnlyMetadataAndShowsKnownSizeBlockerWithoutLoadingObjects() {
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(List.of(
        new AttachmentApplicationService.ProcurementExecutionAttachmentMetadata("a","t","contract","c","large.bin",
            ProcurementExecutionApplicationService.MAX_ATTACHMENT_BYTES+1,"a".repeat(64))));
    var progress=service.get("r");
    assertThat(progress.canArchive()).isFalse();
    assertThat(progress.blockers()).anyMatch(s -> s.contains("100MB"));
    verify(attachments,never()).loadCurrentTenantObject(anyString());
  }

  @Test void progressDoesNotPretendLegacyMetadataIsAContentVerification() {
    when(attachments.procurementExecutionAttachmentMetadata("contract","c")).thenReturn(List.of(metadata("a")));
    assertThat(service.get("r").canArchive()).isTrue();
    verify(attachments,never()).loadCurrentTenantObject(anyString());
    when(attachments.loadCurrentTenantObject("a")).thenThrow(new IllegalStateException("Object missing"));
    assertThatThrownBy(() -> service.archive("r","Verify originals")).hasMessageContaining("missing");
  }

  @Test void remarkMustBeNonblankAndAtMostOneThousandCharacters() {
    for (String remark : new String[]{null,"","  ","x".repeat(1001)})
      assertThatThrownBy(() -> service.archive("r",remark)).isInstanceOf(IllegalArgumentException.class);
    verify(mapper,never()).lockRfq(anyString(),anyString());
  }
}
