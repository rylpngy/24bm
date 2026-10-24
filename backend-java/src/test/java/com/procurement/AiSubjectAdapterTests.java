package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.attachment.application.*;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.attachment.domain.Attachment;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import com.procurement.demand.application.*;
import com.procurement.demand.api.*;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import com.procurement.order.application.OrderAccessService;
import com.procurement.sourcing.application.ProcurementRiskAiSubjectAdapter;
import com.procurement.supplier.application.*;
import com.procurement.supplier.api.SupplierFulfillmentMetricsResponse;
import com.procurement.supplier.domain.*;
import com.procurement.supplier.infrastructure.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.*;

class AiSubjectAdapterTests {
  @BeforeEach void context() { TenantContext.set("t1",null,"u1"); }
  @AfterEach void cleanup() { TenantContext.clear(); }
  @Test void demandRulesUseActualFieldsAndDoNotInventLinePrices() {
    var demands=mock(PurchaseDemandApplicationService.class);
    when(demands.getCurrentTenantDemand("d1")).thenReturn(new PurchaseDemandResponse("d1","t1","设备需求","dept","u1",
        BigDecimal.ZERO,"草稿",OffsetDateTime.now(),OffsetDateTime.now(),
        List.of(new PurchaseDemandLineItemResponse("line1","m1",BigDecimal.ZERO)),null,"normal","",null,null,"manual"));
    var snapshot=new DemandAiSubjectAdapter(demands).capture("d1");
    assertThat(snapshot.findings()).extracting(Finding::id).contains("purpose-missing","budget-invalid","quantity-1");
    assertThat(snapshot.evidence()).extracting(Evidence::sourceId).contains("d1","line1");
    assertThat(snapshot.limitations()).anyMatch(s -> s.contains("未提供明细单价"));
    verify(demands).getCurrentTenantDemand("d1"); verifyNoMoreInteractions(demands);
  }
  @Test void attachmentTextIsBoundToUploadHashAndHistoricOwnerIsReauthorized() {
    var mapper=mock(AttachmentMapper.class); var files=mock(AttachmentApplicationService.class); var access=mock(AttachmentAccessService.class);
    byte[] bytes="TODO 待补充验收标准".getBytes(java.nio.charset.StandardCharsets.UTF_8); String hash=AiSupport.hash(bytes);
    when(mapper.findByTenantAndId("t1","a1")).thenReturn(new Attachment("a1","t1","demand","d1","需求.txt","t1/demand/d1/a1","u1","buyer_internal","active",OffsetDateTime.now()));
    when(mapper.fingerprint("t1","a1")).thenReturn(new AttachmentMapper.Fingerprint((long)bytes.length,hash));
    when(files.loadCurrentTenantObject("a1")).thenReturn(new AttachmentApplicationService.DownloadedObject("需求.txt",bytes,"text/plain"));
    var adapter=new AttachmentAiSubjectAdapter(files,access,mapper,new AttachmentTextExtractor()); var snapshot=adapter.capture("a1");
    assertThat(snapshot.findings()).extracting(Finding::id).contains("placeholder-1");
    assertThat(snapshot.evidence()).filteredOn(e -> e.kind().equals("ATTACHMENT")).allMatch(e -> hash.equals(e.sourceHash()));
    adapter.authorizeSnapshot("a1",snapshot); verify(access,atLeastOnce()).requireAccess("demand","d1",false);
    doThrow(new PermissionDeniedException("revoked")).when(access).requireAccess("demand","d1",false);
    assertThatThrownBy(() -> adapter.authorizeSnapshot("a1",snapshot)).isInstanceOf(PermissionDeniedException.class);
  }
  @Test void supplierUsesRelationIdAndRechecksEveryHistoricalSampleOrder() {
    var relations=mock(BuyerSupplierRelationMapper.class); var qualifications=mock(SupplierQualificationMapper.class);
    var metrics=mock(SupplierFulfillmentMetricsService.class); var permissions=mock(PermissionService.class);
    var scopes=mock(DataScopeService.class); var rows=mock(SupplierFulfillmentMetricsMapper.class); var orders=mock(OrderAccessService.class);
    when(relations.findByTenantAndId("t1","rel1")).thenReturn(new BuyerSupplierRelation("rel1","t1","public-supplier","供应商","已准入","B","[]",null,null,null,null,null,null,null,null,null,null,null));
    when(qualifications.listActiveBySupplier("public-supplier")).thenReturn(List.of(new SupplierQualification("q1","public-supplier","资质","cert",LocalDate.of(2000,1,1),"q.txt","private","active",OffsetDateTime.now())));
    when(metrics.metricsForSupplier("public-supplier")).thenReturn(new SupplierFulfillmentMetricsResponse("public-supplier",1,0,null,1,1,100,100,null,null,null,null,0));
    when(rows.aiReceiptOrderIds(eq("t1"),eq("public-supplier"),any())).thenReturn(List.of("o1"));
    var adapter=new SupplierAiSubjectAdapter(relations,qualifications,metrics,permissions,scopes,rows,orders);
    var snapshot=adapter.capture("rel1");
    assertThat(snapshot.findings()).extracting(Finding::id).contains("expired-1");
    adapter.authorizeSnapshot("rel1",snapshot); verify(orders).requireOrder("o1","buyer:supplier:read");
    assertThatThrownBy(() -> adapter.authorize("public-supplier")).isInstanceOf(PermissionDeniedException.class);
  }
  @Test void procurementRiskUsesExistingCloseoutChecksAndImmutableAccessTargets() throws Exception {
    var fixture=new ProcurementExecutionServiceTests(); fixture.setup();
    try {
      var adapter=new ProcurementRiskAiSubjectAdapter(fixture.service);
      var snapshot=adapter.capture("r");
      assertThat(snapshot.evidence()).anyMatch(e -> e.id().equals("execution-summary"));
      assertThat(snapshot.accessTargets()).anyMatch(t -> t.subjectType().equals("order") && t.subjectId().equals("o"));
      adapter.authorizeSnapshot("r",snapshot); verify(fixture.access,atLeastOnce()).requireOrder("o","buyer:order:read");
      assertThat(snapshot.limitations()).anyMatch(s -> s.contains("不作合法性"));
    } finally { fixture.clear(); }
  }
}
