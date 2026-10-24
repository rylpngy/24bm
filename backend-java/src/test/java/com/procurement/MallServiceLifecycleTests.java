package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.mall.api.*;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.domain.MallAfterSales;
import com.procurement.mall.infrastructure.MallServiceMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.order.application.PurchaseOrderQueryService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MallServiceLifecycleTests {
  private final MallServiceMapper mapper = mock(MallServiceMapper.class);
  private final PurchaseOrderQueryService orders = mock(PurchaseOrderQueryService.class);
  private final OrderAccessService access = mock(OrderAccessService.class);
  private final MallServiceApplicationService service = new MallServiceApplicationService(mapper, orders,
      mock(AuditLogApplicationService.class), mock(NotificationApplicationService.class), access);

  @BeforeEach void setup() {
    TenantContext.set("t", "s", "u");
    when(mapper.lockOrder("t", "o")).thenReturn("o");
    when(orders.findLineForTenant("t", "o", "l")).thenReturn(
        new PurchaseOrderQueryService.OrderLineView("o", "l", "已收货", "s", "商品", new BigDecimal("5")));
    when(mapper.listByTenant("t")).thenReturn(List.of());
    when(mapper.listReviewsByTenant("t")).thenReturn(List.of());
    when(access.visibleOrders(anyString())).thenReturn(id -> true);
  }
  @AfterEach void cleanup() { TenantContext.clear(); }

  private MallAfterSales claim(String status) {
    return new MallAfterSales("a", "t", "o", "l", "s", "供应商", "退货",
        BigDecimal.ONE, "破损", status, "处理依据", null, null);
  }

  @Test void cumulativeCapIsCheckedAfterParentOrderLock() {
    when(mapper.claimedQuantity("t", "l")).thenReturn(new BigDecimal("4"));
    assertThatThrownBy(() -> service.applyAfterSales(new CreateAfterSalesRequest("o", "l", "退货", new BigDecimal("2"), "破损")))
        .hasMessageContaining("累计");
    var sequence = inOrder(mapper, orders);
    sequence.verify(mapper).lockOrder("t", "o");
    sequence.verify(orders).findLineForTenant("t", "o", "l");
    sequence.verify(mapper).claimedQuantity("t", "l");
    verify(mapper, never()).insertAfterSales(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), any(), anyString());
  }

  @Test void productIsDerivedWhenClientOmitsIt() {
    when(mapper.sourceProduct("t", "o", "l")).thenReturn("real-product");
    service.submitReview(new CreateMallReviewRequest("o", "l", null, 5, "很好"));
    verify(mapper).insertReview(anyString(), eq("t"), eq("o"), eq("l"), eq("real-product"), eq("s"), eq(5), eq("很好"));
  }

  @Test void arbitraryProductBindingIsRejected() {
    when(mapper.sourceProduct("t", "o", "l")).thenReturn("real-product");
    assertThatThrownBy(() -> service.submitReview(new CreateMallReviewRequest("o", "l", "forged", 5, "很好")))
        .hasMessageContaining("来源SKU");
    verify(mapper, never()).insertReview(anyString(), anyString(), anyString(), anyString(), any(), anyString(), anyInt(), anyString());
  }

  @Test void legacyReviewKeepsNullProductAndCannotInventOne() {
    service.submitReview(new CreateMallReviewRequest("o", "l", null, 4, "历史订单反馈"));
    verify(mapper).insertReview(anyString(), eq("t"), eq("o"), eq("l"), isNull(), eq("s"), eq(4), eq("历史订单反馈"));
    assertThatThrownBy(() -> service.submitReview(new CreateMallReviewRequest("o", "l", "forged", 5, "很好")))
        .hasMessageContaining("历史");
  }

  @Test void duplicateReviewIsRejected() {
    when(mapper.countReviewForLine("t", "l")).thenReturn(1);
    assertThatThrownBy(() -> service.submitReview(new CreateMallReviewRequest("o", "l", null, 4, "反馈")))
        .hasMessageContaining("已评价过");
  }

  @Test void supplierCompletionNeedsEvidenceAndDoesNotCloseCase() {
    when(mapper.findForSupplier("s", "a")).thenReturn(claim("处理中"));
    when(mapper.lockForSupplier("s", "a")).thenReturn(claim("处理中"));
    assertThatThrownBy(() -> service.handleAfterSales("a", new HandleAfterSalesRequest("已完成", "已办理")))
        .hasMessageContaining("凭据");
    when(mapper.handleBySupplier("a", "s", "待买方确认", "已办理", "处理中")).thenReturn(1);
    service.handleAfterSales("a", new HandleAfterSalesRequest("已完成", "已办理", "RETURN-001"));
    verify(mapper).insertEvent(anyString(), eq("a"), eq("u"), eq("supplier"), eq("处理中"), eq("待买方确认"), eq("已办理"), eq("RETURN-001"));
    verify(mapper, never()).handleBySupplier(eq("a"), eq("s"), eq("已完成"), any(), any());
  }

  @Test void supplierRereadsStatusAfterLockAndRejectsStaleAction() {
    when(mapper.findForSupplier("s", "a")).thenReturn(claim("处理中"));
    when(mapper.lockForSupplier("s", "a")).thenReturn(claim("待买方确认"));
    assertThatThrownBy(() -> service.handleAfterSales("a", new HandleAfterSalesRequest("已拒绝", "拒绝")))
        .isInstanceOf(IllegalStateException.class);
    verify(mapper, never()).handleBySupplier(anyString(), anyString(), anyString(), any(), any());
  }

  @Test void supplierCasFailureCannotRecordSuccessfulHandlingHistory() {
    when(mapper.findForSupplier("s", "a")).thenReturn(claim("待处理"));
    when(mapper.lockForSupplier("s", "a")).thenReturn(claim("待处理"));
    when(mapper.handleBySupplier("a", "s", "处理中", "受理", "待处理")).thenReturn(0);
    assertThatThrownBy(() -> service.handleAfterSales("a", new HandleAfterSalesRequest("处理中", "受理")))
        .hasMessageContaining("状态已变更");
    verify(mapper, never()).insertEvent(anyString(), anyString(), any(), anyString(), any(), anyString(), any(), any());
    var sequence = inOrder(mapper);
    sequence.verify(mapper).lockOrder("t", "o");
    sequence.verify(mapper).lockForSupplier("s", "a");
    sequence.verify(mapper).handleBySupplier("a", "s", "处理中", "受理", "待处理");
  }

  @Test void buyerConfirmationRecordsHistoryAndLeavesReturnFinanciallyPending() {
    when(mapper.findForBuyer("t", "a")).thenReturn(claim("待买方确认"));
    when(mapper.lockForBuyer("t", "a")).thenReturn(claim("待买方确认"));
    when(mapper.buyerTransition("t", "a", "待买方确认", "已完成")).thenReturn(1);
    service.buyerAction("a", "confirm", "已核实退货签收");
    verify(mapper).insertEvent(anyString(), eq("a"), eq("u"), eq("buyer"), eq("待买方确认"), eq("已完成"), eq("已核实退货签收"), isNull());
    assertThat(MallAfterSalesResponse.from(claim("已完成")).financialStatus()).contains("财务待核对");
  }

  @Test void withdrawalOnlyAllowedBeforeProcessing() {
    when(mapper.findForBuyer("t", "a")).thenReturn(claim("待处理"));
    when(mapper.lockForBuyer("t", "a")).thenReturn(claim("待处理"));
    when(mapper.buyerTransition("t", "a", "待处理", "已撤回")).thenReturn(1);
    service.buyerAction("a", "withdraw", "不再办理");
    verify(mapper).buyerTransition("t", "a", "待处理", "已撤回");
    when(mapper.findForBuyer("t", "a")).thenReturn(claim("处理中"));
    when(mapper.lockForBuyer("t", "a")).thenReturn(claim("处理中"));
    assertThatThrownBy(() -> service.buyerAction("a", "withdraw", "不再办理"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test void historyEnforcesTenantSupplierAndOrderScope() {
    assertThatThrownBy(() -> service.buyerHistory("foreign")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.supplierHistory("foreign")).isInstanceOf(IllegalArgumentException.class);
    when(mapper.findForBuyer("t", "a")).thenReturn(claim("待处理"));
    doThrow(new org.springframework.security.access.AccessDeniedException("restricted")).when(access).requireOrder("o", "buyer:order:read");
    assertThatThrownBy(() -> service.buyerHistory("a")).hasMessageContaining("restricted");
    verify(mapper, never()).history(any(), any(), anyString());
  }
}
