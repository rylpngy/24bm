package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/supplier/qualifications")
public class SupplierQualificationController {
  private final SupplierQualificationApplicationService supplierQualificationApplicationService;

  public SupplierQualificationController(SupplierQualificationApplicationService supplierQualificationApplicationService) {
    this.supplierQualificationApplicationService = supplierQualificationApplicationService;
  }

  @GetMapping
  public ApiResponse<List<SupplierQualificationResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(supplierQualificationApplicationService.listCurrentSupplierQualifications(status, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierQualificationResponse> create(
      @Valid @RequestBody CreateSupplierQualificationRequest request) {
    return ApiResponse.ok(supplierQualificationApplicationService.createCurrentSupplierQualification(request));
  }

  // ── E-1 证照自助上传/下载 ─────────────────────────────
  @PostMapping("/upload-ticket")
  public ApiResponse<QualificationUploadTicketResponse> createUploadTicket(
      @Valid @RequestBody CreateQualificationUploadTicketRequest request) {
    return ApiResponse.ok(supplierQualificationApplicationService.createUploadTicket(request));
  }

  @PostMapping("/upload-sink")
  public ApiResponse<Void> uploadSink(
      @RequestParam @NotBlank String storageKey,
      @RequestParam(required = false) String contentType,
      @RequestBody byte[] data) {
    supplierQualificationApplicationService.storeObject(storageKey, data, contentType);
    return ApiResponse.ok(null);
  }

  @GetMapping("/{qualificationId}/download")
  public ResponseEntity<Resource> download(@PathVariable String qualificationId) {
    ObjectStorageService.StoredObject object =
        supplierQualificationApplicationService.loadOwnObject(qualificationId);
    return streamed(object, qualificationId);
  }

  static ResponseEntity<Resource> streamed(ObjectStorageService.StoredObject object, String fallbackName) {
    String encoded = URLEncoder.encode(fallbackName, StandardCharsets.UTF_8).replace("+", "%20");
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"" + fallbackName + "\"; filename*=UTF-8''" + encoded)
        .contentType(object.contentType() == null
            ? MediaType.APPLICATION_OCTET_STREAM
            : MediaType.parseMediaType(object.contentType()))
        .body(new ByteArrayResource(object.data()));
  }

  @PostMapping("/{qualificationId}/status")
  public ApiResponse<SupplierQualificationResponse> changeStatus(
      @PathVariable String qualificationId,
      @Valid @RequestBody ChangeSupplierQualificationStatusRequest request) {
    return ApiResponse.ok(supplierQualificationApplicationService.changeQualificationStatus(qualificationId, request));
  }
}
