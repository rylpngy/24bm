package com.procurement.attachment.api;

import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.application.AttachmentApplicationService.DownloadedObject;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
@RequestMapping("/api/v1/buyer/attachments")
public class AttachmentController {
  private final AttachmentApplicationService attachmentApplicationService;

  public AttachmentController(AttachmentApplicationService attachmentApplicationService) {
    this.attachmentApplicationService = attachmentApplicationService;
  }

  @GetMapping
  public ApiResponse<List<AttachmentResponse>> list(
      @RequestParam @NotBlank String ownerType,
      @RequestParam @NotBlank String ownerId) {
    return ApiResponse.ok(attachmentApplicationService.listCurrentTenantAttachments(ownerType, ownerId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<AttachmentResponse> create(@Valid @RequestBody CreateAttachmentRequest request) {
    return ApiResponse.ok(attachmentApplicationService.createCurrentTenantAttachment(request));
  }

  @PostMapping("/upload-ticket")
  public ApiResponse<AttachmentUploadTicketResponse> createUploadTicket(
      @Valid @RequestBody CreateAttachmentUploadTicketRequest request) {
    return ApiResponse.ok(attachmentApplicationService.createCurrentTenantUploadTicket(request));
  }

  @PostMapping("/{attachmentId}/download-link")
  public ApiResponse<AttachmentDownloadLinkResponse> createDownloadLink(@PathVariable String attachmentId) {
    return ApiResponse.ok(attachmentApplicationService.createCurrentTenantDownloadLink(attachmentId));
  }

  @PostMapping("/{attachmentId}/integrity-check")
  public ApiResponse<AttachmentIntegrityResponse> integrity(@PathVariable String attachmentId) {
    return ApiResponse.ok(attachmentApplicationService.checkCurrentTenantIntegrity(attachmentId));
  }

  // 服务端代收上传字节(上传票据中的 upload-sink),落到对象存储。
  @PostMapping("/upload-sink")
  public ApiResponse<Void> uploadSink(
      @RequestParam @NotBlank String storageKey,
      @RequestParam @NotBlank String token,
      @RequestParam(required = false) String contentType,
      @RequestBody byte[] data) {
    attachmentApplicationService.storeCurrentTenantObject(storageKey, token, data, contentType);
    return ApiResponse.ok(null);
  }

  // 按附件 id 流式下载(下载链接中的 /download)。
  @GetMapping("/{attachmentId}/download")
  public ResponseEntity<Resource> download(@PathVariable String attachmentId) {
    DownloadedObject object = attachmentApplicationService.loadCurrentTenantObject(attachmentId);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            org.springframework.http.ContentDisposition.attachment().filename(object.fileName(), StandardCharsets.UTF_8).build().toString())
        .contentType(
            object.contentType() == null || object.contentType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(object.contentType()))
        .body(new ByteArrayResource(object.data()));
  }
}
