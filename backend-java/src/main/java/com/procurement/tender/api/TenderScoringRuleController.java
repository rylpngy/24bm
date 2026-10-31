package com.procurement.tender.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.tender.application.TenderScoringRuleService;
import com.procurement.tender.domain.TenderScoringWeights;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/tenders/{tenderId}/scoring-rule")
public class TenderScoringRuleController {
  @io.swagger.v3.oas.annotations.media.Schema(name = "SaveTenderScoringRuleRequest")
  public record Save(@NotNull BigDecimal technicalWeight,@NotNull BigDecimal commercialWeight,@NotNull BigDecimal priceWeight,
      @NotBlank @Size(max=1000) String reason,@NotNull @Min(0) Integer expectedRevision) {}
  private final TenderScoringRuleService service;
  public TenderScoringRuleController(TenderScoringRuleService service) { this.service=service; }
  @GetMapping public ApiResponse<TenderScoringRuleService.View> read(@PathVariable String tenderId) { return ApiResponse.ok(service.read(tenderId)); }
  @PutMapping public ApiResponse<TenderScoringRuleService.View> save(@PathVariable String tenderId,@Valid @RequestBody Save body) {
    return ApiResponse.ok(service.save(tenderId,new TenderScoringWeights(body.technicalWeight(),body.commercialWeight(),body.priceWeight()),body.reason(),body.expectedRevision()));
  }
}
