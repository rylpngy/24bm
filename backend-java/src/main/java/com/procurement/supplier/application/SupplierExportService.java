package com.procurement.supplier.application;

import com.procurement.common.excel.ExcelSheets;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.QualificationLedgerPage;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.domain.SupplierEvaluationPeriod;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowBusinessSummary;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Export projections reuse the source services, including their permission and data-scope checks. */
@Service
public class SupplierExportService {
  private static final int MAX_ROWS = 5000;
  private static final int PAGE_SIZE = 100;
  private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
  private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
  private static final Set<String> KINDS = Set.of(
      "profiles", "admissions", "qualifications", "evaluations", "remediations", "exits");
  private final PermissionService permissions;
  private final BuyerSupplierApplicationService suppliers;
  private final QualificationLedgerService qualifications;
  private final SupplierFulfillmentMetricsService metrics;
  private final PerformanceTaskApplicationService tasks;
  private final UnifiedWorkflowApplicationService workflows;

  public SupplierExportService(PermissionService permissions, BuyerSupplierApplicationService suppliers,
      QualificationLedgerService qualifications, SupplierFulfillmentMetricsService metrics,
      PerformanceTaskApplicationService tasks, UnifiedWorkflowApplicationService workflows) {
    this.permissions = permissions;
    this.suppliers = suppliers;
    this.qualifications = qualifications;
    this.metrics = metrics;
    this.tasks = tasks;
    this.workflows = workflows;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Export export(String kind, String period) {
    TenantAccessGuard.requireTenantId("supplier export");
    TenantAccessGuard.requireUserId("supplier export");
    permissions.require("buyer:supplier:read");
    if (kind == null || !KINDS.contains(kind)) {
      throw new IllegalArgumentException("导出类型须为 profiles、admissions、qualifications、evaluations、remediations 或 exits");
    }
    if ("evaluations".equals(kind)
        && !Objects.equals(period, SupplierEvaluationPeriod.normalize(period))) {
      throw new IllegalArgumentException("同期绩效导出须提供规范周期 YYYY、YYYY-Qn 或 YYYY-MM");
    }
    return switch (kind) {
      case "profiles" -> profiles();
      case "admissions" -> workflowLedger(false);
      case "qualifications" -> qualifications();
      case "evaluations" -> evaluations(period);
      case "remediations" -> remediations();
      case "exits" -> workflowLedger(true);
      default -> throw new IllegalArgumentException("不支持的导出类型");
    };
  }

  private Export profiles() {
    var rows = new ArrayList<List<String>>();
    for (var supplier : relations()) {
      add(rows, supplier.id(), supplier.supplierId(), supplier.supplierName(), supplier.status(),
          supplier.level(), supplier.categories() == null ? null : String.join("、", supplier.categories()),
          supplier.creditCode(), supplier.cooperationTier(), supplier.performanceScore(), supplier.lastEvaluationScore());
    }
    return excel("供应商档案", List.of("关系编号", "供应商编号", "供应商名称", "关系状态", "等级",
        "分类", "统一社会信用代码", "合作层级", "绩效评分", "最近考核分"), rows);
  }

  private Export qualifications() {
    var rows = new ArrayList<List<String>>();
    QualificationLedgerPage first = qualifications.list(null, "all", 1, PAGE_SIZE);
    requireWithinLimit(first.total());
    long total = first.total();
    for (int page = 1; page <= Math.max(1, (total + PAGE_SIZE - 1) / PAGE_SIZE); page++) {
      var result = page == 1 ? first : qualifications.list(null, "all", page, PAGE_SIZE);
      int expectedSize = (int) Math.min(PAGE_SIZE, Math.max(0, total - (long) (page - 1) * PAGE_SIZE));
      if (result.total() != total || result.page() != page || result.items().size() != expectedSize) {
        throw new IllegalArgumentException("资质台账读取不完整，请刷新后重试，未生成截断文件");
      }
      for (var qualification : result.items()) {
        add(rows, qualification.relationId(), qualification.supplierName(), qualification.relationStatus(),
            qualification.qualificationId(), qualification.qualificationType(), qualification.certificateNo(),
            qualification.expiresAt(), qualification.expiryState());
      }
    }
    return excel("供应商资质台账", List.of("关系编号", "供应商名称", "关系状态", "资质编号", "资质类型",
        "证书编号", "到期日期", "有效期状态"), rows);
  }

  private Export evaluations(String period) {
    var comparison = metrics.performanceComparison(period);
    requireWithinLimit(comparison.size());
    var rows = new ArrayList<List<String>>();
    for (var item : comparison) {
      add(rows, item.relationId(), item.supplierId(), item.supplierName(), period,
          item.evaluationId(), item.qualityScore(), item.deliveryScore(), item.priceScore(), item.serviceScore(),
          item.totalScore(), item.evaluatedAt(), item.status(), item.level(), item.cooperationTier(),
          item.receiptCount(), item.scheduledReceiptCount(), item.onTimeCount(), item.onTimeRate(),
          item.totalReceived(), item.totalQualified(), item.qualifiedRate());
    }
    return excel("供应商同期绩效_" + period, List.of("关系编号", "供应商编号", "供应商名称", "考核周期",
        "考核编号", "质量评分", "交付评分", "价格评分", "服务评分", "综合评分", "考核时间", "关系状态",
        "等级", "合作层级", "收货次数", "约定交期收货次数", "准时次数", "准时率(%)", "收货数量",
        "合格数量", "合格率(%)"), rows);
  }

  private Export remediations() {
    var rows = new ArrayList<List<String>>();
    for (var supplier : relations()) {
      var sourceTasks = tasks.listBuyer(supplier.id());
      requireWithinLimit(sourceTasks.size());
      for (var task : sourceTasks) {
        if (!Set.of("remediation_requested", "remediation_submitted", "closed").contains(task.status())) continue;
        add(rows, supplier.id(), supplier.supplierId(), supplier.supplierName(), task.id(), task.period(),
            statusLabel(task.status()), task.assigneeName(), task.dueDate(), task.evaluationId(), task.totalScore(), task.version());
      }
    }
    return excel("供应商整改台账", List.of("关系编号", "供应商编号", "供应商名称", "整改任务编号", "考核周期",
        "任务状态", "负责人", "截止日期", "考核编号", "综合评分", "版本号"), rows);
  }

  private Export workflowLedger(boolean exit) {
    permissions.require("buyer:workflow:read");
    String businessType = exit ? "buyer_supplier_exit" : "buyer_supplier_admission";
    var rows = new ArrayList<List<String>>();
    for (var supplier : relations()) {
      // The application summary preserves the latest instance's permissions and DataScope, without a list cap.
      WorkflowBusinessSummary history;
      try {
        history = workflows.getCurrentTenantBusinessSummary(businessType, supplier.id());
      } catch (PermissionDeniedException denied) {
        // Global workflow read was checked above; omit instances outside the user's DataScope.
        continue;
      }
      if (exit && history == null
          && !BuyerSupplierRelationStatus.IN_EXIT_APPROVAL.equals(supplier.status())
          && !BuyerSupplierRelationStatus.EXITED.equals(supplier.status())) continue;
      add(rows, supplier.id(), supplier.supplierId(), supplier.supplierName(), supplier.status(),
          history == null ? null : history.id(), history == null ? null : statusLabel(history.status()),
          history == null ? null : history.initiatorName(), history == null ? null : history.createdAt(),
          history == null ? null : history.completedByName(), history == null ? null : history.completedAt());
    }
    return excel(exit ? "供应商退出台账" : "供应商准入台账", List.of("关系编号", "供应商编号", "供应商名称",
        "当前关系状态", "最新审批实例编号", "最新审批状态", "发起人", "发起时间", "完成人", "完成时间"), rows);
  }

  private List<BuyerSupplierResponse> relations() {
    var result = suppliers.listCurrentTenantSuppliers();
    requireWithinLimit(result.size());
    return result;
  }

  private static void requireWithinLimit(long size) {
    if (size > MAX_ROWS) {
      throw new IllegalArgumentException("单次供应商导出最多 " + MAX_ROWS + " 行，源台账超限，未生成截断文件");
    }
  }

  private static void add(List<List<String>> rows, Object... values) {
    requireWithinLimit((long) rows.size() + 1);
    rows.add(Arrays.stream(values).map(SupplierExportService::format).toList());
  }

  private static String format(Object value) {
    if (value == null) return "";
    if (value instanceof OffsetDateTime dateTime) {
      return DATE_TIME.format(dateTime.atZoneSameInstant(SHANGHAI));
    }
    if (value instanceof LocalDate date) return DateTimeFormatter.ISO_LOCAL_DATE.format(date);
    return value.toString();
  }

  private static String statusLabel(String status) {
    if (status == null) return null;
    return switch (status) {
      case "assigned" -> "待考核";
      case "evaluated" -> "已考核";
      case "remediation_requested" -> "待整改";
      case "remediation_submitted" -> "待复核";
      case "closed" -> "已关闭";
      case "processing" -> "审批中";
      case "approved" -> "已通过";
      case "rejected" -> "已驳回";
      case "cancelled" -> "已取消";
      default -> status;
    };
  }

  private static Export excel(String name, List<String> headers, List<List<String>> rows) {
    // ExcelSheets writes STRING cells even for values beginning with '=', '+', '-', or '@'.
    return new Export(name + ".xlsx", ExcelSheets.template("供应商台账", headers, rows));
  }

  public record Export(String fileName, byte[] content) {}
}
