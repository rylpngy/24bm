package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.*;
import com.procurement.supplier.application.*;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowBusinessSummary;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class SupplierExportServiceTests {
  final PermissionService permissions = mock(PermissionService.class);
  final BuyerSupplierApplicationService suppliers = mock(BuyerSupplierApplicationService.class);
  final QualificationLedgerService qualifications = mock(QualificationLedgerService.class);
  final SupplierFulfillmentMetricsService metrics = mock(SupplierFulfillmentMetricsService.class);
  final PerformanceTaskApplicationService tasks = mock(PerformanceTaskApplicationService.class);
  final UnifiedWorkflowApplicationService workflows = mock(UnifiedWorkflowApplicationService.class);
  final SupplierExportService service = new SupplierExportService(
      permissions, suppliers, qualifications, metrics, tasks, workflows);

  @BeforeEach void context() {
    TenantContext.set("tenant", null, "buyer");
    var empty = new QualificationLedgerPage(List.of(), 0, 1, 100);
    when(qualifications.list(null, "all", 1, 100))
        .thenReturn(empty);
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @ParameterizedTest
  @ValueSource(strings = {"profiles", "admissions", "qualifications", "evaluations", "remediations", "exits", "admission-history", "exit-history"})
  void emptyExportRetainsChineseHeaders(String kind) throws Exception {
    try (var workbook = workbook(service.export(kind, "2026-Q1"))) {
      var sheet = workbook.getSheetAt(0);
      assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(1);
      assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("关系编号");
    }
    verify(permissions).require("buyer:supplier:read");
    verify(permissions, never()).require("buyer:supplier:manage");
  }

  @Test void rejectsInvalidKindAndMissingOrNonCanonicalPeriodBeforeQuery() {
    for (String period : new String[]{null, "", "2026-q1", " 2026-Q1", "2026-13"}) {
      assertThatThrownBy(() -> service.export("evaluations", period))
          .isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> service.export("other", null)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(suppliers, qualifications, metrics, tasks, workflows);
  }

  @Test void requiresAuthenticatedTenantAndReadPermission() {
    TenantContext.clear();
    assertThatThrownBy(() -> service.export("profiles", null)).isInstanceOf(IllegalStateException.class);
    TenantContext.set("tenant", null, "buyer");
    doThrow(new PermissionDeniedException("denied")).when(permissions).require("buyer:supplier:read");
    assertThatThrownBy(() -> service.export("profiles", null)).hasMessage("denied");
    verifyNoInteractions(suppliers, qualifications, metrics, tasks, workflows);
  }

  @Test void profileUsesSafeStringsAndExcludesBankFields() throws Exception {
    var source = List.of(relation("=HYPERLINK(\"evil\")"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    try (var workbook = workbook(service.export("profiles", null))) {
      var sheet = workbook.getSheetAt(0);
      assertThat(sheet.getRow(1).getCell(2).getCellType()).isEqualTo(CellType.STRING);
      assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).startsWith("=HYPERLINK");
      for (var row : sheet) for (var cell : row) {
        assertThat(cell.getStringCellValue()).doesNotContain("SECRET_BANK", "SECRET_ACCOUNT", "银行");
      }
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"=1+1", "+cmd", "-cmd", "@SUM(A1)", "\t=1+1"})
  void formulaLikeNamesRemainLiteralStrings(String name) throws Exception {
    var source = List.of(relation(name));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    try (var workbook = workbook(service.export("profiles", null))) {
      var cell = workbook.getSheetAt(0).getRow(1).getCell(2);
      assertThat(cell.getCellType()).isEqualTo(CellType.STRING);
      assertThat(cell.getStringCellValue()).isEqualTo(name);
    }
  }

  @Test void evaluationsDelegateCanonicalPeriodToScopedComparisonAndKeepMissingScoresBlank() throws Exception {
    var source = List.of(
        new SupplierPerformanceComparisonResponse("r", "s", "name", "已准入", "A", null,
            null, null, null, null, null, null, null, 0, 0, null, 0, 0, null, 0));
    when(metrics.performanceComparison("2026-Q1")).thenReturn(source);
    try (var workbook = workbook(service.export("evaluations", "2026-Q1"))) {
      assertThat(workbook.getSheetAt(0).getRow(1).getCell(5).getStringCellValue()).isEmpty();
    }
    verify(metrics).performanceComparison("2026-Q1");
    verifyNoInteractions(suppliers, tasks, workflows);
  }

  @Test void rejectsOversizedListsAndQualificationTotalsWithoutTruncation() {
    var source = Collections.nCopies(5001, relation("name"));
    var oversized = new QualificationLedgerPage(List.of(), 5001, 1, 100);
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    assertThatThrownBy(() -> service.export("profiles", null)).hasMessageContaining("5000");
    when(qualifications.list(null, "all", 1, 100))
        .thenReturn(oversized);
    assertThatThrownBy(() -> service.export("qualifications", null)).hasMessageContaining("5000");
    verify(qualifications, never()).list(null, "all", 2, 100);
  }

  @Test void qualificationsReadAllPages() throws Exception {
    var row = new QualificationLedgerRow("r", "name", "已准入", "q", "证照", "no", null, "unknown");
    var first = new QualificationLedgerPage(Collections.nCopies(100, row), 101, 1, 100);
    var second = new QualificationLedgerPage(List.of(row), 101, 2, 100);
    when(qualifications.list(null, "all", 1, 100))
        .thenReturn(first);
    when(qualifications.list(null, "all", 2, 100))
        .thenReturn(second);
    try (var workbook = workbook(service.export("qualifications", null))) {
      assertThat(workbook.getSheetAt(0).getPhysicalNumberOfRows()).isEqualTo(102);
    }
  }

  @Test void workflowExportsRequireSourcePermissionEvenWhenEmpty() {
    doThrow(new PermissionDeniedException("workflow denied")).when(permissions).require("buyer:workflow:read");
    assertThatThrownBy(() -> service.export("admissions", null)).hasMessage("workflow denied");
    assertThatThrownBy(() -> service.export("exits", null)).hasMessage("workflow denied");
    verifyNoInteractions(workflows);
  }

  @ParameterizedTest
  @ValueSource(strings = {"admissions", "exits"})
  void workflowScopeDenialFiltersOnlyForbiddenRow(String kind) throws Exception {
    var forbidden = relation("forbidden-relation", "FORBIDDEN_SUPPLIER");
    var source = List.of(forbidden, relation("visible"));
    var visible = new WorkflowBusinessSummary("visible-workflow", "processing", null, null, null, null);
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    String businessType = "exits".equals(kind) ? "buyer_supplier_exit" : "buyer_supplier_admission";
    when(workflows.getCurrentTenantBusinessSummary(businessType, "forbidden-relation"))
        .thenThrow(new PermissionDeniedException("scope denied"));
    when(workflows.getCurrentTenantBusinessSummary(businessType, "r")).thenReturn(visible);
    try (var workbook = workbook(service.export(kind, null))) {
      var sheet = workbook.getSheetAt(0);
      assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(2);
      assertThat(sheet.getRow(1).getCell(2).getStringCellValue()).isEqualTo("visible");
      assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo("visible-workflow");
      for (var row : sheet) for (var cell : row) {
        assertThat(cell.getStringCellValue()).doesNotContain("forbidden-relation", "FORBIDDEN_SUPPLIER");
      }
    }
    verify(permissions).require("buyer:workflow:read");
  }

  @Test void workflowNonPermissionFailureIsNotSwallowed() {
    var source = List.of(relation("name"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(workflows.getCurrentTenantBusinessSummary("buyer_supplier_admission", "r"))
        .thenThrow(new IllegalStateException("source unavailable"));
    assertThatThrownBy(() -> service.export("admissions", null)).hasMessage("source unavailable");
  }

  @Test void workflowExportsOnlyLatestMetadataAndRealDates() throws Exception {
    var source = List.of(relation("name"));
    var summary = new WorkflowBusinessSummary("wf", "processing", "发起人",
        OffsetDateTime.parse("2026-10-01T02:00:45Z"), null, null);
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(workflows.getCurrentTenantBusinessSummary("buyer_supplier_exit", "r")).thenReturn(summary);
    try (var workbook = workbook(service.export("exits", null))) {
      var row = workbook.getSheetAt(0).getRow(1);
      assertThat(row.getCell(5).getStringCellValue()).isEqualTo("审批中");
      assertThat(row.getCell(7).getStringCellValue()).isEqualTo("2026-10-01 10:00");
      assertThat(row.getCell(9).getStringCellValue()).isEmpty();
    }
    verify(workflows, never()).getCurrentTenantBusinessHistory(any(), any());
    verify(workflows, never()).listCurrentTenantInstances(any(), anyInt());
  }

  @ParameterizedTest
  @CsvSource({"processing,审批中", "approved,已通过", "rejected,已驳回", "cancelled,已取消", "future_state,future_state"})
  void workflowStatusesAndCompletionTimesAreFormatted(String status, String label) throws Exception {
    var source = List.of(relation("name"));
    var summary = new WorkflowBusinessSummary("wf", status, "发起人",
        OffsetDateTime.parse("2026-10-01T23:15:59-04:00"), "完成人",
        OffsetDateTime.parse("2026-10-03T01:02:03Z"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(workflows.getCurrentTenantBusinessSummary("buyer_supplier_admission", "r")).thenReturn(summary);
    try (var workbook = workbook(service.export("admissions", null))) {
      var row = workbook.getSheetAt(0).getRow(1);
      assertThat(row.getCell(5).getStringCellValue()).isEqualTo(label);
      assertThat(row.getCell(7).getStringCellValue()).isEqualTo("2026-10-02 11:15");
      assertThat(row.getCell(9).getStringCellValue()).isEqualTo("2026-10-03 09:02");
    }
  }

  @ParameterizedTest
  @CsvSource({"remediation_requested,待整改", "remediation_submitted,待复核", "closed,已关闭"})
  void remediationStatusesAreChineseAndDueDateRemainsDateOnly(String status, String label) throws Exception {
    var source = List.of(relation("name"));
    var dueDate = LocalDate.now().plusDays(7);
    var sourceTasks = List.of(new PerformanceTaskResponse("t", "r", "name", "buyer", "2026-Q1", "u", "负责人",
        dueDate, status, "e", BigDecimal.TEN, null, null, List.of(), 1));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(tasks.listBuyer("r")).thenReturn(sourceTasks);
    try (var workbook = workbook(service.export("remediations", null))) {
      var row = workbook.getSheetAt(0).getRow(1);
      assertThat(row.getCell(5).getStringCellValue()).isEqualTo(label);
      assertThat(row.getCell(7).getStringCellValue()).isEqualTo(dueDate.toString());
    }
  }

  @Test void performanceEvaluationTimeIsFormattedInShanghai() throws Exception {
    var source = List.of(new SupplierPerformanceComparisonResponse("r", "s", "name", "已准入", "A", null,
        "e", BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN,
        OffsetDateTime.parse("2026-03-31T20:30:59Z"), 0, 0, null, 0, 0, null, 0));
    when(metrics.performanceComparison("2026-Q1")).thenReturn(source);
    try (var workbook = workbook(service.export("evaluations", "2026-Q1"))) {
      assertThat(workbook.getSheetAt(0).getRow(1).getCell(10).getStringCellValue())
          .isEqualTo("2026-04-01 04:30");
    }
  }

  @Test void noWorkflowInstanceDoesNotInventAdmissionStatusOrDates() throws Exception {
    var source = List.of(relation("name"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    try (var workbook = workbook(service.export("admissions", null))) {
      var row = workbook.getSheetAt(0).getRow(1);
      for (int column = 4; column <= 9; column++) {
        assertThat(row.getCell(column).getStringCellValue()).isEmpty();
      }
    }
  }

  @Test void incompleteQualificationPageIsRejectedInsteadOfTruncated() {
    var incomplete = new QualificationLedgerPage(List.of(), 1, 1, 100);
    when(qualifications.list(null, "all", 1, 100))
        .thenReturn(incomplete);
    assertThatThrownBy(() -> service.export("qualifications", null)).hasMessageContaining("读取不完整");
  }

  @Test void sourceTaskPermissionDenialIsPropagated() {
    var source = List.of(relation("name"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(tasks.listBuyer("r")).thenThrow(new PermissionDeniedException("task denied"));
    assertThatThrownBy(() -> service.export("remediations", null)).hasMessage("task denied");
  }

  @Test void cumulativeRemediationRowsAreBoundedAcrossRelations() {
    var source = List.of(relation("one"), relation("two"));
    var sourceTasks = Collections.nCopies(2501, task("closed"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(tasks.listBuyer("r")).thenReturn(sourceTasks);
    assertThatThrownBy(() -> service.export("remediations", null)).hasMessageContaining("5000");
  }

  @Test void oversizedPerformanceComparisonIsRejected() {
    when(metrics.performanceComparison("2026-Q1")).thenReturn(Collections.nCopies(5001, null));
    assertThatThrownBy(() -> service.export("evaluations", "2026-Q1")).hasMessageContaining("5000");
  }

  @Test void evaluationSourceDenialIsPropagated() {
    when(metrics.performanceComparison("2026-Q1"))
        .thenThrow(new PermissionDeniedException("scope denied"));
    assertThatThrownBy(() -> service.export("evaluations", "2026-Q1")).hasMessage("scope denied");
  }

  @Test void historicalExportIncludesRejectedAndResubmittedAttemptsWithSafeOpinions() throws Exception {
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(List.of(relation("name")));
    var now = OffsetDateTime.now();
    when(workflows.businessAuditEntries("buyer_supplier_admission", "r")).thenReturn(List.of(
        new com.procurement.workflow.application.WorkflowAuditEntry("old", "v1", "rejected", "发起人", now, "审核员", now, "部门审核", "rejected", "审核员", now, "=意见"),
        new com.procurement.workflow.application.WorkflowAuditEntry("new", "v2", "approved", "发起人", now, "审核员", now, "部门审核", "approved", "审核员", now, "同意")));
    try (var workbook = workbook(service.export("admission-history", null))) {
      var sheet = workbook.getSheetAt(0);
      assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(3);
      assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo("old");
      assertThat(sheet.getRow(2).getCell(4).getStringCellValue()).isEqualTo("new");
      assertThat(sheet.getRow(1).getCell(15).getCellType()).isEqualTo(CellType.STRING);
      assertThat(sheet.getRow(1).getCell(15).getStringCellValue()).isEqualTo("=意见");
    }
    verify(permissions).require("buyer:workflow:read");
  }

  @Test void remediationsExcludeUnrequestedTasksAndFreeText() throws Exception {
    var source = List.of(relation("name"));
    var sourceTasks = List.of(task("assigned"), task("remediation_submitted"));
    when(suppliers.listCurrentTenantSuppliers()).thenReturn(source);
    when(tasks.listBuyer("r")).thenReturn(sourceTasks);
    try (var workbook = workbook(service.export("remediations", null))) {
      var sheet = workbook.getSheetAt(0);
      assertThat(sheet.getPhysicalNumberOfRows()).isEqualTo(2);
      for (var row : sheet) for (var cell : row) {
        assertThat(cell.getStringCellValue()).doesNotContain("PRIVATE_TEXT");
      }
    }
  }

  private PerformanceTaskResponse task(String status) {
    return new PerformanceTaskResponse("t", "r", "name", "buyer", "2026-Q1", "u", "负责人",
        null, status, "e", BigDecimal.TEN, "PRIVATE_TEXT", "PRIVATE_TEXT", List.of(), 1);
  }
  private BuyerSupplierResponse relation(String name) {
    return relation("r", name);
  }
  private BuyerSupplierResponse relation(String id, String name) {
    return new BuyerSupplierResponse(id, "tenant", "s", name, "已准入", "A", List.of("设备"),
        null, null, null, "credit", null, null, null, null, null, "SECRET_BANK", "SECRET_ACCOUNT");
  }
  private XSSFWorkbook workbook(SupplierExportService.Export result) throws Exception {
    return new XSSFWorkbook(new ByteArrayInputStream(result.content()));
  }
}
