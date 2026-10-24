package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.ExternalIdentityService;
import com.procurement.identity.api.ExternalIdentityContracts.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/identity-bindings")
public class ExternalIdentityController {
  private final ExternalIdentityService service;
  public ExternalIdentityController(ExternalIdentityService service){this.service=service;}
  @io.swagger.v3.oas.annotations.Operation(operationId="externalIdentityList")
  @GetMapping public ApiResponse<BindingPage> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize,@RequestParam(defaultValue="") String keyword){return ApiResponse.ok(service.list(page,pageSize,keyword));}
  @io.swagger.v3.oas.annotations.Operation(operationId="externalIdentityReadiness")
  @GetMapping("/readiness") public ApiResponse<Readiness> readiness(){return ApiResponse.ok(service.readiness());}
  @io.swagger.v3.oas.annotations.Operation(operationId="externalIdentityCreate")
  @PostMapping public ApiResponse<Binding> create(@Valid @RequestBody Create r){return ApiResponse.ok(service.create(r));}
  @io.swagger.v3.oas.annotations.Operation(operationId="externalIdentityStatus")
  @PostMapping("/{id}/status") public ApiResponse<Binding> change(@PathVariable String id,@Valid @RequestBody Change r){return ApiResponse.ok(service.change(id,r));}
  @io.swagger.v3.oas.annotations.Operation(operationId="externalIdentityRemap")
  @PostMapping("/{id}/member") public ApiResponse<Binding> remap(@PathVariable String id,@Valid @RequestBody Remap r){return ApiResponse.ok(service.remap(id,r));}
}
