package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.procurement.sourcing.application.ProcurementExecutionPolicy;
import org.junit.jupiter.api.Test;

class ProcurementExecutionPolicyTests {
  @Test void cancelledOrderNeedsBilateralEvidenceAndNoRemainingObligations() throws Exception {
    var data=complete();((ObjectNode)data.path("orders").get(0)).put("status","已取消");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).isNotEmpty();
    data.withArray("orderCancellations").addObject().put("id","cancel").put("orderId","o").put("status","accepted").put("createdBy","buyer").put("completedBy","supplier").put("completedAt",java.time.OffsetDateTime.now().minusDays(1).toString()).put("reason","计划调整").put("response","确认取消");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(b->b.contains("财务责任"));
    for(String key:java.util.List.of("receipts","receiptLines","contracts","invoices","payments"))data.withArray(key).removeAll();
    var result=ProcurementExecutionPolicy.evaluate(data);assertThat(result.blockers()).isEmpty();assertThat(result.orderAmount()).isEqualByComparingTo("0");assertThat(result.budgetAmount()).isEqualByComparingTo("150");
  }
  private final ObjectMapper json = new ObjectMapper();

  ObjectNode complete() throws Exception {
    return (ObjectNode) json.readTree("""
        {"rfq":{"id":"r","title":"项目","status":"已定标","awardedSupplierId":"s"},
         "demands":[{"id":"d","title":"需求","budget":150,"status":"已转询价"}],
         "orders":[{"id":"o","amount":100,"status":"已收货"}],
         "orderLines":[{"id":"ol","orderId":"o","quantity":10,"lineAmount":100}],
         "receipts":[{"id":"rec","orderId":"o","receivedQuantity":10,"qualifiedQuantity":10,
                      "inspectionConclusion":"全部合格","disposition":null}],
         "receiptLines":[{"id":"rl","receiptId":"rec","orderLineId":"ol","receivedQuantity":10,"qualifiedQuantity":10}],
         "contracts":[{"id":"c","relatedOrderId":"o","contractName":"合同","amount":100,"status":"已生效","archiveStatus":"未归档"}],
         "invoices":[{"id":"i","orderId":"o","amount":100,"paymentStatus":"已付款"}],
         "payments":[{"id":"p","invoiceId":"i","amount":100,"reversalOf":null}],
         "variances":[],"reconciliations":[],"workflowHistory":[],"legacyApprovals":[]}
        """);
  }

  @Test void completeUsesDemandBudgetAndInvoiceNavigation() throws Exception {
    var result = ProcurementExecutionPolicy.evaluate(complete());
    assertThat(result.blockers()).isEmpty();
    assertThat(result.budgetAmount()).isEqualByComparingTo("150");
    assertThat(result.remainingAmount()).isEqualByComparingTo("0");
    assertThat(result.documents()).anySatisfy(d -> {
      assertThat(d.module()).isEqualTo("invoices");
      assertThat(d.recordId()).isEqualTo("i");
    }).anySatisfy(d -> {
      assertThat(d.module()).isEqualTo("receipts");
      assertThat(d.recordId()).isEqualTo("o");
    });
  }

  @Test void paidWithoutLedgerIsUnknownNotZero() throws Exception {
    var data = complete(); data.withArray("payments").removeAll();
    var result = ProcurementExecutionPolicy.evaluate(data);
    assertThat(result.paidAmount()).isNull();
    assertThat(result.remainingAmount()).isNull();
    assertThat(result.blockers()).anyMatch(s -> s.contains("流水") && s.contains("未知"));
  }

  @Test void reversalAndPerInvoiceShortfallCannotCancelAcrossOrders() throws Exception {
    var data = complete();
    data.withArray("payments").addObject().put("id","rev").put("invoiceId","i").put("amount",-100).put("reversalOf","p");
    var result = ProcurementExecutionPolicy.evaluate(data);
    assertThat(result.paidAmount()).isEqualByComparingTo("0");
    assertThat(result.blockers()).anyMatch(s -> s.contains("付款"));
  }

  @Test void notYetInvoicedOrdersStillHaveAnUnpaidBalance() throws Exception {
    var data=complete(); data.withArray("invoices").removeAll(); data.withArray("payments").removeAll();
    assertThat(ProcurementExecutionPolicy.evaluate(data).remainingAmount()).isEqualByComparingTo("100");
  }

  @Test void partialUnqualifiedAndUnresolvedVarianceAllBlock() throws Exception {
    var data = complete();
    ((ObjectNode) data.withArray("receiptLines").get(0)).put("receivedQuantity",9).put("qualifiedQuantity",8);
    ((ObjectNode) data.withArray("receipts").get(0)).put("inspectionConclusion","部分合格").put("disposition","退货换货");
    data.withArray("variances").addObject().put("id","v").put("status","待处理");
    var result = ProcurementExecutionPolicy.evaluate(data);
    assertThat(result.blockers()).anyMatch(s -> s.contains("收货"));
    assertThat(result.blockers()).anyMatch(s -> s.contains("质检"));
    assertThat(result.blockers()).anyMatch(s -> s.contains("差异"));
  }

  @Test void legacyReceiptWithoutLineEvidenceCannotPretendComplete() throws Exception {
    var data = complete(); data.withArray("receiptLines").removeAll();
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("收货"));
    data.withArray("orderLines").removeAll();
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("数量"));
  }

  @Test void dispositionReviewClosesOnlyItsOwnReceiptAndRetainsOriginalQualityQuantities() throws Exception {
    var data=complete();
    ((ObjectNode)data.withArray("receipts").get(0)).put("qualifiedQuantity",8).put("inspectionConclusion","部分合格").put("disposition","退货换货");
    ((ObjectNode)data.withArray("receiptLines").get(0)).put("qualifiedQuantity",8);
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("质检"));
    var reviews=data.putArray("dispositionReviews");
    var review=reviews.addObject().put("receiptId","other-receipt").put("decision","让步接收")
        .put("reason","Authorized disposition").put("evidenceNo","Review evidence").put("reviewedBy","u").put("reviewedAt","2026-10-24T10:00:00Z");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("质检"));
    review.put("receiptId","rec");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).isEmpty();
    assertThat(data.path("receipts").get(0).path("qualifiedQuantity").asInt()).isEqualTo(8);
    review.put("evidenceNo","");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("质检"));
  }

  @Test void missingAwardOrderContractAndPendingWorkflowBlock() throws Exception {
    var data = complete();
    ((ObjectNode) data.get("rfq")).put("status","报价中");
    data.withArray("contracts").removeAll();
    data.withArray("workflowHistory").addObject().putObject("instance").put("status","processing");
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers())
        .anyMatch(s -> s.contains("定标")).anyMatch(s -> s.contains("合同")).anyMatch(s -> s.contains("审批"));
    data.withArray("orders").removeAll();
    assertThat(ProcurementExecutionPolicy.evaluate(data).blockers()).anyMatch(s -> s.contains("订单"));
  }
}
