package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.OpportunityApplicationService;
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

// 公开商机大厅(permitAll):平台上采购人发布项目的公开信息 + 门户报名登记。
@RestController
@RequestMapping("/api/v1/public/opportunities")
public class PublicOpportunityController {
  private final OpportunityApplicationService opportunityApplicationService;

  public PublicOpportunityController(OpportunityApplicationService opportunityApplicationService) {
    this.opportunityApplicationService = opportunityApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PublicOpportunityResponse>> list() {
    return ApiResponse.ok(opportunityApplicationService.listPublicOpportunities());
  }

  @GetMapping("/{rfqId}")
  public ApiResponse<PublicOpportunityResponse> get(@PathVariable String rfqId) {
    return ApiResponse.ok(opportunityApplicationService.getPublicOpportunity(rfqId));
  }

  @PostMapping("/{rfqId}/enroll")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<Void> enroll(
      @PathVariable String rfqId, @Valid @RequestBody EnrollOpportunityRequest request) {
    opportunityApplicationService.enroll(rfqId, request);
    return ApiResponse.ok(null);
  }
}
