package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.CreateSupplierQualificationRequest;
import com.procurement.supplier.api.SupplierQualificationResponse;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierQualificationApplicationService {
  private static final String ACTIVE_STATUS = "active";

  private final SupplierQualificationMapper supplierQualificationMapper;

  public SupplierQualificationApplicationService(SupplierQualificationMapper supplierQualificationMapper) {
    this.supplierQualificationMapper = supplierQualificationMapper;
  }

  public List<SupplierQualificationResponse> listCurrentSupplierQualifications() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    return supplierQualificationMapper.listActiveBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public SupplierQualificationResponse createCurrentSupplierQualification(CreateSupplierQualificationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    String qualificationId = "qual-" + UUID.randomUUID();
    supplierQualificationMapper.insert(
        qualificationId,
        supplierId,
        request.qualificationType(),
        request.certificateNo(),
        request.expiresAt(),
        request.fileName(),
        request.storageKey(),
        ACTIVE_STATUS);
    return toResponse(supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId));
  }

  private SupplierQualificationResponse toResponse(SupplierQualification qualification) {
    return new SupplierQualificationResponse(
        qualification.id(),
        qualification.supplierId(),
        qualification.qualificationType(),
        qualification.certificateNo(),
        qualification.expiresAt(),
        qualification.fileName(),
        qualification.storageKey(),
        qualification.status(),
        qualification.createdAt());
  }
}
