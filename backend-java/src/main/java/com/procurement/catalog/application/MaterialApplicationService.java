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

  // ====== Excel 批量导入:模板下载 + 逐行校验(部分成功,失败行带原因)======

  private static final List<String> IMPORT_HEADERS = List.of(
      "物料编码*", "物料名称*", "分类*", "计量单位*", "参考价", "规格型号", "品牌", "税率(%)", "描述");

  public byte[] importTemplate() {
    return com.procurement.common.excel.ExcelSheets.template(
        "物料导入模板",
        IMPORT_HEADERS,
        List.of(List.of("MAT-0001", "A4复印纸", "办公用品", "箱", "180", "70g 500张*5包", "得力", "13", "示例行,导入前请删除")));
  }

  @Transactional
  public com.procurement.common.api.ImportResultResponse importMaterials(byte[] content) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer material APIs");
    List<List<String>> rows = com.procurement.common.excel.ExcelSheets.readFirstSheet(content, 501);
    if (rows.size() <= 1) {
      throw new IllegalArgumentException("文件中没有数据行,请按模板填写后再导入");
    }
    java.util.Set<String> existingCodes = new java.util.HashSet<>();
    for (Material material : materialMapper.listByTenant(tenantId, null, null)) {
      existingCodes.add(material.code());
    }
    List<com.procurement.common.api.ImportRowError> failures = new java.util.ArrayList<>();
    int success = 0;
    for (int r = 1; r < rows.size(); r++) {
      List<String> cells = rows.get(r);
      int rowNumber = r + 1;
      String code = cell(cells, 0);
      String name = cell(cells, 1);
      String category = cell(cells, 2);
      String unit = cell(cells, 3);
      if (code.isBlank() && name.isBlank() && category.isBlank() && unit.isBlank()) {
        continue; // 整行空白跳过,不计失败。
      }
      if (code.isBlank() || name.isBlank() || category.isBlank() || unit.isBlank()) {
        failures.add(new com.procurement.common.api.ImportRowError(
            rowNumber, "物料编码/名称/分类/单位为必填项"));
        continue;
      }
      if (existingCodes.contains(code)) {
        failures.add(new com.procurement.common.api.ImportRowError(
            rowNumber, "物料编码已存在(库内或文件内重复): " + code));
        continue;
      }
      java.math.BigDecimal referencePrice;
      java.math.BigDecimal taxRate;
      try {
        referencePrice = parseDecimal(cell(cells, 4), "参考价");
        taxRate = parseDecimal(cell(cells, 7), "税率");
      } catch (IllegalArgumentException exception) {
        failures.add(new com.procurement.common.api.ImportRowError(rowNumber, exception.getMessage()));
        continue;
      }
      String materialId = "mat-" + UUID.randomUUID();
      materialMapper.insert(
          materialId,
          tenantId,
          code,
          name,
          category,
          unit,
          referencePrice == null ? java.math.BigDecimal.ZERO : referencePrice,
          cell(cells, 5),
          cell(cells, 6),
          orDefaultTax(taxRate),
          cell(cells, 8));
      eventPublisher.publishEvent(
          new DomainAuditEvent(MaterialAuditAction.CREATED, AuditTargetType.MATERIAL, materialId));
      existingCodes.add(code);
      success++;
    }
    return new com.procurement.common.api.ImportResultResponse(rows.size() - 1, success, failures);
  }

  private static String cell(List<String> cells, int index) {
    return index < cells.size() ? cells.get(index) : "";
  }

  private static java.math.BigDecimal parseDecimal(String raw, String label) {
    if (raw == null || raw.isBlank()) {
      return null;
    }
    try {
      java.math.BigDecimal value = new java.math.BigDecimal(raw.replace(",", ""));
      if (value.signum() < 0) {
        throw new IllegalArgumentException(label + "不能为负数: " + raw);
      }
      return value;
    } catch (NumberFormatException exception) {
      throw new IllegalArgumentException(label + "不是有效数字: " + raw);
    }
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
