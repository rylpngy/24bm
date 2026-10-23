package com.procurement.order.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.order.infrastructure.OrderAccessMapper;
import java.util.function.Predicate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class OrderAccessService {
  private final OrderAccessMapper mapper;
  private final DataScopeService scopes;
  private final PermissionService permissions;

  public OrderAccessService(OrderAccessMapper mapper, DataScopeService scopes, PermissionService permissions) {
    this.mapper = mapper;
    this.scopes = scopes;
    this.permissions = permissions;
  }

  public boolean canRead(String permission) {
    return permissions.currentUserHas(permission);
  }

  private DataScope requireScope(String permission) {
    TenantAccessGuard.requireTenantId("buyer order APIs");
    permissions.require(permission);
    return scopes.currentUserDataScope();
  }

  public Predicate<String> visibleOrders(String permission) {
    DataScope scope = requireScope(permission);
    if (!scope.restricted()) return id -> true;
    var ids = mapper.visibleOrderIds(TenantAccessGuard.requireTenantId("buyer order APIs"), scope);
    return ids::contains;
  }

  public void requireOrder(String orderId, String permission) {
    DataScope scope = requireScope(permission);
    if (!mapper.canAccessOrder(TenantAccessGuard.requireTenantId("buyer order APIs"), orderId, scope)) {
      throw new AccessDeniedException("无权访问该订单及其收货数据");
    }
  }

  public void requireRfq(String rfqId) {
    requireRfq(rfqId, "buyer:order:manage");
  }

  public void requireRfq(String rfqId, String permission) {
    DataScope scope = requireScope(permission);
    if (!mapper.canAccessRfq(TenantAccessGuard.requireTenantId("buyer order APIs"), rfqId, scope)) {
      throw new AccessDeniedException("无权访问该采购项目");
    }
  }
}
