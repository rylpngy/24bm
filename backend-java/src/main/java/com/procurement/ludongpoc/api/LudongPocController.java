package com.procurement.ludongpoc.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.ludongpoc.application.LudongPocApplicationService;
import com.procurement.ludongpoc.application.LudongPocAiReviewService;
import com.procurement.ludongpoc.application.LudongPocAiReviewRegistry;
import com.procurement.ludongpoc.application.LudongPocAnalyticsReportService;
import com.procurement.ludongpoc.application.LudongPocDocumentService;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
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
@RequestMapping("/api/v1/buyer/ludong-poc")
public class LudongPocController {
  private static final MediaType DOCX = MediaType.parseMediaType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  private static final MediaType XLSX = MediaType.parseMediaType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  private final LudongPocApplicationService applicationService;
  private final LudongPocDocumentService documentService;
  private final LudongPocAnalyticsReportService analyticsReportService;
  private final LudongPocAiReviewService aiReviewService;
  private final LudongPocAiReviewRegistry aiReviewRegistry;

  public LudongPocController(
      LudongPocApplicationService applicationService,
      LudongPocDocumentService documentService,
      LudongPocAnalyticsReportService analyticsReportService,
      LudongPocAiReviewService aiReviewService,
      LudongPocAiReviewRegistry aiReviewRegistry) {
    this.applicationService = applicationService;
    this.documentService = documentService;
    this.analyticsReportService = analyticsReportService;
    this.aiReviewService = aiReviewService;
    this.aiReviewRegistry = aiReviewRegistry;
  }

  @GetMapping("/applications")
  public ApiResponse<List<LudongPocApplicationResponse>> list() {
    return ApiResponse.ok(applicationService.list());
  }

  @GetMapping("/applications/{id}")
  public ApiResponse<LudongPocApplicationResponse> get(@PathVariable String id) {
    return ApiResponse.ok(applicationService.get(id));
  }

  @PostMapping("/applications")
  public ApiResponse<LudongPocApplicationResponse> create(
      @Valid @RequestBody LudongPocApplicationRequest request) {
    return ApiResponse.ok(applicationService.create(request));
  }

  @PutMapping("/applications/{id}")
  public ApiResponse<LudongPocApplicationResponse> update(
      @PathVariable String id,
      @Valid @RequestBody LudongPocApplicationRequest request) {
    return ApiResponse.ok(applicationService.update(id, request));
  }

  @PostMapping("/applications/{id}/submit")
  public ApiResponse<LudongPocApplicationResponse> submit(@PathVariable String id) {
    return ApiResponse.ok(applicationService.submit(id));
  }

  @GetMapping("/applications/{id}/approval-records")
  public ApiResponse<List<com.procurement.ludongpoc.domain.LudongPocReviewRecord>> reviewHistory(
      @PathVariable String id, @RequestParam String instanceId) {
    return ApiResponse.ok(applicationService.reviewHistory(id, instanceId));
  }

  @PostMapping("/tasks/{taskId}/complete")
  public ApiResponse<LudongPocTaskCompletionResponse> completeTask(
      @PathVariable String taskId,
      @Valid @RequestBody CompleteLudongPocTaskRequest request) {
    return ApiResponse.ok(applicationService.completeTask(taskId, request));
  }

  @PostMapping("/applications/{id}/ai-review")
  public ApiResponse<LudongPocAiReviewResponse> aiReview(
      @PathVariable String id,
      @Valid @RequestBody LudongPocAiReviewRequest request) {
    LudongPocAiReviewResponse response = aiReviewService.review(
        applicationService.get(id), request.nodeId(), request.currentReviewData(),
        applicationService.listPriorApprovals(id));
    return ApiResponse.ok(aiReviewRegistry.record(id, request.nodeId(), response));
  }

  @PostMapping("/applications/{id}/ai-review/{runId}/feedback")
  public ApiResponse<Void> aiReviewFeedback(
      @PathVariable String id,
      @PathVariable String runId,
      @Valid @RequestBody LudongPocAiReviewFeedbackRequest request) {
    aiReviewRegistry.feedback(id, runId, request);
    return ApiResponse.ok(null);
  }

  @GetMapping("/ai-review/metrics")
  public ApiResponse<LudongPocAiReviewMetricsResponse> aiReviewMetrics() {
    return ApiResponse.ok(aiReviewRegistry.metrics());
  }

  @GetMapping("/stats")
  public ApiResponse<LudongPocStatsResponse> stats() {
    return ApiResponse.ok(applicationService.stats());
  }

  @GetMapping("/reports.xlsx")
  public ResponseEntity<byte[]> report(
      @RequestParam int year,
      @RequestParam(required = false) Integer quarter) {
    String period = year + "年" + (quarter == null ? "度" : "第" + quarter + "季度");
    return download(analyticsReportService.generate(year, quarter),
        "鲁东大学采购申报" + period + "统计报告.xlsx", XLSX);
  }

  @GetMapping("/applications/{id}/documents/demand.docx")
  public ResponseEntity<byte[]> demand(@PathVariable String id) {
    return download(documentService.generate(id, LudongPocDocumentService.DocumentType.DEMAND),
        "采购需求表（货物类）.docx", DOCX);
  }

  @GetMapping("/applications/{id}/documents/application.docx")
  public ResponseEntity<byte[]> application(@PathVariable String id) {
    return download(documentService.generate(id, LudongPocDocumentService.DocumentType.APPLICATION),
        "货物类项目采购及招标申请单、受理单.docx", DOCX);
  }

  @GetMapping("/applications/{id}/documents/archive.zip")
  public ResponseEntity<byte[]> archive(@PathVariable String id) {
    return download(documentService.archive(id), "鲁东大学货物类采购申报归档.zip",
        MediaType.parseMediaType("application/zip"));
  }

  private static ResponseEntity<byte[]> download(byte[] bytes, String fileName, MediaType type) {
    String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
    return ResponseEntity.ok()
        .contentType(type)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
        .body(bytes);
  }
}
