package com.procurement.catalog.application;

import com.procurement.catalog.api.CreateMaterialRequest;
import com.procurement.catalog.api.MaterialResponse;
import com.procurement.catalog.domain.Material;
import com.procurement.catalog.domain.MaterialAuditAction;
import com.procurement.catalog.infrastructure.MaterialMapper;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.event.DomainAuditEvent;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 试点:审计改为发布 DomainAuditEvent(而非直接调审计服务),由审计模块监听落库——
// 跨模块协作从直接 Service 调用 → 领域事件解耦(对标 §第三章 A 类债)。
@Service
public class MaterialApplicationService {
  private final MaterialMapper materialMapper;
  private final ApplicationEventPublisher eventPublisher;

  public MaterialApplicationService(
      MaterialMapper materialMapper, ApplicationEventPublisher eventPublisher) {
    this.materialMapper = materialMapper;
    this.eventPublisher = eventPublisher;
  }

  public List<MaterialResponse> listCurrentTenantMaterials() {
    return listCurrentTenantMaterials(null, null);
  }

  public List<MaterialResponse> listCurrentTenantMaterials(String category, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer material APIs");
    return materialMapper.listByTenant(tenantId, blankToNull(category), blankToNull(keyword)).stream()
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
        request.referencePrice(),
        orEmpty(request.specification()),
        orEmpty(request.brand()),
        orDefaultTax(request.taxRate()),
        orEmpty(request.description()));
    eventPublisher.publishEvent(
        new DomainAuditEvent(MaterialAuditAction.CREATED, AuditTargetType.MATERIAL, materialId));
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
        request.referencePrice(),
        orEmpty(request.specification()),
        orEmpty(request.brand()),
        orDefaultTax(request.taxRate()),
        orEmpty(request.description()));
    eventPublisher.publishEvent(
        new DomainAuditEvent(MaterialAuditAction.UPDATED, AuditTargetType.MATERIAL, materialId));
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
        material.referencePrice(),
        material.specification(),
        material.brand(),
        material.taxRate(),
        material.description());
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static java.math.BigDecimal orDefaultTax(java.math.BigDecimal value) {
    return value == null ? new java.math.BigDecimal("13.00") : value;
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
