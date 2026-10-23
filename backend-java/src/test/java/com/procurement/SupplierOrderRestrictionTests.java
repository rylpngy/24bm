package com.procurement;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.OrderLineItemApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.sourcing.application.OrderAwardQueryService;
import com.procurement.sourcing.application.RfqDemandLinkQueryService;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierOrderRestrictionTests {
  private final PurchaseOrderMapper orders = mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final PurchaseOrderApplicationService service = new PurchaseOrderApplicationService(
      TestOrderAccess.unrestricted(), mock(OrderAwardQueryService.class), orders, audit,
      mock(NotificationApplicationService.class), mock(TenantFeatureApplicationService.class),
      new PurchaseOrderStatusTransition(), mock(OrderLineItemApplicationService.class), mock(RfqDemandLinkQueryService.class));

  @AfterEach void clear() { TenantContext.clear(); }

  @Test void mallAndTenderRejectNonAdmittedSupplierBeforeWriting() {
    TenantContext.set("buyer-a", null, "user-a");
    for (String status : new String[] {null, "黑名单", "待准入", "已驳回", "准入审批中"}) {
      when(orders.lockSupplierAdmissionStatus("buyer-a", "supplier")).thenReturn(status);
      assertThrows(IllegalStateException.class, () -> service.createMallOrder("rfq", "supplier", BigDecimal.TEN, null, List.of()));
      assertThrows(IllegalStateException.class, () -> service.createTenderOrder("rfq", "supplier", BigDecimal.TEN, null, "设备"));
    }
    verify(orders, never()).insert(any(), any(), any(), any(), any(), any(), any());
    verifyNoInteractions(audit);
  }

  @Test void admittedSupplierCanCreateNewOrderWithinBuyerScope() {
    TenantContext.set("buyer-a", null, "user-a");
    when(orders.lockSupplierAdmissionStatus("buyer-a", "supplier")).thenReturn("已准入");
    service.createMallOrder("rfq", "supplier", BigDecimal.TEN, null, List.of());
    verify(orders).insert(anyString(), eq("buyer-a"), eq("rfq"), eq("supplier"), eq(BigDecimal.TEN), eq("待供应商确认"), isNull());
  }
}
