package com.procurement.supplier.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.SupplierProfileResponse;
import com.procurement.supplier.api.UpdateSupplierProfileRequest;
import com.procurement.supplier.domain.SupplierProfile;
import com.procurement.supplier.domain.SupplierProfileAuditAction;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierProfileApplicationService {
  private final SupplierProfileMapper supplierProfileMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public SupplierProfileApplicationService(
      SupplierProfileMapper supplierProfileMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.supplierProfileMapper = supplierProfileMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public SupplierProfileResponse getCurrentSupplierProfile() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier profile APIs");
    return loadCurrentSupplierProfile(supplierId);
  }

  @Transactional
  public SupplierProfileResponse updateCurrentSupplierProfile(UpdateSupplierProfileRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier profile APIs");
    requireProfile(supplierId);
    supplierProfileMapper.updateEnterpriseProfile(
        supplierId,
        request.name(),
        request.industry());
    supplierProfileMapper.updateSupplierEnterpriseProfile(
        supplierId,
        request.creditCode(),
        request.legalPerson());
    auditLogApplicationService.recordTenantAction(
        null,
        SupplierProfileAuditAction.UPDATED,
        AuditTargetType.SUPPLIER_PROFILE,
        supplierId);
    return loadCurrentSupplierProfile(supplierId);
  }

  private SupplierProfileResponse loadCurrentSupplierProfile(String supplierId) {
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
        profile.creditCode(),
        profile.legalPerson(),
        profile.verifiedStatus(),
        profile.profileStatus(),
        supplierProfileMapper.listConnectedBuyerNames(supplierId));
  }

  private void requireProfile(String supplierId) {
    if (supplierProfileMapper.findBySupplierId(supplierId) == null) {
      throw new IllegalArgumentException("Supplier profile not found: " + supplierId);
    }
  }
}
