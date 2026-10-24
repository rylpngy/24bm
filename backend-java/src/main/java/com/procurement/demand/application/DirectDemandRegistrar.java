package com.procurement.demand.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemandSource;
import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.numbering.application.NumberingApplicationService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 直录登记:采购部门在计划/询价节点直接创建采购内容时,反向登记一条「已通过」需求并即刻可挂链。
// 独立于 PurchaseDemandApplicationService,避免 sourcing↔demand 应用服务互相依赖成环。
@Service
public class DirectDemandRegistrar {
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final PurchaseDemandItemMapper purchaseDemandItemMapper;
  private final DepartmentMapper departmentMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private NumberingApplicationService numbering;

  @Autowired
  void setNumberingApplicationService(NumberingApplicationService numbering) {
    this.numbering = numbering;
  }

  public DirectDemandRegistrar(
      PurchaseDemandMapper purchaseDemandMapper,
      PurchaseDemandItemMapper purchaseDemandItemMapper,
      DepartmentMapper departmentMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.purchaseDemandItemMapper = purchaseDemandItemMapper;
    this.departmentMapper = departmentMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public record DirectLineItem(String materialId, Integer quantity) {}

  /** 登记直录需求(状态=已通过,来源=直录登记),返回需求编号供计划/询价挂链。 */
  @Transactional
  public String registerApproved(
      String title,
      String departmentId,
      BigDecimal budget,
      List<DirectLineItem> lineItems) {
    String tenantId = TenantAccessGuard.requireTenantId("direct demand registration");
    String userId = TenantAccessGuard.requireUserId("direct demand registration");
    if (lineItems == null || lineItems.isEmpty()) {
      throw new IllegalArgumentException("直录登记至少需要一条采购内容明细");
    }
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("归口部门不存在或已停用: " + departmentId);
    }
    String demandId = numbering == null
        ? NumberingApplicationService.defaultNumber("demand", departmentId, purchaseDemandMapper::allocateSequence)
        : numbering.nextDemandNumber(departmentId, purchaseDemandMapper::allocateSequence);
    purchaseDemandMapper.insert(
        demandId,
        tenantId,
        title,
        departmentId,
        userId,
        budget == null ? BigDecimal.ZERO : budget,
        PurchaseDemandStatus.APPROVED,
        null,
        "常规",
        "采购部门直录登记(计划/询价节点直接创建)",
        PurchaseDemandSource.DIRECT);
    for (DirectLineItem lineItem : lineItems) {
      if (lineItem.materialId() == null || lineItem.materialId().isBlank()) {
        throw new IllegalArgumentException("直录明细缺少物料");
      }
      if (lineItem.quantity() == null || lineItem.quantity() <= 0) {
        throw new IllegalArgumentException("直录明细数量必须大于 0: " + lineItem.materialId());
      }
      purchaseDemandItemMapper.insert(
          "dem-item-" + UUID.randomUUID(),
          tenantId,
          demandId,
          lineItem.materialId(),
          BigDecimal.valueOf(lineItem.quantity()));
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "purchase_demand.direct_registered",
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId,
        "直录登记: " + title);
    return demandId;
  }

}
