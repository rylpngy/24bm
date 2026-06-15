package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.domain.SupplierProfile;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import org.springframework.stereotype.Service;

@Service
public class SupplierProfileApplicationService {
  private final SupplierProfileMapper supplierProfileMapper;

  public SupplierProfileApplicationService(SupplierProfileMapper supplierProfileMapper) {
    this.supplierProfileMapper = supplierProfileMapper;
  }

  public SupplierProfileResponse getCurrentSupplierProfile() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier profile APIs");
    SupplierProfile profile = supplierProfileMapper.findBySupplierId(supplierId);
    if (profile == null) {
      throw new IllegalArgumentException("Supplier profile not found: " + supplierId);
    }
    return new SupplierProfileResponse(
        profile.id(),
        profile.name(),
        profile.type(),
        profile.industry(),
        profile.verified(),
        supplierProfileMapper.listConnectedBuyerNames(supplierId));
  }
}
