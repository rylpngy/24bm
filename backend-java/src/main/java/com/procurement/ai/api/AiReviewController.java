package com.procurement.ai.api;

import com.procurement.ai.api.AiReviewDtos.*;
import com.procurement.ai.application.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.api.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/ai")
public class AiReviewController {
  private final AiReviewApplicationService reviews;
  private final AiPolicyApplicationService policies;
  public AiReviewController(AiReviewApplicationService reviews, AiPolicyApplicationService policies) {
    this.reviews = reviews; this.policies = policies;
  }
  @PostMapping("/reviews") public ApiResponse<Review> create(@Valid @RequestBody CreateReview request) {
    return ApiResponse.ok(reviews.create(request));
  }
  @GetMapping("/reviews") public ApiResponse<List<Review>> history(@RequestParam String subjectType,
      @RequestParam String subjectId, @RequestParam(defaultValue="10") int limit) {
    return ApiResponse.ok(reviews.history(subjectType, subjectId, limit));
  }
  @GetMapping("/reviews/{id}") public ApiResponse<Review> detail(@PathVariable String id) {
    return ApiResponse.ok(reviews.detail(id));
  }
  @PostMapping("/reviews/{id}/feedback") public ApiResponse<Review> feedback(@PathVariable String id,
      @Valid @RequestBody SubmitFeedback request) { return ApiResponse.ok(reviews.feedback(id, request)); }
  @GetMapping("/policies") public ApiResponse<List<Policy>> policies() { return ApiResponse.ok(policies.list()); }
  @GetMapping("/policies/{id}") public ApiResponse<Policy> policyDetail(@PathVariable String id) {
    return ApiResponse.ok(policies.detail(id));
  }
  @PostMapping("/policies") public ApiResponse<Policy> policy(@Valid @RequestBody CreatePolicy request) {
    return ApiResponse.ok(policies.create(request));
  }
  @PostMapping("/policies/{id}/publish") public ApiResponse<Policy> publish(@PathVariable String id) {
    return ApiResponse.ok(policies.publish(id));
  }
  @PostMapping("/policies/{id}/retire") public ApiResponse<Policy> retire(@PathVariable String id) {
    return ApiResponse.ok(policies.retire(id));
  }
}
