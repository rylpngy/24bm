package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// 邀请管理:GET 列表 / POST 发起 / POST {id}/respond(accept→桥接私域待准入)。
@RestController
@RequestMapping("/api/v1/buyer/supplier-invitations")
public class BuyerSupplierInvitationController {
  private final SupplierInvitationApplicationService supplierInvitationApplicationService;

  public BuyerSupplierInvitationController(
      SupplierInvitationApplicationService supplierInvitationApplicationService) {
    this.supplierInvitationApplicationService = supplierInvitationApplicationService;
  }

  @GetMapping
  public ApiResponse<List<SupplierInvitationResponse>> list() {
    return ApiResponse.ok(supplierInvitationApplicationService.listInvitations());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierInvitationResponse> create(
      @Valid @RequestBody CreateSupplierInvitationRequest request) {
    return ApiResponse.ok(supplierInvitationApplicationService.createInvitation(request));
  }

  @PostMapping("/{id}/respond")
  public ApiResponse<SupplierInvitationResponse> respond(
      @PathVariable String id, @Valid @RequestBody RespondSupplierInvitationRequest request) {
    return ApiResponse.ok(supplierInvitationApplicationService.respond(id, request));
  }

  // Excel 批量导入:模板下载 + 文件字节直传(application/octet-stream)。
  @GetMapping("/import-template")
  public org.springframework.http.ResponseEntity<org.springframework.core.io.ByteArrayResource> importTemplate() {
    return com.procurement.common.excel.ExcelDownloads.xlsx(
        "供应商邀请导入模板.xlsx", supplierInvitationApplicationService.importTemplate());
  }

  @PostMapping("/import")
  public ApiResponse<com.procurement.common.api.ImportResultResponse> importInvitations(
      @RequestBody byte[] data) {
    return ApiResponse.ok(supplierInvitationApplicationService.importInvitations(data));
  }
}
