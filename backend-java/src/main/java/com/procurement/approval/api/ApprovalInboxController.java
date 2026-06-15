package com.procurement.approval.api;

import com.procurement.approval.application.ApprovalInboxApplicationService;
import com.procurement.common.api.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/approvals")
public class ApprovalInboxController {
  private final ApprovalInboxApplicationService approvalInboxApplicationService;

  public ApprovalInboxController(ApprovalInboxApplicationService approvalInboxApplicationService) {
    this.approvalInboxApplicationService = approvalInboxApplicationService;
  }

  @GetMapping("/pending")
  public ApiResponse<List<PendingApprovalTaskResponse>> pending() {
    return ApiResponse.ok(approvalInboxApplicationService.listPending());
  }
}
