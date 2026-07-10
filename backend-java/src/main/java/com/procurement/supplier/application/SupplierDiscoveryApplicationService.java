package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.DiscoverableSupplierResponse;
import com.procurement.supplier.domain.SupplierProfile;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 寻源发现:搜全平台供应商企业,排除已在本租户私域库的,供采购方一键纳入(走 createSupplierRelation)。
@Service
public class SupplierDiscoveryApplicationService {
  private final SupplierProfileMapper supplierProfileMapper;

  public SupplierDiscoveryApplicationService(SupplierProfileMapper supplierProfileMapper) {
    this.supplierProfileMapper = supplierProfileMapper;
  }

  public List<DiscoverableSupplierResponse> discover(String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier discovery APIs");
    String trimmed = keyword == null || keyword.isBlank() ? null : keyword.trim();
    return supplierProfileMapper.discoverForTenant(tenantId, trimmed).stream()
        .map(this::toResponse)
        .toList();
  }

  private DiscoverableSupplierResponse toResponse(SupplierProfile p) {
    return new DiscoverableSupplierResponse(
        p.id(),
        p.name(),
        p.industry(),
        p.creditCode(),
        p.verifiedStatus(),
        p.profileStatus());
  }
}
