package com.procurement.tender.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.tender.application.TenderApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/tenders")
public class SupplierTenderController {
  private final TenderApplicationService tenderApplicationService;

  public SupplierTenderController(TenderApplicationService tenderApplicationService) {
    this.tenderApplicationService = tenderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<TenderResponse>> list() {
    return ApiResponse.ok(tenderApplicationService.listSupplierTenders());
  }

  @PostMapping("/{tenderId}/acquire")
  public ApiResponse<TenderResponse> acquire(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.acquire(tenderId));
  }

  /** F-1:提交资格预审申请(驳回后可修改重新提交)。 */
  @PostMapping("/{tenderId}/prequalification")
  public ApiResponse<TenderResponse> applyPrequalification(
      @PathVariable String tenderId, @Valid @RequestBody ApplyPrequalificationRequest request) {
    return ApiResponse.ok(tenderApplicationService.applyPrequalification(tenderId, request));
  }

  @PostMapping("/{tenderId}/bids")
  public ApiResponse<TenderBidResponse> submitBid(
      @PathVariable String tenderId, @Valid @RequestBody SubmitTenderBidRequest request) {
    return ApiResponse.ok(tenderApplicationService.submitBid(tenderId, request));
  }

  @PostMapping("/{tenderId}/inquiries/{inquiryId}/answer")
  public ApiResponse<TenderResponse> answerInquiry(
      @PathVariable String tenderId,
      @PathVariable String inquiryId,
      @Valid @RequestBody AnswerTenderInquiryRequest request) {
    return ApiResponse.ok(tenderApplicationService.answerInquiry(tenderId, inquiryId, request));
  }

  @PostMapping("/{tenderId}/bids/withdraw")
  public ApiResponse<TenderBidResponse> withdrawBid(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.withdrawBid(tenderId));
  }
}
