package com.procurement;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.procurement.contract.application.*;
import com.procurement.contract.infrastructure.ContractReviewMapper;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ContractReviewContractScopeTests {
  final ContractReviewMapper mapper = mock(ContractReviewMapper.class);
  final ContractAccessService access = mock(ContractAccessService.class);
  final DataScopeService scopes = mock(DataScopeService.class);
  final ContractReviewService service = new ContractReviewService(mapper, mock(ContractReviewCodec.class),
      mock(PermissionService.class), scopes, mock(com.procurement.common.storage.ObjectStorageService.class),
      mock(com.procurement.attachment.application.AttachmentTextExtractor.class), mock(ContractReviewRulesService.class),
      mock(ContractReviewEngine.class), mock(ContractReviewModelGateway.class),
      mock(com.procurement.audit.application.AuditLogApplicationService.class),
      mock(org.springframework.transaction.support.TransactionTemplate.class), access);
  @AfterEach void clear() { TenantContext.clear(); }
  @Test void contractListUsesScopedQueryInsteadOfFilteringAnUnrelatedPage() {
    TenantContext.set("t", null, "u");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    when(mapper.contractDocuments(eq("t"),eq("c"),eq(false),isNull(),anyList(),eq(10),eq(10))).thenReturn(List.of());
    service.documents(2,10,"c");
    verify(access).requireContract("c",false);
    verify(mapper).contractDocumentCount(eq("t"),eq("c"),eq(false),isNull(),anyList());
    verify(mapper,never()).documents(anyString(),anyBoolean(),any(),anyList(),anyInt(),anyInt());
  }
  @Test void cannotUploadAgainstAnInaccessibleContract() {
    TenantContext.set("t", null, "u");
    doThrow(new PermissionDeniedException("denied")).when(access).requireContract("foreign",true);
    assertThrows(PermissionDeniedException.class,()->service.upload("sample.txt",new byte[]{1},"foreign"));
    verifyNoInteractions(mapper);
  }
}
