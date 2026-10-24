package com.procurement.contract.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.contract.infrastructure.ContractPaymentAllocationMapper;
import com.procurement.contract.infrastructure.ContractPaymentMilestoneMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractInstallmentService {
  public record Balance(String id, String name, BigDecimal amount, BigDecimal paid,
      BigDecimal remaining, boolean reached, boolean verified) {}

  private final ContractMapper contracts;
  private final ContractPaymentMilestoneMapper milestones;
  private final ContractPaymentAllocationMapper allocations;
  private final AuditLogApplicationService audit;

  public ContractInstallmentService(ContractMapper contracts, ContractPaymentMilestoneMapper milestones,
      ContractPaymentAllocationMapper allocations, AuditLogApplicationService audit) {
    this.contracts = contracts;
    this.milestones = milestones;
    this.allocations = allocations;
    this.audit = audit;
  }

  public List<Balance> balances(String tenant, String order) {
    var contract = contracts.findByTenantAndOrderId(tenant, order);
    if (contract == null) return List.of();
    return milestones.listByContract(tenant, contract.id()).stream().map(m -> {
      var paid = allocations.paid(tenant, m.id());
      boolean verified = m.amount() != null && paid.signum() >= 0 && paid.compareTo(m.amount()) <= 0
          && status(paid, m.amount()).equals(m.status());
      return new Balance(m.id(), m.name(), m.amount(), verified ? paid : null,
          verified ? m.amount().subtract(paid) : null, m.reached(), verified);
    }).toList();
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void allocate(String tenant, String order, String supplier, BigDecimal invoiceAmount,
      String entry, BigDecimal amount, String selected, BigDecimal previouslyPaid) {
    var contract = contracts.lockByOrder(tenant, order);
    if (contract == null) {
      if (selected != null) throw new IllegalArgumentException("订单没有关联合同里程碑");
      return;
    }
    if (!"已生效".equals(contract.status()) || "已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("关联合同未生效或已归档，不能登记付款");
    }
    if (!supplier.equals(contract.supplierId()) || invoiceAmount.compareTo(contract.amount()) != 0) {
      throw new IllegalStateException("发票供应商或金额与关联合同不一致");
    }
    var schedule = balances(tenant, order);
    if (schedule.isEmpty()) {
      if (selected != null) throw new IllegalArgumentException("付款里程碑不存在");
      return;
    }
    if (schedule.stream().anyMatch(m -> !m.verified())) {
      throw new IllegalStateException("合同存在缺少金额流水的历史付款或计划异常，请先核对");
    }
    if (schedule.stream().map(Balance::paid).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(previouslyPaid) != 0) {
      throw new IllegalStateException("合同已分配金额与发票付款流水不一致，请先核对付款计划");
    }
    if (schedule.stream().map(Balance::amount).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(invoiceAmount) != 0) {
      throw new IllegalStateException("合同付款计划合计与合同金额不一致");
    }
    var eligible = schedule.stream().filter(m -> m.reached() && (selected == null || selected.equals(m.id()))).toList();
    var available = eligible.stream().map(Balance::remaining).reduce(BigDecimal.ZERO, BigDecimal::add);
    if (amount.compareTo(available) > 0) {
      throw new IllegalStateException("本次付款超过已达成里程碑的剩余额度：" + available.toPlainString());
    }
    BigDecimal left = amount;
    for (var m : eligible) {
      BigDecimal share = left.min(m.remaining());
      if (share.signum() <= 0) continue;
      allocations.insert("allocation-" + UUID.randomUUID(), tenant, entry, m.id(), share);
      sync(tenant, contract.id(), m.id(), m.amount(), m.paid().add(share), entry);
      left = left.subtract(share);
    }
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void reverse(String tenant, String order, String original, String reversal) {
    var contract = contracts.lockByOrder(tenant, order);
    if (contract != null && "已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("关联合同已归档，不能冲销付款");
    }
    var originalAllocations = allocations.byEntry(tenant, original);
    if (originalAllocations.isEmpty()) return;
    if (contract == null) throw new IllegalStateException("关联合同不存在，不能冲销里程碑付款");
    var schedule = balances(tenant, order);
    for (var allocation : originalAllocations) {
      var m = schedule.stream().filter(item -> item.id().equals(allocation.milestoneId())).findFirst()
          .orElseThrow(() -> new IllegalStateException("原付款里程碑已变更，请先核对"));
      if (!m.verified() || m.paid().compareTo(allocation.amount()) < 0) {
        throw new IllegalStateException("里程碑累计金额异常，不能冲销");
      }
      allocations.insert("allocation-" + UUID.randomUUID(), tenant, reversal, m.id(), allocation.amount().negate());
      sync(tenant, contract.id(), m.id(), m.amount(), m.paid().subtract(allocation.amount()), reversal);
    }
  }

  private void sync(String tenant, String contract, String milestone, BigDecimal amount, BigDecimal paid, String entry) {
    String state = status(paid, amount);
    if (milestones.syncPayment(tenant, milestone, state) != 1) throw new IllegalStateException("付款计划已变更，请刷新重试");
    audit.recordTenantAction(tenant, "已付".equals(state) ? "contract.milestone_paid_from_invoice" : "contract.milestone_payment_updated",
        "contract", contract, "付款流水 " + entry + "；里程碑 " + milestone + "；累计 " + paid.toPlainString());
  }

  private static String status(BigDecimal paid, BigDecimal amount) {
    return paid.signum() == 0 ? "待付" : paid.compareTo(amount) == 0 ? "已付" : "部分已付";
  }
}
