package com.procurement.organization.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.organization.application.DepartmentApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/departments")
public class DepartmentController {
  private final DepartmentApplicationService departmentApplicationService;

  public DepartmentController(DepartmentApplicationService departmentApplicationService) {
    this.departmentApplicationService = departmentApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DepartmentResponse>> list() {
    return ApiResponse.ok(departmentApplicationService.listCurrentTenantDepartments());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<DepartmentResponse> create(@Valid @RequestBody CreateDepartmentRequest request) {
    return ApiResponse.ok(departmentApplicationService.createDepartment(request));
  }

  @PutMapping("/{departmentId}")
  public ApiResponse<DepartmentResponse> update(
      @PathVariable String departmentId,
      @Valid @RequestBody UpdateDepartmentRequest request) {
    return ApiResponse.ok(departmentApplicationService.updateDepartment(departmentId, request));
  }

  @PostMapping("/{departmentId}/disable")
  public ApiResponse<DepartmentResponse> disable(@PathVariable String departmentId) {
    return ApiResponse.ok(departmentApplicationService.disableDepartment(departmentId));
  }

  // Excel 批量导入:模板下载 + 文件字节直传(application/octet-stream)。
  @GetMapping("/import-template")
  public org.springframework.http.ResponseEntity<org.springframework.core.io.ByteArrayResource> importTemplate() {
    return com.procurement.common.excel.ExcelDownloads.xlsx(
        "部门导入模板.xlsx", departmentApplicationService.importTemplate());
  }

  @PostMapping("/import")
  public ApiResponse<com.procurement.common.api.ImportResultResponse> importDepartments(
      @RequestBody byte[] data) {
    return ApiResponse.ok(departmentApplicationService.importDepartments(data));
  }
}
