package com.procurement.tender.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.tender.application.TenderApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/tenders")
public class BuyerTenderController {
  private final TenderApplicationService tenderApplicationService;

  public BuyerTenderController(TenderApplicationService tenderApplicationService) {
    this.tenderApplicationService = tenderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<TenderResponse>> list() {
    return ApiResponse.ok(tenderApplicationService.listCurrentTenantTenders());
  }

  @PostMapping
  public ApiResponse<TenderResponse> create(@Valid @RequestBody SaveTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.create(request));
  }

  @PutMapping("/{tenderId}")
  public ApiResponse<TenderResponse> update(
      @PathVariable String tenderId, @Valid @RequestBody SaveTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.updateDraft(tenderId, request));
  }

  @PostMapping("/{tenderId}/publish")
  public ApiResponse<TenderResponse> publish(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.publish(tenderId));
  }

  @PostMapping("/{tenderId}/open")
  public ApiResponse<TenderResponse> open(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.openTender(tenderId));
  }

  @PostMapping("/{tenderId}/execute")
  public ApiResponse<TenderResponse> execute(
      @PathVariable String tenderId, @Valid @RequestBody ExecuteTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.executeTender(tenderId, request));
  }

  @PostMapping("/{tenderId}/fail")
  public ApiResponse<TenderResponse> fail(
      @PathVariable String tenderId, @Valid @RequestBody FailTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.failTender(tenderId, request));
  }

  @PostMapping("/{tenderId}/rebid")
  public ApiResponse<TenderResponse> rebid(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.rebidTender(tenderId));
  }

  @PostMapping("/{tenderId}/award")
  public ApiResponse<TenderResponse> award(
      @PathVariable String tenderId, @Valid @RequestBody AwardTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.awardTender(tenderId, request));
  }

  @PostMapping("/{tenderId}/committee")
  public ApiResponse<TenderResponse> formCommittee(
      @PathVariable String tenderId, @Valid @RequestBody FormCommitteeRequest request) {
    return ApiResponse.ok(tenderApplicationService.formCommittee(tenderId, request));
  }

  @PostMapping("/{tenderId}/inquiries")
  public ApiResponse<TenderResponse> sendInquiry(
      @PathVariable String tenderId, @Valid @RequestBody SendTenderInquiryRequest request) {
    return ApiResponse.ok(tenderApplicationService.sendInquiry(tenderId, request));
  }

  @PostMapping("/{tenderId}/scores")
  public ApiResponse<TenderResponse> submitScores(
      @PathVariable String tenderId, @Valid @RequestBody SubmitScoresRequest request) {
    return ApiResponse.ok(tenderApplicationService.submitScores(tenderId, request));
  }

  @PostMapping("/{tenderId}/distribute")
  public ApiResponse<TenderResponse> distribute(
      @PathVariable String tenderId, @Valid @RequestBody DistributeTenderRequest request) {
    return ApiResponse.ok(tenderApplicationService.distribute(tenderId, request));
  }
}
