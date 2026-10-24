package com.procurement.numbering.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.numbering.application.NumberingApplicationService;
import com.procurement.numbering.domain.NumberingRule;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/numbering-rules")
public class BuyerNumberingRuleController {
  private final NumberingApplicationService service;
  public BuyerNumberingRuleController(NumberingApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<List<NumberingRule>> list() { return ApiResponse.ok(service.list()); }

  @PutMapping("/{businessType}")
  public ApiResponse<NumberingRule> save(@PathVariable String businessType,
      @Valid @RequestBody SaveNumberingRuleRequest request) {
    return ApiResponse.ok(service.save(businessType, request.toRule(businessType)));
  }

  @PostMapping("/{businessType}/preview")
  public ApiResponse<NumberingApplicationService.Preview> preview(@PathVariable String businessType,
      @Valid @RequestBody SaveNumberingRuleRequest request) {
    return ApiResponse.ok(service.preview(businessType, request.toRule(businessType)));
  }
}
