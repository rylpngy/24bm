package com.procurement.finance.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.infrastructure.FinanceAccessMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class FinanceAccessService {
  private final FinanceAccessMapper mapper;
  private final DataScopeService scopes;
  private final PermissionService permissions;

  public FinanceAccessService(FinanceAccessMapper mapper, DataScopeService scopes, PermissionService permissions) {
    this.mapper = mapper;
    this.scopes = scopes;
    this.permissions = permissions;
  }

  public DataScope requireScope(String permission) {
    TenantAccessGuard.requireTenantId("finance APIs");
    permissions.require(permission);
    return scopes.currentUserDataScope();
  }

  public DataScope readScope() {
    return requireScope("buyer:invoice:read");
  }

  public boolean canRead() {
    return permissions.currentUserHas("buyer:invoice:read");
  }

  public void requireInvoice(String invoiceId, String permission) {
    DataScope scope = requireScope(permission);
    if (!mapper.canAccessInvoice(TenantAccessGuard.requireTenantId("finance APIs"), invoiceId, scope)) {
      throw new AccessDeniedException("无权访问该发票及其付款数据");
    }
  }

  public void requireBatch(String batchNo, String permission) {
    DataScope scope = requireScope(permission);
    if (!mapper.canAccessBatch(TenantAccessGuard.requireTenantId("finance APIs"), batchNo, scope)) {
      throw new AccessDeniedException("无权访问该付款批次的全部明细，请由具备完整数据范围的人员办理");
    }
  }
}
