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

// 合同行项派生自订单，里程碑确认付款条件，已付状态由财务登记同步。
@Service
public class ContractScheduleService {

  // 默认付款里程碑(名称, 百分比)。
  private static final List<String[]> DEFAULT_MILESTONES =
      List.of(new String[] {"预付款", "30"}, new String[] {"验收款", "40"}, new String[] {"质保金", "30"});

  private final ContractMapper contractMapper;
  private final ContractPaymentMilestoneMapper milestoneMapper;
  private final OrderLineItemMapper orderLineItemMapper;
  private final com.procurement.identity.application.PermissionService permissions;
  private final com.procurement.identity.application.DataScopeService scopes;
  private final com.procurement.audit.application.AuditLogApplicationService audit;

  public ContractScheduleService(
      ContractMapper contractMapper,
      ContractPaymentMilestoneMapper milestoneMapper,
      OrderLineItemMapper orderLineItemMapper,
      com.procurement.identity.application.PermissionService permissions,
      com.procurement.identity.application.DataScopeService scopes,
      com.procurement.audit.application.AuditLogApplicationService audit) {
    this.contractMapper = contractMapper;
    this.milestoneMapper = milestoneMapper;
    this.orderLineItemMapper = orderLineItemMapper;
    this.permissions = permissions;
    this.scopes = scopes;
    this.audit = audit;
  }

  private void requireAccess(String tenantId, String contractId, boolean write) {
    permissions.require(write ? "buyer:contract:manage" : "buyer:contract:read");
    var scope = scopes.currentUserDataScope();
    if (scope.blocksAll() || !contractMapper.canAccessAttachment(tenantId, contractId,
        scope.restricted() && scope.requesterId() == null ? scope.departmentIds() : null,
        scope.restricted() ? scope.requesterId() : null)) {
      throw new com.procurement.common.tenant.PermissionDeniedException("合同不存在或无权访问");
    }
    if (write) contractMapper.lockById(tenantId, contractId);
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
    requireAccess(tenantId, contractId, false);
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
    requireAccess(tenantId, contractId, false);
    requireContract(tenantId, contractId);
    return milestoneMapper.listByContract(tenantId, contractId).stream()
        .map(this::toMilestoneResponse)
        .toList();
  }

  // 生成默认付款计划(预付30/验收40/质保30);已有则原样返回(幂等)。末项吸收四舍五入差额。
  @Transactional
  public List<ContractPaymentMilestoneResponse> generateDefaultSchedule(String contractId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireAccess(tenantId, contractId, true);
    ContractLedger contract = requireContract(tenantId, contractId);
    if ("已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("已归档合同不能修改付款计划");
    }
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

  // Compatibility endpoint: payment evidence is written only by the finance transaction.
  @Transactional
  public List<ContractPaymentMilestoneResponse> payMilestone(String contractId, String milestoneId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireAccess(tenantId, contractId, true);
    requireContract(tenantId, contractId);
    List<ContractPaymentMilestone> all = milestoneMapper.listByContract(tenantId, contractId);
    all.stream()
        .filter(m -> m.id().equals(milestoneId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("里程碑不存在:" + milestoneId));
    throw new IllegalStateException("合同里程碑不能单独登记为已付，请在发票付款台账完成审批及付款登记");
  }

  // 确认里程碑达成:须按序达成(前序里程碑均已达成),达成后方可付款。
  @Transactional
  public List<ContractPaymentMilestoneResponse> reachMilestone(String contractId, String milestoneId) {
    String tenantId = TenantAccessGuard.requireTenantId("contract APIs");
    requireAccess(tenantId, contractId, true);
    var contract = requireContract(tenantId, contractId);
    if (!"已生效".equals(contract.status()) || "已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("只有未归档的生效合同可以确认付款条件");
    }
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
    audit.recordTenantAction(tenantId, "contract.milestone_reached", "contract",
        contractId, "确认付款条件达成：" + target.name());
    return milestones(contractId);
  }

  private ContractPaymentMilestoneResponse toMilestoneResponse(ContractPaymentMilestone m) {
    BigDecimal paid = milestoneMapper.allocatedAmount(m.tenantId(), m.id());
    String expected = paid == null || paid.signum() == 0 ? "待付" : paid.compareTo(m.amount()) == 0 ? "已付" : "部分已付";
    boolean verified = paid != null && paid.signum() >= 0 && paid.compareTo(m.amount()) <= 0 && expected.equals(m.status());
    return new ContractPaymentMilestoneResponse(
        m.id(), m.name(), m.percent(), m.amount(), m.status(), m.paidAt(), m.reached(), m.reachedAt(),
        verified ? paid : null, verified ? m.amount().subtract(paid) : null, verified);
  }
}
