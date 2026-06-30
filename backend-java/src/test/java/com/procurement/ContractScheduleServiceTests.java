package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractScheduleService;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.contract.infrastructure.ContractPaymentMilestoneMapper;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;

// 合同付款计划:默认里程碑(30/40/30)金额合计=合同额,末项吸收差额;付款状态守卫。
class ContractScheduleServiceTests {

  private final ContractMapper contractMapper = mock(ContractMapper.class);
  private final ContractPaymentMilestoneMapper milestoneMapper =
      mock(ContractPaymentMilestoneMapper.class);
  private final OrderLineItemMapper orderLineItemMapper = mock(OrderLineItemMapper.class);
  private final ContractScheduleService service =
      new ContractScheduleService(contractMapper, milestoneMapper, orderLineItemMapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private ContractLedger contract(BigDecimal amount) {
    return new ContractLedger("ctr-1", "tenant-1", "C-001", "演示合同", "po-1", "sup-1", amount,
        "已生效", "未归档", "履约中", null, null, null, null, null, null, null);
  }

  @Test
  void generatesThreeMilestonesSummingToContractAmount() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    when(milestoneMapper.countByContract("tenant-1", "ctr-1")).thenReturn(0);

    service.generateDefaultSchedule("ctr-1");

    // 预付 30% = 26400,验收 40% = 35200,质保 = 88000-26400-35200 = 26400。
    verify(milestoneMapper).insert(ArgumentMatchers.startsWith("milestone-"),
        ArgumentMatchers.eq("tenant-1"), ArgumentMatchers.eq("ctr-1"), ArgumentMatchers.eq("预付款"),
        ArgumentMatchers.eq(30), ArgumentMatchers.argThat(v -> v.compareTo(new BigDecimal("26400")) == 0),
        ArgumentMatchers.eq("待付"), ArgumentMatchers.eq(0));
    verify(milestoneMapper).insert(ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),
        ArgumentMatchers.anyString(), ArgumentMatchers.eq("验收款"), ArgumentMatchers.eq(40),
        ArgumentMatchers.argThat(v -> v.compareTo(new BigDecimal("35200")) == 0),
        ArgumentMatchers.eq("待付"), ArgumentMatchers.eq(1));
    verify(milestoneMapper).insert(ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),
        ArgumentMatchers.anyString(), ArgumentMatchers.eq("质保金"), ArgumentMatchers.eq(30),
        ArgumentMatchers.argThat(v -> v.compareTo(new BigDecimal("26400")) == 0),
        ArgumentMatchers.eq("待付"), ArgumentMatchers.eq(2));
  }

  @Test
  void generateIsIdempotentWhenMilestonesExist() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    when(milestoneMapper.countByContract("tenant-1", "ctr-1")).thenReturn(3);

    service.generateDefaultSchedule("ctr-1");

    verify(milestoneMapper, org.mockito.Mockito.never()).insert(
        ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),
        ArgumentMatchers.anyString(), ArgumentMatchers.anyInt(), ArgumentMatchers.any(),
        ArgumentMatchers.anyString(), ArgumentMatchers.anyInt());
  }

  @Test
  void payRejectsNonPendingMilestone() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    when(milestoneMapper.markPaid("tenant-1", "m-1", "待付", "已付")).thenReturn(0);

    assertThatThrownBy(() -> service.payMilestone("ctr-1", "m-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("待付");
  }

  @Test
  void reachRequiresPriorMilestonesReachedInOrder() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    // m-2(sortNo 1)未达成,前序 m-1(sortNo 0)也未达成 → 拦截。
    when(milestoneMapper.listByContract("tenant-1", "ctr-1")).thenReturn(java.util.List.of(
        milestone("m-1", "预付款", 0, false),
        milestone("m-2", "验收款", 1, false)));

    assertThatThrownBy(() -> service.reachMilestone("ctr-1", "m-2"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("须先按序达成前序里程碑");
    verify(milestoneMapper, org.mockito.Mockito.never()).markReached("tenant-1", "m-2");
  }

  @Test
  void reachMarksWhenPriorMilestonesAlreadyReached() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    when(milestoneMapper.listByContract("tenant-1", "ctr-1")).thenReturn(java.util.List.of(
        milestone("m-1", "预付款", 0, true),
        milestone("m-2", "验收款", 1, false)));
    when(milestoneMapper.markReached("tenant-1", "m-2")).thenReturn(1);

    service.reachMilestone("ctr-1", "m-2");

    verify(milestoneMapper).markReached("tenant-1", "m-2");
  }

  private com.procurement.contract.domain.ContractPaymentMilestone milestone(
      String id, String name, int sortNo, boolean reached) {
    return new com.procurement.contract.domain.ContractPaymentMilestone(
        id, "tenant-1", "ctr-1", name, 30, new BigDecimal("26400"), "待付", sortNo, null, reached, null);
  }

  @Test
  void lineItemsDeriveFromRelatedOrder() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(contractMapper.findByTenantAndId("tenant-1", "ctr-1"))
        .thenReturn(contract(new BigDecimal("88000.00")));
    when(orderLineItemMapper.listByOrder("tenant-1", "po-1"))
        .thenReturn(java.util.List.of(new com.procurement.order.domain.OrderLineItem(
            "oli-1", "tenant-1", "po-1", "网络机柜", "台",
            new BigDecimal("4"), new BigDecimal("12000"), new BigDecimal("48000"), 0)));

    var lines = service.lineItems("ctr-1");

    assertThat(lines).hasSize(1);
    assertThat(lines.get(0).description()).isEqualTo("网络机柜");
    assertThat(lines.get(0).lineAmount()).isEqualByComparingTo("48000");
  }
}
