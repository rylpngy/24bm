package com.procurement.catalog.api;

import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/materials")
public class MaterialController {
  private final MaterialApplicationService materialApplicationService;

  public MaterialController(MaterialApplicationService materialApplicationService) {
    this.materialApplicationService = materialApplicationService;
  }

  @GetMapping
  public ApiResponse<List<MaterialResponse>> list(
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(materialApplicationService.listCurrentTenantMaterials(category, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<MaterialResponse> create(@Valid @RequestBody CreateMaterialRequest request) {
    return ApiResponse.ok(materialApplicationService.createMaterial(request));
  }

  @PostMapping("/{materialId}")
  public ApiResponse<MaterialResponse> update(
      @PathVariable String materialId,
      @Valid @RequestBody CreateMaterialRequest request) {
    return ApiResponse.ok(materialApplicationService.updateMaterial(materialId, request));
  }

  // Excel 批量导入:模板下载 + 文件字节直传(application/octet-stream)。
  @GetMapping("/import-template")
  public org.springframework.http.ResponseEntity<org.springframework.core.io.ByteArrayResource> importTemplate() {
    return com.procurement.common.excel.ExcelDownloads.xlsx(
        "物料导入模板.xlsx", materialApplicationService.importTemplate());
  }

  @PostMapping("/import")
  public ApiResponse<com.procurement.common.api.ImportResultResponse> importMaterials(
      @RequestBody byte[] data) {
    return ApiResponse.ok(materialApplicationService.importMaterials(data));
  }
}
