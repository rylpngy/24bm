package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.SupplierExitItemsPage;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierExitItemsMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierExitItemsService {
  private final BuyerSupplierRelationMapper relations;
  private final SupplierExitItemsMapper items;
  private final PermissionService permissions;
  private final DataScopeService scopes;

  public SupplierExitItemsService(BuyerSupplierRelationMapper relations, SupplierExitItemsMapper items,
      PermissionService permissions, DataScopeService scopes) {
    this.relations = relations;
    this.items = items;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public SupplierExitItemsPage list(String relationId, String kind, int page, int pageSize) {
    String tenant = TenantAccessGuard.requireTenantId("供应商退出异常明细");
    permissions.require("buyer:supplier:read");
    if (!"uninvoiced".equals(kind) && !"payment-verification".equals(kind)) {
      throw new IllegalArgumentException("退出异常类型无效");
    }
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      throw new IllegalArgumentException("页码必须大于零，每页条数须为1至100");
    }
    permissions.require("uninvoiced".equals(kind) ? "buyer:order:read" : "buyer:invoice:read");
    var relation = relations.findByTenantAndId(tenant, relationId);
    if (relation == null) throw new IllegalArgumentException("未找到本企业供应商关系");
    var scope = scopes.currentUserDataScope();
    long total = items.count(tenant, relation.supplierId(), kind, scope);
    var rows = items.list(tenant, relation.supplierId(), kind, scope, pageSize, ((long) page - 1) * pageSize);
    return new SupplierExitItemsPage(rows, total, page, pageSize);
  }
}
