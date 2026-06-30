package com.procurement.contract.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.api.ContractLineItemResponse;
import com.procurement.contract.api.ContractPaymentMilestoneResponse;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.domain.ContractPaymentMilestone;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.contract.infrastructure.ContractPaymentMilestoneMapper;
import com.procurement.order.domain.OrderLineItem;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 合同行项化 + 付款计划:行项派生自关联订单行项;付款计划按里程碑拆分合同金额、逐项登记付款。
@Service
public class ContractScheduleService {

  // 默认付款里程碑(名称, 百分比)。
  private static final List<String[]> DEFAULT_MILESTONES =
      List.of(new String[] {"预付款", "30"}, new String[] {"验收款", "40"}, new String[] {"质保金", "30"});

  private final ContractMapper contractMapper;
  private final ContractPaymentMilestoneMapper milestoneMapper;
  private final OrderLineItemMapper orderLineItemMapper;

  public ContractScheduleService(
      ContractMapper contractMapper,
      ContractPaymentMilestoneMapper milestoneMapper,
      OrderLineItemMapper orderLineItemMapper) {
    this.contractMapper = contractMapper;
    this.milestoneMapper = milestoneMapper;
    this.orderLineItemMapper = orderLineItemMapper;
  }

  private ContractLedger requireContract(String tenantId, String contractId) {
    ContractLedger contract = contractMapper.findByTenantAndId(tenantId, contractId);
    if (contract == null) {
      throw new IllegalArgumentException("Contract not found in tenant scope: " + contractId);
    }
    return contract;
  }

  // 合同行项 = 关联订单的订单行项(合同与订单 1:1)。
  public List<ContractLineItemResponse> lineItems(String contractId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    List<OrderLineItem> lines =
        orderLineItemMapper.listByOrder(tenantId, contract.relatedOrderId());
    if (lines == null) {
      return List.of();
    }
    return lines.stream()
        .map(
            l ->
                new ContractLineItemResponse(
                    l.id(), l.description(), l.unit(), l.quantity(), l.unitPrice(), l.lineAmount()))
        .toList();
  }

  public List<ContractPaymentMilestoneResponse> milestones(String contractId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireContract(tenantId, contractId);
    return milestoneMapper.listByContract(tenantId, contractId).stream()
        .map(this::toMilestoneResponse)
        .toList();
  }

  // 生成默认付款计划(预付30/验收40/质保30);已有则原样返回(幂等)。末项吸收四舍五入差额。
  @Transactional
  public List<ContractPaymentMilestoneResponse> generateDefaultSchedule(String contractId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    ContractLedger contract = requireContract(tenantId, contractId);
    if (milestoneMapper.countByContract(tenantId, contractId) == 0) {
      BigDecimal total = contract.amount() == null ? BigDecimal.ZERO : contract.amount();
      BigDecimal allocated = BigDecimal.ZERO;
      for (int i = 0; i < DEFAULT_MILESTONES.size(); i++) {
        String[] m = DEFAULT_MILESTONES.get(i);
        int percent = Integer.parseInt(m[1]);
        BigDecimal amount;
        if (i == DEFAULT_MILESTONES.size() - 1) {
          amount = total.subtract(allocated); // 末项吸收差额
        } else {
          amount =
              total.multiply(BigDecimal.valueOf(percent)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
          allocated = allocated.add(amount);
        }
        milestoneMapper.insert(
            "milestone-" + UUID.randomUUID(), tenantId, contractId, m[0], percent, amount, "待付", i);
      }
    }
    return milestones(contractId);
  }

  // 登记里程碑付款:须已达成的「待付」里程碑 → 已付。
  @Transactional
  public List<ContractPaymentMilestoneResponse> payMilestone(String contractId, String milestoneId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireContract(tenantId, contractId);
    int updated = milestoneMapper.markPaid(tenantId, milestoneId, "待付", "已付");
    if (updated == 0) {
      throw new IllegalStateException("只有「已达成」的待付里程碑可以登记付款:" + milestoneId);
    }
    return milestones(contractId);
  }

  // 确认里程碑达成:须按序达成(前序里程碑均已达成),达成后方可付款。
  @Transactional
  public List<ContractPaymentMilestoneResponse> reachMilestone(String contractId, String milestoneId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireContract(tenantId, contractId);
    List<ContractPaymentMilestone> all = milestoneMapper.listByContract(tenantId, contractId);
    ContractPaymentMilestone target = all.stream()
        .filter(m -> m.id().equals(milestoneId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("里程碑不存在:" + milestoneId));
    if (target.reached()) {
      throw new IllegalStateException("里程碑已达成:" + milestoneId);
    }
    boolean priorAllReached = all.stream()
        .filter(m -> m.sortNo() < target.sortNo())
        .allMatch(ContractPaymentMilestone::reached);
    if (!priorAllReached) {
      throw new IllegalStateException("须先按序达成前序里程碑:" + target.name());
    }
    int updated = milestoneMapper.markReached(tenantId, milestoneId);
    if (updated == 0) {
      throw new IllegalStateException("里程碑达成状态已变更:" + milestoneId);
    }
    return milestones(contractId);
  }

  private ContractPaymentMilestoneResponse toMilestoneResponse(ContractPaymentMilestone m) {
    return new ContractPaymentMilestoneResponse(
        m.id(), m.name(), m.percent(), m.amount(), m.status(), m.paidAt(), m.reached(), m.reachedAt());
  }
}
