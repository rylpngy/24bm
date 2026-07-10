package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.finance.application.FinanceActionApplicationService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer")
public class BuyerFinanceActionController {
  private final FinanceActionApplicationService financeActionApplicationService;

  public BuyerFinanceActionController(FinanceActionApplicationService financeActionApplicationService) {
    this.financeActionApplicationService = financeActionApplicationService;
  }

  @GetMapping("/payment-batches")
  public ApiResponse<List<PaymentBatchResponse>> paymentBatches(
      @RequestParam(required = false) String batchStatus,
      @RequestParam(required = false) String supplierId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantPaymentBatches(
        batchStatus,
        supplierId));
  }

  @PutMapping("/payment-batches/{paymentBatchNo}/status")
  public ApiResponse<PaymentBatchResponse> updatePaymentBatchStatus(
      @PathVariable String paymentBatchNo,
      @Valid @RequestBody UpdatePaymentBatchStatusRequest request) {
    return ApiResponse.ok(financeActionApplicationService.updateCurrentTenantPaymentBatchStatus(
        paymentBatchNo,
        request));
  }

  @GetMapping("/payment-block-resolutions")
  public ApiResponse<List<PaymentBlockResolutionResponse>> paymentBlockResolutions(
      @RequestParam(required = false) String paymentBatchNo,
      @RequestParam(required = false) String blockReason,
      @RequestParam(required = false) String resolutionStatus,
      @RequestParam(required = false) String invoiceId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantPaymentBlockResolutions(
        paymentBatchNo,
        blockReason,
        resolutionStatus,
        invoiceId));
  }

  @GetMapping("/payment-archive-exception-requests")
  public ApiResponse<List<PaymentArchiveExceptionRequestResponse>> paymentArchiveExceptionRequests(
      @RequestParam(required = false) String paymentBatchNo,
      @RequestParam(required = false) String approvalStatus,
      @RequestParam(required = false) String exceptionType) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantPaymentArchiveExceptionRequests(
        paymentBatchNo,
        approvalStatus,
        exceptionType));
  }

  @PostMapping("/payment-archive-exception-requests")
  public ApiResponse<PaymentArchiveExceptionRequestResponse> createPaymentArchiveExceptionRequest(
      @Valid @RequestBody CreatePaymentArchiveExceptionRequestRequest request) {
    return ApiResponse.ok(financeActionApplicationService.createCurrentTenantPaymentArchiveExceptionRequest(request));
  }

  @PostMapping("/payment-archive-exception-requests/{requestId}/approval")
  public ApiResponse<ApprovalTaskResponse> reviewPaymentArchiveExceptionRequest(
      @PathVariable String requestId,
      @Valid @RequestBody ReviewPaymentArchiveExceptionRequest request) {
    return ApiResponse.ok(financeActionApplicationService.reviewCurrentTenantPaymentArchiveExceptionRequest(
        requestId,
        request));
  }

  @PostMapping("/payment-archive-exception-requests/{requestId}/controlled-action")
  public ApiResponse<PaymentArchiveExceptionRequestResponse> completePaymentArchiveExceptionAction(
      @PathVariable String requestId,
      @Valid @RequestBody CompletePaymentArchiveExceptionActionRequest request) {
    return ApiResponse.ok(financeActionApplicationService.completeCurrentTenantPaymentArchiveExceptionAction(
        requestId,
        request));
  }

  @PostMapping("/payment-archive-exception-requests/{requestId}/closure")
  public ApiResponse<PaymentArchiveExceptionRequestResponse> closePaymentArchiveExceptionRequest(
      @PathVariable String requestId,
      @Valid @RequestBody ClosePaymentArchiveExceptionRequestRequest request) {
    return ApiResponse.ok(financeActionApplicationService.closeCurrentTenantPaymentArchiveExceptionRequest(
        requestId,
        request));
  }

  @PostMapping("/payment-block-resolutions")
  public ApiResponse<PaymentBlockResolutionResponse> createPaymentBlockResolution(
      @Valid @RequestBody CreatePaymentBlockResolutionRequest request) {
    return ApiResponse.ok(financeActionApplicationService.createCurrentTenantPaymentBlockResolution(request));
  }

  @PutMapping("/payment-block-resolutions/{resolutionId}/status")
  public ApiResponse<PaymentBlockResolutionResponse> updatePaymentBlockResolutionStatus(
      @PathVariable String resolutionId,
      @Valid @RequestBody UpdatePaymentBlockResolutionStatusRequest request) {
    return ApiResponse.ok(financeActionApplicationService.updateCurrentTenantPaymentBlockResolutionStatus(
        resolutionId,
        request));
  }

  @GetMapping("/payment-execution-records")
  public ApiResponse<List<PaymentExecutionRecordResponse>> paymentExecutionRecords(
      @RequestParam(required = false) String paymentBatchNo,
      @RequestParam(required = false) String executionStatus,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String invoiceId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantPaymentExecutionRecords(
        paymentBatchNo,
        executionStatus,
        supplierId,
        invoiceId));
  }

  @PostMapping("/payment-execution-records/{executionRecordId}/registration")
  public ApiResponse<PaymentExecutionRecordResponse> registerPaymentExecutionRecord(
      @PathVariable String executionRecordId,
      // body 可选:不传时按默认"已付款"登记,兼容存量调用方。
      @RequestBody(required = false) @Valid RegisterPaymentRequest request) {
    return ApiResponse.ok(financeActionApplicationService.registerCurrentTenantPaymentExecutionRecord(
        executionRecordId,
        request));
  }

  @GetMapping("/three-way-matches")
  public ApiResponse<List<ThreeWayMatchResponse>> threeWayMatches(
      @RequestParam(required = false) String matchStatus,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String orderId,
      @RequestParam(required = false) String invoiceId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantThreeWayMatches(
        matchStatus,
        supplierId,
        orderId,
        invoiceId));
  }

  @GetMapping("/three-way-matches/{invoiceId}/lines")
  public ApiResponse<List<ThreeWayMatchLineResponse>> threeWayMatchLines(
      @PathVariable String invoiceId) {
    return ApiResponse.ok(
        financeActionApplicationService.listCurrentTenantThreeWayMatchLines(invoiceId));
  }

  @PostMapping("/three-way-matches/{invoiceId}/lines/{orderLineId}/variance")
  public ApiResponse<VarianceHandlingResponse> createVarianceFromMatchLine(
      @PathVariable String invoiceId, @PathVariable String orderLineId) {
    return ApiResponse.ok(
        financeActionApplicationService.createVarianceHandlingFromMatchLine(invoiceId, orderLineId));
  }

  @PostMapping("/three-way-matches/rebuild")
  public ApiResponse<ThreeWayMatchRebuildResponse> rebuildThreeWayMatches() {
    return ApiResponse.ok(financeActionApplicationService.rebuildCurrentTenantThreeWayMatches());
  }

  @PostMapping("/three-way-matches/{matchId}/variance-handling")
  public ApiResponse<VarianceHandlingResponse> createVarianceHandlingFromThreeWayMatch(
      @PathVariable String matchId) {
    return ApiResponse.ok(financeActionApplicationService.createVarianceHandlingFromThreeWayMatch(matchId));
  }

  @GetMapping("/payment-requests")
  public ApiResponse<List<PaymentRequestResponse>> paymentRequests(
      @RequestParam(required = false) String requestStatus,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String orderId,
      @RequestParam(required = false) String invoiceId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantPaymentRequests(
        requestStatus,
        supplierId,
        orderId,
        invoiceId));
  }

  @PostMapping("/payment-requests")
  public ApiResponse<PaymentRequestResponse> createPaymentRequest(
      @Valid @RequestBody CreatePaymentRequestRequest request) {
    return ApiResponse.ok(financeActionApplicationService.createCurrentTenantPaymentRequest(request));
  }

  @PutMapping("/payment-requests/{paymentRequestId}/status")
  public ApiResponse<PaymentRequestResponse> updatePaymentRequestStatus(
      @PathVariable String paymentRequestId,
      @Valid @RequestBody UpdatePaymentRequestStatusRequest request) {
    return ApiResponse.ok(financeActionApplicationService.updateCurrentTenantPaymentRequestStatus(
        paymentRequestId,
        request));
  }

  @GetMapping("/variance-handlings")
  public ApiResponse<List<VarianceHandlingResponse>> varianceHandlings(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String orderId,
      @RequestParam(required = false) String invoiceId) {
    return ApiResponse.ok(financeActionApplicationService.listCurrentTenantVarianceHandlings(
        status,
        supplierId,
        orderId,
        invoiceId));
  }

  @PostMapping("/variance-handlings")
  public ApiResponse<VarianceHandlingResponse> createVarianceHandling(
      @Valid @RequestBody CreateVarianceHandlingRequest request) {
    return ApiResponse.ok(financeActionApplicationService.createCurrentTenantVarianceHandling(request));
  }

  @PutMapping("/variance-handlings/{varianceHandlingId}/status")
  public ApiResponse<VarianceHandlingResponse> updateVarianceHandlingStatus(
      @PathVariable String varianceHandlingId,
      @Valid @RequestBody UpdateVarianceHandlingStatusRequest request) {
    return ApiResponse.ok(financeActionApplicationService.updateCurrentTenantVarianceHandlingStatus(
        varianceHandlingId,
        request));
  }

  @PostMapping("/variance-handlings/{varianceHandlingId}/manager-approval")
  public ApiResponse<VarianceHandlingResponse> approveVarianceHandling(
      @PathVariable String varianceHandlingId,
      @Valid @RequestBody ApproveVarianceHandlingRequest request) {
    return ApiResponse.ok(
        financeActionApplicationService.approveCurrentTenantVarianceHandling(
            varianceHandlingId, request));
  }

  // ====== 报表导出(format=xlsx|pdf,默认 xlsx)======

  @GetMapping("/reports/invoices")
  public ResponseEntity<ByteArrayResource> exportInvoices(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeActionApplicationService.exportInvoices(format));
  }

  @GetMapping("/reports/reconciliation")
  public ResponseEntity<ByteArrayResource> exportReconciliation(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeActionApplicationService.exportReconciliation(format));
  }

  @GetMapping("/reports/procurement-analytics")
  public ResponseEntity<ByteArrayResource> exportProcurementAnalytics(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeActionApplicationService.exportProcurementAnalytics(format));
  }

  private ResponseEntity<ByteArrayResource> download(
      com.procurement.finance.api.FinanceReport report) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentDisposition(
        ContentDisposition.attachment()
            .filename(report.filename(), StandardCharsets.UTF_8)
            .build());
    return ResponseEntity.ok()
        .headers(headers)
        .contentType(MediaType.parseMediaType(report.contentType()))
        .contentLength(report.content().length)
        .body(new ByteArrayResource(report.content()));
  }
}
