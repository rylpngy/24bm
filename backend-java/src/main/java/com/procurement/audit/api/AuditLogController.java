package com.procurement.audit.api;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.api.ApiResponse;
import java.util.Arrays;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/audit-logs")
public class AuditLogController {
  private static final int DEFAULT_LIMIT = 50;

  private final AuditLogApplicationService auditLogApplicationService;

  public AuditLogController(AuditLogApplicationService auditLogApplicationService) {
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @GetMapping
  public ApiResponse<List<AuditLogResponse>> list(
      @RequestParam(defaultValue = "" + DEFAULT_LIMIT) int limit,
      @RequestParam(defaultValue = "") String keyword,
      @RequestParam(defaultValue = "") String targetType,
      @RequestParam(defaultValue = "") String dateFrom,
      @RequestParam(defaultValue = "") String dateTo) {
    return ApiResponse.ok(auditLogApplicationService.listCurrentTenantAuditLogs(
        limit, keyword, targetType, dateFrom, dateTo));
  }

  @GetMapping("/target")
  public ApiResponse<List<AuditLogResponse>> listTargetActions(
      @RequestParam String targetType,
      @RequestParam String targetId,
      @RequestParam(defaultValue = "") String actions,
      @RequestParam(defaultValue = "" + DEFAULT_LIMIT) int limit) {
    List<String> actionList = Arrays.stream(actions.split(","))
        .map(String::trim)
        .filter(action -> !action.isBlank())
        .toList();
    return ApiResponse.ok(auditLogApplicationService.listCurrentTenantTargetActions(
        targetType,
        targetId,
        actionList,
        limit));
  }
}
