package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.api.FrozenPaymentCorrectionContracts.*;
import com.procurement.finance.application.FrozenPaymentCorrectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/invoices/{invoice}/payment-ledger/corrections")
public record FrozenPaymentCorrectionController(FrozenPaymentCorrectionService service) {
  @GetMapping("/funding-options")
  @io.swagger.v3.oas.annotations.Operation(operationId="frozenPaymentFundingOptions")
  public ApiResponse<com.procurement.buyer.application.FundingCorrectionService.Options> fundingOptions(@PathVariable String invoice,@RequestParam String entryId) {
    return ApiResponse.ok(service.fundingOptions(invoice,entryId));
  }
  @GetMapping("/candidates")
  @io.swagger.v3.oas.annotations.Operation(operationId="frozenPaymentCorrectionCandidates")
  public ApiResponse<List<Candidate>> candidates(@PathVariable String invoice) {
    return ApiResponse.ok(service.candidates(invoice));
  }

  @GetMapping
  @io.swagger.v3.oas.annotations.Operation(operationId="frozenPaymentCorrectionHistory")
  public ApiResponse<Page> history(
      @PathVariable String invoice,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(service.history(invoice, page, pageSize));
  }

  @PostMapping
  @io.swagger.v3.oas.annotations.Operation(operationId="frozenPaymentCorrectionSubmit")
  public ApiResponse<Correction> submit(
      @PathVariable String invoice, @Valid @RequestBody Request request) {
    return ApiResponse.ok(service.submit(invoice, request));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name="FrozenPaymentCorrectionWithdrawRequest")
  public record Withdraw(@NotBlank @Size(max = 1000) String reason) {}

  @PostMapping("/{id}/withdraw")
  @io.swagger.v3.oas.annotations.Operation(operationId="frozenPaymentCorrectionWithdraw")
  public ApiResponse<Correction> withdraw(
      @PathVariable String invoice, @PathVariable String id, @Valid @RequestBody Withdraw request) {
    return ApiResponse.ok(service.withdraw(invoice, id, request.reason()));
  }
}
