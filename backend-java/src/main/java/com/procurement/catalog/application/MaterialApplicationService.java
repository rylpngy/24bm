package com.procurement.catalog.application;

import com.procurement.catalog.api.CreateMaterialRequest;
import com.procurement.catalog.api.MaterialResponse;
import com.procurement.catalog.domain.Material;
import com.procurement.catalog.infrastructure.MaterialMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MaterialApplicationService {
  private static final String MATERIAL_CREATED_ACTION = "material.created";
  private static final String MATERIAL_UPDATED_ACTION = "material.updated";
  private static final String MATERIAL_TARGET_TYPE = "material";

  private final MaterialMapper materialMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public MaterialApplicationService(
      MaterialMapper materialMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.materialMapper = materialMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<MaterialResponse> listCurrentTenantMaterials() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer material APIs");
    return materialMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public MaterialResponse createMaterial(CreateMaterialRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer material APIs");
    String materialId = "mat-" + UUID.randomUUID();
    materialMapper.insert(
        materialId,
        tenantId,
        request.code(),
        request.name(),
        request.category(),
        request.unit(),
        request.referencePrice());
    auditLogApplicationService.recordTenantAction(MATERIAL_CREATED_ACTION, MATERIAL_TARGET_TYPE, materialId);
    return toResponse(materialMapper.findByTenantAndId(tenantId, materialId));
  }

  @Transactional
  public MaterialResponse updateMaterial(String materialId, CreateMaterialRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer material APIs");
    requireMaterial(tenantId, materialId);
    materialMapper.update(
        tenantId,
        materialId,
        request.code(),
        request.name(),
        request.category(),
        request.unit(),
        request.referencePrice());
    auditLogApplicationService.recordTenantAction(MATERIAL_UPDATED_ACTION, MATERIAL_TARGET_TYPE, materialId);
    return toResponse(materialMapper.findByTenantAndId(tenantId, materialId));
  }

  private void requireMaterial(String tenantId, String materialId) {
    if (materialMapper.findByTenantAndId(tenantId, materialId) == null) {
      throw new IllegalArgumentException("Material not found in buyer tenant scope: " + materialId);
    }
  }

  private MaterialResponse toResponse(Material material) {
    return new MaterialResponse(
        material.id(),
        material.tenantId(),
        material.code(),
        material.name(),
        material.category(),
        material.unit(),
        material.referencePrice());
  }
}
