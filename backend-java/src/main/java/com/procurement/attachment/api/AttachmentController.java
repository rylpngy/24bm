package com.procurement.attachment.api;

import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
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
}
