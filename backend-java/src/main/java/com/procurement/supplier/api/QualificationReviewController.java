package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import com.procurement.supplier.application.QualificationWorkflowService;
import com.procurement.supplier.api.QualificationWorkflowContracts.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
public class QualificationReviewController {
  private final SupplierQualificationApplicationService service;
  private final QualificationWorkflowService workflows;
  public QualificationReviewController(SupplierQualificationApplicationService service,QualificationWorkflowService workflows) { this.service = service;this.workflows=workflows; }

  @GetMapping("/api/v1/buyer/suppliers/qualification-reviews/{id}/workflows")
  public ApiResponse<AttemptPage> history(@PathVariable long id,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return ApiResponse.ok(workflows.history(id,page,pageSize));}
  @PostMapping("/api/v1/buyer/suppliers/qualification-reviews/{id}/workflows")
  public ApiResponse<Attempt> start(@PathVariable long id,@Valid @RequestBody StartReview request){return ApiResponse.ok(workflows.start(id,request));}
  @PostMapping("/api/v1/buyer/suppliers/qualification-workflows/{id}/cancel")
  public ApiResponse<Void> cancel(@PathVariable String id,@Valid @RequestBody CancelReview request){workflows.cancel(id,request.reason());return ApiResponse.ok(null);}
  @GetMapping("/api/v1/buyer/suppliers/qualification-supplements")
  public ApiResponse<SupplementPage> buyerSupplements(@RequestParam(defaultValue="") String relationId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return ApiResponse.ok(workflows.supplements(false,relationId,page,pageSize));}
  @GetMapping("/api/v1/supplier/qualifications/supplements")
  public ApiResponse<SupplementPage> supplierSupplements(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return ApiResponse.ok(workflows.supplements(true,"",page,pageSize));}
  @PostMapping("/api/v1/buyer/suppliers/qualification-supplements")
  public ApiResponse<Supplement> request(@Valid @RequestBody SupplementDraft request){return ApiResponse.ok(workflows.request(request));}
  @PostMapping("/api/v1/supplier/qualifications/supplements/{id}/reply")
  public ApiResponse<Supplement> reply(@PathVariable String id,@Valid @RequestBody SupplementReply request){return ApiResponse.ok(workflows.reply(id,request));}
  @PostMapping("/api/v1/buyer/suppliers/qualification-supplements/{id}/cancel")
  public ApiResponse<Void> cancelSupplement(@PathVariable String id,@Valid @RequestBody SupplementCancel request){workflows.cancelSupplement(id,request);return ApiResponse.ok(null);}

  @GetMapping("/api/v1/buyer/suppliers/qualification-reviews")
  public ApiResponse<List<QualificationReviewResponse>> buyerReviews() { return ApiResponse.ok(service.buyerReviews()); }

  @GetMapping("/api/v1/supplier/qualifications/reviews")
  public ApiResponse<List<QualificationReviewResponse>> supplierReviews() { return ApiResponse.ok(service.supplierReviews()); }

  @PostMapping("/api/v1/buyer/suppliers/qualification-reviews/{id}/review")
  public ApiResponse<Void> review(@PathVariable long id, @Valid @RequestBody QualificationReviewRequest request) {
    service.review(id, request);
    return ApiResponse.ok(null);
  }
}
