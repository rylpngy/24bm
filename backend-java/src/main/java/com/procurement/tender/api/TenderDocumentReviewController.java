package com.procurement.tender.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.tender.application.TenderDocumentReviewService;
import com.procurement.tender.infrastructure.TenderDocumentReviewMapper;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/tenders/{tenderId}/document-reviews")
public class TenderDocumentReviewController {
  @io.swagger.v3.oas.annotations.media.Schema(name = "SubmitTenderDocumentReviewRequest")
  public record Submit(Map<String,Object> formData) {}
  private final TenderDocumentReviewService service;
  public TenderDocumentReviewController(TenderDocumentReviewService service) { this.service=service; }
  @GetMapping public ApiResponse<TenderDocumentReviewService.State> history(@PathVariable String tenderId) { return ApiResponse.ok(service.state(tenderId)); }
  @PostMapping public ApiResponse<TenderDocumentReviewService.State> submit(@PathVariable String tenderId,@RequestBody Submit request) { service.submit(tenderId,request.formData()); return ApiResponse.ok(service.state(tenderId)); }
}
