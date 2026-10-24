package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierEvaluationTemplateService;
import com.procurement.supplier.api.SupplierEvaluationTemplateRequests.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/supplier-evaluation-templates")
public class SupplierEvaluationTemplateController {
  private final SupplierEvaluationTemplateService service;
  public SupplierEvaluationTemplateController(SupplierEvaluationTemplateService service) { this.service = service; }

  @GetMapping
  public ApiResponse<List<SupplierEvaluationTemplateResponse>> list() { return ApiResponse.ok(service.list()); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierEvaluationTemplateResponse> create(@Valid @RequestBody Definition request) {
    return ApiResponse.ok(service.create(request));
  }

  @PostMapping("/{templateId}/versions")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierEvaluationTemplateResponse> version(@PathVariable String templateId,
      @Valid @RequestBody Definition request) { return ApiResponse.ok(service.version(templateId, request)); }

  @PatchMapping("/{templateId}/enabled")
  public ApiResponse<Void> enabled(@PathVariable String templateId, @Valid @RequestBody Enabled request) {
    service.enabled(templateId, request.enabled());
    return ApiResponse.ok(null);
  }
}
