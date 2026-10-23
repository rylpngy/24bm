package com.procurement.finance.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.FinanceReport;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.infrastructure.FinanceReportMapper;
import com.procurement.finance.infrastructure.FinanceReportRenderer;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class FinanceReportApplicationService {
  private final FinanceAccessService access;
  private final InvoiceMapper invoiceMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final FinanceReportMapper reportMapper;

  public FinanceReportApplicationService(FinanceAccessService access, InvoiceMapper invoiceMapper,
      ThreeWayMatchMapper threeWayMatchMapper, FinanceReportMapper reportMapper) {
    this.access = access;
    this.invoiceMapper = invoiceMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
    this.reportMapper = reportMapper;
  }

  // ============ 报表导出(发票清单 / 对账单 / 采购分析)============

  private static String money(BigDecimal v) {
    return v == null ? "" : v.toPlainString();
  }

  private static String orEmpty(String v) {
    return v == null ? "" : v;
  }

  public FinanceReport exportInvoices(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    var scope = access.requireScope("buyer:report:export");
    List<String> headers =
        List.of("发票号", "发票代码", "订单", "供应商", "价税合计", "税率(%)", "开票日期", "付款状态");
    List<List<String>> rows = new ArrayList<>();
    for (Invoice inv : invoiceMapper.listVisible(tenantId, null, null, null, scope)) {
      rows.add(List.of(
          orEmpty(inv.invoiceNo()),
          orEmpty(inv.invoiceCode()),
          orEmpty(inv.orderId()),
          orEmpty(inv.supplierId()),
          money(inv.amount()),
          money(inv.taxRate()),
          inv.invoiceDate() == null ? "" : inv.invoiceDate().toString(),
          orEmpty(inv.paymentStatus())));
    }
    return render("发票清单", "invoices", headers, rows, format);
  }

  public FinanceReport exportReconciliation(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    var scope = access.requireScope("buyer:report:export");
    List<String> headers =
        List.of("发票", "订单", "供应商", "订单金额", "发票金额", "差异金额", "匹配状态", "收货状态", "付款就绪");
    List<List<String>> rows = new ArrayList<>();
    for (ThreeWayMatch m : threeWayMatchMapper.listVisible(tenantId, null, null, null, null, scope)) {
      rows.add(List.of(
          orEmpty(m.invoiceId()),
          orEmpty(m.orderId()),
          orEmpty(m.supplierId()),
          money(m.orderAmount()),
          money(m.invoiceAmount()),
          money(m.varianceAmount()),
          orEmpty(m.matchStatus()),
          orEmpty(m.receiptStatus()),
          orEmpty(m.paymentReadiness())));
    }
    return render("三单匹配对账单", "reconciliation", headers, rows, format);
  }

  // 采购分析:按订单状态汇总订单数与金额(含合计行)。
  public FinanceReport exportProcurementAnalytics(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    access.requireScope("buyer:analytics:read");
    var scope = access.requireScope("buyer:report:export");
    BigDecimal total = BigDecimal.ZERO;
    long totalCount = 0;
    List<String> headers = List.of("订单状态", "订单数", "订单金额合计");
    List<List<String>> rows = new ArrayList<>();
    for (var summary : reportMapper.summarizeOrders(tenantId, scope)) {
      rows.add(List.of(summary.status(), String.valueOf(summary.orderCount()), money(summary.amount())));
      total = total.add(summary.amount());
      totalCount += summary.orderCount();
    }
    rows.add(List.of("合计", String.valueOf(totalCount), money(total)));
    return render("采购分析汇总", "procurement-analytics", headers, rows, format);
  }

  private FinanceReport render(
      String title, String base, List<String> headers, List<List<String>> rows, String format) {
    if (!"pdf".equalsIgnoreCase(format) && !"xlsx".equalsIgnoreCase(format)) {
      throw new IllegalArgumentException("仅支持 xlsx 或 pdf 导出格式");
    }
    if ("pdf".equalsIgnoreCase(format)) {
      return new FinanceReport(
          FinanceReportRenderer.toPdf(title, headers, rows),
          base + ".pdf",
          FinanceReport.PDF_CONTENT_TYPE);
    }
    return new FinanceReport(
        FinanceReportRenderer.toXlsx(title, headers, rows),
        base + ".xlsx",
        FinanceReport.XLSX_CONTENT_TYPE);
  }

}
