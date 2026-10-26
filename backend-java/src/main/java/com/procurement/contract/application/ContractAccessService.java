package com.procurement.contract.application;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import org.springframework.stereotype.Service;

@Service
public class ContractAccessService {
  private final ContractMapper mapper;
  private final PermissionService permissions;
  private final DataScopeService scopes;

  public ContractAccessService(ContractMapper mapper, PermissionService permissions, DataScopeService scopes) {
    this.mapper = mapper;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  public void requireRead() { permissions.require("buyer:contract:read"); }

  public void requireContract(String id, boolean write) {
    String tenant = requireAccess(id, write);
    if (write && mapper.lockById(tenant, id) == null) {
      throw new PermissionDeniedException("合同不存在或无权访问");
    }
  }

  // Archive must acquire the shared order lock before its contract row lock.
  public void requireArchiveAccess(String id) {
    requireAccess(id, true);
  }

  private String requireAccess(String id, boolean write) {
    permissions.require(write ? "buyer:contract:manage" : "buyer:contract:read");
    String tenant = TenantAccessGuard.requireTenantId("contract APIs");
    var scope = scopes.currentUserDataScope();
    if (scope.blocksAll() || !mapper.canAccessAttachment(tenant, id,
        scope.restricted() && scope.requesterId() == null ? scope.departmentIds() : null,
        scope.restricted() ? scope.requesterId() : null)) {
      throw new PermissionDeniedException("合同不存在或无权访问");
    }
    return tenant;
  }

  public void requireOrder(String id) {
    permissions.require("buyer:contract:manage");
    String tenant = TenantAccessGuard.requireTenantId("contract APIs");
    var scope = scopes.currentUserDataScope();
    if (scope.blocksAll() || !mapper.canAccessOrder(tenant, id,
        scope.restricted() && scope.requesterId() == null ? scope.departmentIds() : null,
        scope.restricted() ? scope.requesterId() : null)) {
      throw new PermissionDeniedException("订单不存在或无权创建合同");
    }
    String status=mapper.lockOrderStatus(tenant,id);
    if(status==null)throw new IllegalArgumentException("订单不存在");
    if(java.util.Set.of("取消协商中","已取消").contains(status))throw new IllegalStateException("订单正在取消或已取消，不能新建合同");
  }
}
