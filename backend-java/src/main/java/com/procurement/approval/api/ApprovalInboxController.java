package com.procurement.approval.api;

import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.approval.application.ApprovalTemplateApplicationService;
import com.procurement.common.api.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/approvals")
public class ApprovalInboxController {
  private final ApprovalInboxApplicationService approvalInboxApplicationService;
  private final ApprovalTemplateApplicationService approvalTemplateApplicationService;

  public ApprovalInboxController(
      ApprovalInboxApplicationService approvalInboxApplicationService,
      ApprovalTemplateApplicationService approvalTemplateApplicationService) {
    this.approvalInboxApplicationService = approvalInboxApplicationService;
    this.approvalTemplateApplicationService = approvalTemplateApplicationService;
  }

  @GetMapping("/pending")
  public ApiResponse<List<PendingApprovalTaskResponse>> pending() {
    return ApiResponse.ok(approvalInboxApplicationService.listPending());
  }

  @GetMapping("/templates")
  public ApiResponse<List<ApprovalTemplateResponse>> templates() {
    return ApiResponse.ok(approvalTemplateApplicationService.listTemplates());
  }
}
