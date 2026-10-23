package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.api.SupplierTeamRoleModels.*;
import com.procurement.supplier.application.SupplierTeamRoleService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
public class SupplierTeamRoleController {
  private final SupplierTeamRoleService service;
  public SupplierTeamRoleController(SupplierTeamRoleService service){this.service=service;}
  @GetMapping("/api/v1/supplier/team-roles")
  public ApiResponse<Workspace> list(){return ApiResponse.ok(service.list());}
  @PostMapping("/api/v1/supplier/team-roles")
  public ApiResponse<Role> create(@Valid @RequestBody Save request){return ApiResponse.ok(service.create(request));}
  @PutMapping("/api/v1/supplier/team-roles/{id}")
  public ApiResponse<Role> update(@PathVariable String id,@Valid @RequestBody Save request){return ApiResponse.ok(service.update(id,request));}
  @PutMapping("/api/v1/supplier/users/{id}/roles")
  public ApiResponse<Assignment> assign(@PathVariable String id,@Valid @RequestBody Assign request){return ApiResponse.ok(service.assign(id,request));}
}
