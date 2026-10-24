package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.sourcing.api.RfqController;
import com.procurement.sourcing.application.*;
import com.procurement.sourcing.infrastructure.PublicProcurementAnnouncementMapper;
import com.procurement.sourcing.infrastructure.RfqAnnouncementMapper;
import com.procurement.tender.application.TenderReadAccess;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.infrastructure.TenderMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TenderAnnouncementScopeRoutingTests {
  private final TenderMapper tenders = mock(TenderMapper.class);
  private final PermissionService permissions = mock(PermissionService.class);
  private final DataScopeService scopes = mock(DataScopeService.class);
  private final OrderAccessService orders = mock(OrderAccessService.class);
  private final RfqAnnouncementMapper announcements = mock(RfqAnnouncementMapper.class);
  private final RfqApplicationService rfqs = mock(RfqApplicationService.class);
  private final RfqController controller = new RfqController(rfqs,
      mock(RfqClarificationApplicationService.class), mock(RfqResultApplicationService.class),
      mock(RfqSupplierPerformanceApplicationService.class), mock(AwardNoticeApplicationService.class),
      mock(OpportunityApplicationService.class), new RfqAnnouncementService(announcements,
          mock(PublicProcurementAnnouncementMapper.class), new TenderReadAccess(tenders, permissions, scopes), orders));

  @BeforeEach void setup() { TenantContext.set("tenant-1", null, "owner"); }
  @AfterEach void clear() { TenantContext.clear(); }

  private void tender(String id, String owner) {
    var now = OffsetDateTime.parse("2026-10-24T00:00:00Z");
    Tender tender = new Tender(id, "tenant-1", "NO-" + id, "Scope fixture", "公开招标", BigDecimal.TEN,
        "编制中", "document", "综合评分法", null,
        null, null, null, owner, null, now, now, null,
        null, null, null, null, null, null, null, false);
    when(tenders.findByTenantAndId("tenant-1", id)).thenReturn(tender);
  }

  @Test void ownTenderUsesTenderReadGuardRatherThanRequiringAnRfqRecord() {
    tender("t-own", "owner");
    doThrow(new PermissionDeniedException("Not an RFQ")).when(rfqs).requireReadAccess("t-own");
    assertThat(controller.listAnnouncements("t-own").data()).isEmpty();
    verify(permissions).require("buyer:tender:read");
    verify(scopes).requireCreatorAccess("owner");
    verify(announcements).listByTenantAndRfq("tenant-1", "t-own");
    verifyNoInteractions(orders);
    verify(rfqs, never()).requireReadAccess("t-own");
  }

  @Test void anotherCreatorsTenderRemainsDeniedBeforeAnyAnnouncementRead() {
    tender("t-peer", "peer");
    doThrow(new PermissionDeniedException("Creator scope denied")).when(scopes).requireCreatorAccess("peer");
    assertThatThrownBy(() -> controller.listAnnouncements("t-peer")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(announcements, orders);
  }

  @Test void tenderPermissionIsStillRequiredEvenForItsCreator() {
    tender("t-own", "owner");
    doThrow(new PermissionDeniedException("Tender read denied")).when(permissions).require("buyer:tender:read");
    assertThatThrownBy(() -> controller.listAnnouncements("t-own")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(announcements);
  }

  @Test void rfqAnnouncementAccessStillChecksRfqPermissionAndScope() {
    doThrow(new PermissionDeniedException("RFQ scope denied")).when(orders).requireRfq("r-hidden", "buyer:rfq:read");
    assertThatThrownBy(() -> controller.listAnnouncements("r-hidden")).isInstanceOf(PermissionDeniedException.class);
    verify(orders).requireRfq("r-hidden", "buyer:rfq:read");
    verifyNoInteractions(announcements);
  }
}
