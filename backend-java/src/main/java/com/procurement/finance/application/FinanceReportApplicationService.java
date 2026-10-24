package com.procurement.finance.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.FinanceReport;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.infrastructure.FinanceReportRenderer;
import com.procurement.finance.infrastructure.ProcurementAnalyticsReportRenderer;
import com.procurement.buyer.application.BuyerAnalyticsReportQuery;
import java.time.LocalDate;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Service
@Transactional(readOnly = true)
public class FinanceReportApplicationService {
  private final FinanceAccessService access;
  private final InvoiceMapper invoiceMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final BuyerAnalyticsReportQuery analytics;

  public FinanceReportApplicationService(FinanceAccessService access, InvoiceMapper invoiceMapper,
      ThreeWayMatchMapper threeWayMatchMapper,
      BuyerAnalyticsReportQuery analytics) {
    this.access = access;
    this.invoiceMapper = invoiceMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
    this.analytics = analytics;
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

  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  public FinanceReport exportProcurementAnalytics(String format) {
    return exportProcurementAnalytics(format, null, null, null, null);
  }

  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  public FinanceReport exportProcurementAnalytics(String format, LocalDate fromDate, LocalDate toDate,
      String supplierId, String status) {
    TenantAccessGuard.requireTenantId("report APIs");
    access.requireScope("buyer:analytics:read");
    access.requireScope("buyer:report:export");
    if (!"xlsx".equalsIgnoreCase(format) && !"pdf".equalsIgnoreCase(format)) {
      throw new IllegalArgumentException("仅支持 xlsx 或 pdf 导出格式");
    }
    // Another bean's proxied REQUIRES_NEW method owns the repeatable-read snapshot and read permission.
    var result = analytics.procurementAnalytics(fromDate, toDate, supplierId, status);
    boolean pdf = "pdf".equalsIgnoreCase(format);
    return new FinanceReport(pdf ? ProcurementAnalyticsReportRenderer.toPdf(result) : ProcurementAnalyticsReportRenderer.toXlsx(result),
        "procurement-analytics." + (pdf ? "pdf" : "xlsx"), pdf ? FinanceReport.PDF_CONTENT_TYPE : FinanceReport.XLSX_CONTENT_TYPE);
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
