package com.procurement.contract.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.contract.application.ContractApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/contracts")
public class BuyerContractController {
  private final ContractApplicationService contractApplicationService;

  public BuyerContractController(ContractApplicationService contractApplicationService) {
    this.contractApplicationService = contractApplicationService;
  }

  @GetMapping
  public ApiResponse<List<ContractResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String archiveStatus,
      @RequestParam(required = false) String supplierId) {
    return ApiResponse.ok(contractApplicationService.listCurrentTenantContracts(
        status,
        archiveStatus,
        supplierId));
  }

  @PostMapping
  public ApiResponse<ContractResponse> create(
      @Valid @RequestBody CreateContractRequest request) {
    return ApiResponse.ok(contractApplicationService.createCurrentTenantContract(request));
  }

  @PutMapping("/{contractId}")
  public ApiResponse<ContractResponse> update(
      @PathVariable String contractId,
      @Valid @RequestBody UpdateContractRequest request) {
    return ApiResponse.ok(contractApplicationService.updateCurrentTenantContract(
        contractId,
        request));
  }

  @PutMapping("/{contractId}/status")
  public ApiResponse<ContractResponse> updateStatus(
      @PathVariable String contractId,
      @Valid @RequestBody UpdateContractStatusRequest request) {
    return ApiResponse.ok(contractApplicationService.updateCurrentTenantContractStatus(
        contractId,
        request));
  }

  @PutMapping("/{contractId}/archive-status")
  public ApiResponse<ContractResponse> updateArchiveStatus(
      @PathVariable String contractId,
      @Valid @RequestBody UpdateContractArchiveStatusRequest request) {
    return ApiResponse.ok(contractApplicationService.updateCurrentTenantContractArchiveStatus(
        contractId,
        request));
  }

  @PostMapping("/{contractId}/approval")
  public ApiResponse<ContractResponse> submitApproval(@PathVariable String contractId) {
    return ApiResponse.ok(contractApplicationService.submitCurrentTenantContractApproval(contractId));
  }

  // 发起续签(到期提醒驱动)。
  @PostMapping("/{contractId}/renew")
  public ApiResponse<ContractResponse> renew(@PathVariable String contractId) {
    return ApiResponse.ok(contractApplicationService.initiateRenewal(contractId));
  }

  @PutMapping("/{contractId}/approval-review")
  public ApiResponse<ContractResponse> reviewApproval(
      @PathVariable String contractId,
      @Valid @RequestBody ReviewContractApprovalRequest request) {
    return ApiResponse.ok(contractApplicationService.reviewCurrentTenantContractApproval(
        contractId,
        request));
  }

  @GetMapping("/{contractId}/fulfillment-events")
  public ApiResponse<List<ContractFulfillmentEventResponse>> listFulfillmentEvents(
      @PathVariable String contractId) {
    return ApiResponse.ok(contractApplicationService.listCurrentTenantContractFulfillmentEvents(contractId));
  }

  @PostMapping("/{contractId}/fulfillment-events")
  public ApiResponse<ContractFulfillmentEventResponse> createFulfillmentEvent(
      @PathVariable String contractId,
      @Valid @RequestBody CreateContractFulfillmentEventRequest request) {
    return ApiResponse.ok(contractApplicationService.createCurrentTenantContractFulfillmentEvent(
        contractId,
        request));
  }

  // 合同变更/补充协议:时间线 + 登记变更(金额/工期变更应用到主合同)。
  @GetMapping("/{contractId}/amendments")
  public ApiResponse<List<ContractAmendmentResponse>> listAmendments(@PathVariable String contractId) {
    return ApiResponse.ok(contractApplicationService.listCurrentTenantContractAmendments(contractId));
  }

  @PostMapping("/{contractId}/amendments")
  public ApiResponse<ContractAmendmentResponse> createAmendment(
      @PathVariable String contractId,
      @Valid @RequestBody CreateContractAmendmentRequest request) {
    return ApiResponse.ok(
        contractApplicationService.addCurrentTenantContractAmendment(contractId, request));
  }
}
