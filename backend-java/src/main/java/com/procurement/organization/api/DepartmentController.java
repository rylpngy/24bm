package com.procurement.organization.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.organization.application.DepartmentApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
