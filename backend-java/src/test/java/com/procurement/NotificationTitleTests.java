package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.notification.domain.NotificationTitle;
import org.junit.jupiter.api.Test;

class NotificationTitleTests {
  @Test
  void definesBusinessNotificationTitles() {
    assertThat(NotificationTitle.PURCHASE_DEMAND_PENDING_APPROVAL).isEqualTo("采购需求待审批");
    assertThat(NotificationTitle.PURCHASE_DEMAND_APPROVED).isEqualTo("采购需求审批已通过");
    assertThat(NotificationTitle.PURCHASE_DEMAND_REJECTED).isEqualTo("采购需求审批已驳回");
    assertThat(NotificationTitle.SUPPLIER_ADMISSION_APPROVED).isEqualTo("供应商准入审批已通过");
    assertThat(NotificationTitle.SUPPLIER_ADMISSION_REJECTED).isEqualTo("供应商准入审批已驳回");
    assertThat(NotificationTitle.RFQ_AWARD_PENDING_APPROVAL).isEqualTo("定标结果待审批");
    assertThat(NotificationTitle.RFQ_AWARD_APPROVED).isEqualTo("定标审批已通过");
    assertThat(NotificationTitle.RFQ_AWARD_REJECTED).isEqualTo("定标审批已驳回");
    assertThat(NotificationTitle.PURCHASE_ORDER_CONFIRMED).isEqualTo("采购订单已确认");
    assertThat(NotificationTitle.PURCHASE_ORDER_SHIPPED).isEqualTo("采购订单已发货");
    assertThat(NotificationTitle.PURCHASE_ORDER_RECEIVED).isEqualTo("采购订单已收货");
    assertThat(NotificationTitle.INVOICE_CREATED).isEqualTo("供应商已登记发票");
    assertThat(NotificationTitle.INVOICE_PAID).isEqualTo("发票已付款");
    assertThat(NotificationTitle.INVOICE_PARTIAL_PAID).isEqualTo("发票部分付款");
  }
}
