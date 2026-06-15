package com.procurement.catalog.api;

import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
  public ApiResponse<List<MaterialResponse>> list() {
    return ApiResponse.ok(materialApplicationService.listCurrentTenantMaterials());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<MaterialResponse> create(@Valid @RequestBody CreateMaterialRequest request) {
    return ApiResponse.ok(materialApplicationService.createMaterial(request));
  }
}
