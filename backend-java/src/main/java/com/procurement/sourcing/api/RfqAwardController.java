package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.AwardApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/rfqs")
public class RfqAwardController {
  private final AwardApplicationService awardApplicationService;

  public RfqAwardController(AwardApplicationService awardApplicationService) {
    this.awardApplicationService = awardApplicationService;
  }

  @PostMapping("/{rfqId}/award")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<AwardDecisionResponse> award(@PathVariable String rfqId, @Valid @RequestBody AwardRfqRequest request) {
    return ApiResponse.ok(awardApplicationService.award(rfqId, request));
  }

  @PostMapping("/{rfqId}/award/approval")
  public ApiResponse<AwardDecisionResponse> reviewApproval(
      @PathVariable String rfqId,
      @Valid @RequestBody ReviewAwardApprovalRequest request) {
    return ApiResponse.ok(awardApplicationService.reviewApproval(rfqId, request));
  }
}
