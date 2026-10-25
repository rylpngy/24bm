package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.ProjectMallContracts.*;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.application.MallApplicationService;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectMallService {
  private final ProcurementProjectGuard guard;
  private final ProjectExpansionMapper lots;
  private final ProcurementProjectMapper projects;
  private final ProjectMallMapper mapper;
  private final ProjectAllocationPolicy policy;
  private final ProjectExpansionService expansions;
  private final MallApplicationService mall;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;

  public ProjectMallService(
      ProcurementProjectGuard guard,
      ProjectExpansionMapper lots,
      ProcurementProjectMapper projects,
      ProjectMallMapper mapper,
      ProjectAllocationPolicy policy,
      ProjectExpansionService expansions,
      MallApplicationService mall,
      PermissionService permissions,
      AuditLogApplicationService audit) {
    this.guard = guard;
    this.lots = lots;
    this.projects = projects;
    this.mapper = mapper;
    this.policy = policy;
    this.expansions = expansions;
    this.mall = mall;
    this.permissions = permissions;
    this.audit = audit;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("project mall");
  }

  @Transactional(readOnly = true)
  public Selection selection(String project, String id) {
    guard.require(project, false);
    permissions.require("buyer:mall:read");
    var lot = lots.lot(tenant(), id);
    if (lot == null || !project.equals(lot.projectId()))
      throw new IllegalArgumentException("分包不存在");
    expansions.packageExecution(project, id);
    return mapper.find(tenant(), id);
  }

  @Transactional
  public Selection checkout(String project, String id, Checkout request) {
    guard.lock();
    var p = guard.require(project, true);
    guard.approved(p);
    policy.noPending(p);
    for (String permission :
        List.of(
            "buyer:mall:read",
            "buyer:mall:purchase",
            "buyer:rfq:manage",
            "buyer:rfq:read",
            "buyer:order:manage",
            "buyer:demand:read")) permissions.require(permission);
    var lot = lots.lot(tenant(), id);
    if (lot == null || !project.equals(lot.projectId()))
      throw new IllegalArgumentException("分包不存在");
    String hash =
        com.procurement.sourcing.application.ProcurementExecutionArchiveWriter.sha256(
            policy.write(request).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    var previous = mapper.find(tenant(), id);
    if (previous != null) {
      if (!previous.actorId().equals(TenantAccessGuard.requireUserId("project mall"))
          || !previous.requestKey().equals(request.requestKey())
          || !previous.requestHash().equals(hash))
        throw new IllegalStateException("分包已采购，请查看原订单，不得重复下单");
      expansions.packageExecution(project, id);
      return previous;
    }
    if (lot.revision() != request.revision()) throw new IllegalStateException("分包已变化，请刷新重试");
    if (!"ready".equals(lot.status()) || !lots.runs(tenant(), id).isEmpty())
      throw new IllegalStateException("仅尚未下发采购的待采购分包可商城选型下单");
    policy.validateLotDemands(lot);
    // Read the complete source set through its own permission/scope-aware application facade.
    expansions.packageExecution(project, id);
    var ids = lots.lotDemands(tenant(), id);
    var ceiling =
        ids.stream()
            .map(d -> projects.demand(tenant(), d).budget())
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .min(lot.amount());
    var result =
        mall.purchaseProjectPackage(
            p.title() + " · " + lot.title(),
            ids,
            policy.lines(lot.lines()).stream()
                .map(
                    l ->
                        new MallApplicationService.ProjectRequirement(
                            l.materialId(), l.unit(), l.quantity()))
                .toList(),
            request.items().stream()
                .map(i -> new MallApplicationService.ProjectSku(i.skuId(), i.quantity()))
                .toList(),
            ceiling,
            request.expectedReceiptDate(),
            request.addressId());
    var saved =
        new Selection(
            project,
            id,
            result.rfqId(),
            result.orderId(),
            request.requestKey(),
            hash,
            policy.write(
                Map.of(
                    "approvedPackage",
                    policy.tree(lot.snapshot()),
                    "selections",
                    result.selections(),
                    "demandIds",
                    ids)),
            request.reason(),
            TenantAccessGuard.requireUserId("project mall"),
            null);
    mapper.insert(tenant(), saved);
    audit.recordTenantAction(
        tenant(),
        "project.mall_checkout",
        "procurement_project",
        project,
        "分包:" + id + ";订单:" + result.orderId() + ";" + request.reason());
    return mapper.find(tenant(), id);
  }
}
