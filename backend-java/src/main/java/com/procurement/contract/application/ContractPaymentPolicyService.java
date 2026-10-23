package com.procurement.contract.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.contract.infrastructure.ContractPaymentMilestoneMapper;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractPaymentPolicyService {
  private final ContractMapper contracts;
  private final ContractPaymentMilestoneMapper milestones;
  private final AuditLogApplicationService audit;

  public ContractPaymentPolicyService(ContractMapper contracts,
      ContractPaymentMilestoneMapper milestones, AuditLogApplicationService audit) {
    this.contracts = contracts;
    this.milestones = milestones;
    this.audit = audit;
  }

  // Called inside the finance transaction, after finance has checked record-level access.
  @Transactional(propagation = Propagation.MANDATORY)
  public void requirePaymentReady(String tenantId, String orderId, String supplierId,
      BigDecimal invoiceAmount, boolean fullPayment) {
    var contract = contracts.lockByOrder(tenantId, orderId);
    if (contract == null) return;
    if (!"已生效".equals(contract.status()) || "已归档".equals(contract.archiveStatus())) {
      throw new IllegalStateException("关联合同未生效或已归档，不能登记付款");
    }
    if (!supplierId.equals(contract.supplierId()) || contract.amount() == null
        || invoiceAmount.compareTo(contract.amount()) != 0) {
      throw new IllegalStateException("发票供应商或金额与关联合同不一致，请先核对合同");
    }
    var schedule = milestones.listByContract(tenantId, contract.id());
    if (schedule.isEmpty()) return;
    if (!fullPayment) {
      throw new IllegalStateException("当前部分付款仅记录状态，不能核验合同分期金额；暂不支持带里程碑计划的部分付款登记");
    }
    BigDecimal total = BigDecimal.ZERO;
    for (var milestone : schedule) {
      if (!milestone.reached()) {
        throw new IllegalStateException("合同付款条件尚未达成：" + milestone.name());
      }
      if (milestone.amount() == null || milestone.amount().signum() < 0
          || !java.util.Set.of("待付", "部分已付", "已付").contains(milestone.status())) {
        throw new IllegalStateException("合同付款计划金额或状态异常，请先核对");
      }
      total = total.add(milestone.amount());
    }
    if (total.compareTo(contract.amount()) != 0) {
      throw new IllegalStateException("合同付款计划合计与合同金额不一致");
    }
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void recordFullPayment(String tenantId, String orderId, String invoiceId) {
    var contract = contracts.lockByOrder(tenantId, orderId);
    if (contract == null) return;
    for (var milestone : milestones.listByContract(tenantId, contract.id())) {
      if ("已付".equals(milestone.status())) continue;
      if (milestones.markPaid(tenantId, milestone.id(), "待付", "已付") != 1) {
        throw new IllegalStateException("合同付款计划已变更，请刷新后重试");
      }
      audit.recordTenantAction(tenantId, "contract.milestone_paid_from_invoice", "contract",
          contract.id(), "发票 " + invoiceId + " 已登记全额付款，更新里程碑 " + milestone.name());
    }
  }
}
