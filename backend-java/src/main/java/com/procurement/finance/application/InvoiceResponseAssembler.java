package com.procurement.finance.application;

import com.procurement.finance.api.InvoiceLineItemResponse;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.Receipt;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

final class InvoiceResponseAssembler {
  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
  private static final long PAYMENT_DUE_DAYS = 30;

  private InvoiceResponseAssembler() {
  }

  // 不带行项的重载(付款上下文等无需展示发票明细的场景)。
  static InvoiceResponse from(Invoice invoice, PurchaseOrder order, Receipt receipt) {
    return from(invoice, order, receipt, List.of());
  }

  static InvoiceResponse from(
      Invoice invoice,
      PurchaseOrder order,
      Receipt receipt,
      List<InvoiceLineItemResponse> lineItems) {
    return from(invoice, order, receipt, lineItems, null);
  }

  static InvoiceResponse from(Invoice invoice, PurchaseOrder order, Receipt receipt,
      List<InvoiceLineItemResponse> lineItems, String blockingReason) {
    LocalDate dueDate = invoice.createdAt()
        .atZoneSameInstant(BUSINESS_ZONE)
        .toLocalDate()
        .plusDays(PAYMENT_DUE_DAYS);
    LocalDate today = LocalDate.now(BUSINESS_ZONE);
    boolean overdue = !InvoicePaymentStatus.PAID.equals(invoice.paymentStatus()) && today.isAfter(dueDate);
    long overdueDays = overdue ? ChronoUnit.DAYS.between(dueDate, today) : 0;
    BigDecimal orderAmount = order == null ? null : order.amount();
    BigDecimal varianceAmount = orderAmount == null ? null : invoice.amount().subtract(orderAmount);
    String receiptStatus = order == null
        ? "订单待同步"
        : ("已收货".equals(order.status()) || "已完成".equals(order.status()) ? "已收货" : "待收货");
    String reconciliationStatus = blockingReason == null
        ? toReconciliationStatus(orderAmount, varianceAmount, receiptStatus) : "履约待核验";
    boolean checkedInstallment = blockingReason == null && orderAmount != null && invoice.amount().signum()>0
        && invoice.amount().compareTo(orderAmount)<0 && lineItems!=null && !lineItems.isEmpty()
        && lineItems.stream().allMatch(l->l.quantity()!=null && l.quantity().signum()>0 && l.unitPrice()!=null && l.lineAmount()!=null
          && l.quantity().multiply(l.unitPrice()).setScale(2,java.math.RoundingMode.HALF_UP).compareTo(l.lineAmount())==0)
        && lineItems.stream().map(InvoiceLineItemResponse::lineAmount).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(invoice.amount())==0;
    if(checkedInstallment){varianceAmount=BigDecimal.ZERO;reconciliationStatus="已收货".equals(receiptStatus)?"分次开票已核对":"待收货";}
    String reconciliationStage = toReconciliationStage(invoice.paymentStatus(), reconciliationStatus);
    String nextReconciliationAction = toNextReconciliationAction(reconciliationStage);
    boolean settled=order!=null&&"已清算".equals(order.status());
    boolean settling=order!=null&&java.util.Set.of("清算协商中","待清算").contains(order.status());
    if(settling){reconciliationStatus="合同清算中";reconciliationStage="合同清算中";nextReconciliationAction="原始发票与付款已冻结，请至订单清算台账办理";}
    if(settled){overdue=false;overdueDays=0;receiptStatus="按清算结果归档";reconciliationStatus="按清算结果归档";reconciliationStage="已清算";nextReconciliationAction="原始票面额留档，请至订单清算台账查看调账凭证及实际净结算额";}
    if(settled)varianceAmount=null;

    // 价税合计(amount)与税率推导税额与不含税金额：税额 = 价税合计 × 税率 / (100 + 税率)。
    BigDecimal taxRate = invoice.taxRate() == null ? BigDecimal.ZERO : invoice.taxRate();
    BigDecimal taxAmount = invoice.amount()
        .multiply(taxRate)
        .divide(taxRate.add(new BigDecimal("100")), 2, java.math.RoundingMode.HALF_UP);
    BigDecimal netAmount = invoice.amount().subtract(taxAmount);

    // 数量维度的三单匹配：从收货单取收货/合格数量，推导合格率与数量匹配结论。
    Integer receivedQuantity = receipt == null ? null : receipt.receivedQuantity();
    Integer qualifiedQuantity = receipt == null ? null : receipt.qualifiedQuantity();
    Integer qualifiedRate =
        receivedQuantity != null && receivedQuantity > 0 && qualifiedQuantity != null
            ? Math.round(qualifiedQuantity * 100f / receivedQuantity)
            : null;
    String quantityMatchStatus;
    if (receipt == null || receivedQuantity == null || receivedQuantity == 0) {
      quantityMatchStatus = "待收货";
    } else if (qualifiedQuantity != null && qualifiedQuantity.equals(receivedQuantity)) {
      quantityMatchStatus = "数量全部合格";
    } else {
      quantityMatchStatus = "存在不合格";
    }

    return new InvoiceResponse(
        invoice.id(),
        invoice.tenantId(),
        invoice.supplierId(),
        invoice.orderId(),
        invoice.amount(),
        invoice.invoiceNo(),
        settled?"已清算":settling?"合同清算中":invoice.paymentStatus(),
        invoice.reconciliationNote(),
        dueDate,
        overdue,
        overdueDays,
        orderAmount,
        varianceAmount,
        receiptStatus,
        reconciliationStatus,
        "REC-" + invoice.id(),
        reconciliationStage,
        nextReconciliationAction,
        invoice.createdAt(),
        invoice.updatedAt(),
        invoice.invoiceCode(),
        invoice.invoiceDate(),
        taxRate,
        taxAmount,
        netAmount,
        receivedQuantity,
        qualifiedQuantity,
        qualifiedRate,
        quantityMatchStatus,
        lineItems == null ? List.of() : lineItems);
  }

  private static String toReconciliationStatus(
      BigDecimal orderAmount,
      BigDecimal varianceAmount,
      String receiptStatus) {
    if (orderAmount == null || varianceAmount == null) {
      return "订单待同步";
    }
    if (varianceAmount.compareTo(BigDecimal.ZERO) != 0) {
      return "金额差异";
    }
    if (!"已收货".equals(receiptStatus)) {
      return "待收货";
    }
    return "三单一致";
  }

  private static String toReconciliationStage(String paymentStatus, String reconciliationStatus) {
    if ("金额差异".equals(reconciliationStatus) || "履约待核验".equals(reconciliationStatus)) {
      return "差异处理中";
    }
    if ("待收货".equals(reconciliationStatus) || "订单待同步".equals(reconciliationStatus)) {
      return reconciliationStatus;
    }
    if (InvoicePaymentStatus.PAID.equals(paymentStatus)) {
      return "已完成";
    }
    return "待付款";
  }

  private static String toNextReconciliationAction(String reconciliationStage) {
    return switch (reconciliationStage) {
      case "已完成" -> "归档对账";
      case "待付款" -> "登记付款";
      case "差异处理中" -> "处理差异";
      case "待收货" -> "等待收货";
      default -> "同步订单";
    };
  }
}
