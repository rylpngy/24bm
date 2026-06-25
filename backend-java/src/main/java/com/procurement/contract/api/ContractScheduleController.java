package com.procurement.contract.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.contract.application.ContractScheduleService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/contracts")
public class ContractScheduleController {
  private final ContractScheduleService contractScheduleService;

  public ContractScheduleController(ContractScheduleService contractScheduleService) {
    this.contractScheduleService = contractScheduleService;
  }

  @GetMapping("/{contractId}/line-items")
  public ApiResponse<List<ContractLineItemResponse>> lineItems(@PathVariable String contractId) {
    return ApiResponse.ok(contractScheduleService.lineItems(contractId));
  }

  @GetMapping("/{contractId}/payment-milestones")
  public ApiResponse<List<ContractPaymentMilestoneResponse>> milestones(
      @PathVariable String contractId) {
    return ApiResponse.ok(contractScheduleService.milestones(contractId));
  }

  @PostMapping("/{contractId}/payment-milestones/generate")
  public ApiResponse<List<ContractPaymentMilestoneResponse>> generate(
      @PathVariable String contractId) {
    return ApiResponse.ok(contractScheduleService.generateDefaultSchedule(contractId));
  }

  @PostMapping("/{contractId}/payment-milestones/{milestoneId}/pay")
  public ApiResponse<List<ContractPaymentMilestoneResponse>> pay(
      @PathVariable String contractId, @PathVariable String milestoneId) {
    return ApiResponse.ok(contractScheduleService.payMilestone(contractId, milestoneId));
  }
}
