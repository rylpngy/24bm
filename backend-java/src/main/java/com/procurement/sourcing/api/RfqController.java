package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.RfqApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/rfqs")
public class RfqController {
  private final RfqApplicationService rfqApplicationService;

  public RfqController(RfqApplicationService rfqApplicationService) {
    this.rfqApplicationService = rfqApplicationService;
  }

  @GetMapping
  public ApiResponse<List<RfqResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(rfqApplicationService.listCurrentTenantRfqs(status, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<RfqResponse> create(@Valid @RequestBody CreateRfqRequest request) {
    return ApiResponse.ok(rfqApplicationService.create(request));
  }
}
