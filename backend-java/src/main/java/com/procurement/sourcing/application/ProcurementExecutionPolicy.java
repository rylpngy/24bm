package com.procurement.sourcing.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.procurement.sourcing.api.ProcurementExecutionResponse.Document;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;

/** Evidence-based closeout checks; status labels alone never establish payment or receipt completeness. */
public final class ProcurementExecutionPolicy {
  private ProcurementExecutionPolicy() {}
  public record Evaluation(List<Document> documents, BigDecimal budgetAmount, BigDecimal orderAmount,
      BigDecimal invoicedAmount, BigDecimal paidAmount, BigDecimal remainingAmount, List<String> blockers) {}

  public static Evaluation evaluate(JsonNode data) {
    List<String> blockers = new ArrayList<>();
    List<Document> documents = new ArrayList<>();
    for(var c:data.path("fundingChanges")){
      if("project_plan".equals(text(c,"kind"))&&"submitted".equals(text(c,"status")))blockers.add("项目资金分摊审批中，暂不能归档");
      if("approved".equals(text(c,"status"))&&list(data,"workflowHistory").stream().noneMatch(h->text(h.path("instance"),"id").equals(text(c,"workflowInstanceId"))&&"approved".equals(text(h.path("instance"),"status"))))blockers.add("专项资金缺少对应独立审批证据");
    }
    if(!list(data,"fundingPlans").isEmpty())for(var payment:data.path("payments")){
      var funding=matching(data,"fundingPayments","entryId",text(payment,"id"));
      if(funding.isEmpty()||sum(funding,"amount").compareTo(amount(payment,"amount"))!=0)blockers.add("付款 "+text(payment,"id")+" 缺少完整资金来源归属");
    }
    for(var correction:data.path("frozenPaymentCorrections")) {
      if("submitted".equals(text(correction,"status")))blockers.add("存在跨年冻结付款更正审批，请先完成更正办理");
      if("approved".equals(text(correction,"status"))) {
        boolean workflow=list(data,"workflowHistory").stream().anyMatch(h->text(h.path("instance"),"id").equals(text(correction,"workflowInstanceId"))&&"approved".equals(text(h.path("instance"),"status")));
        boolean reversal=list(data,"payments").stream().anyMatch(p->text(p,"id").equals(text(correction,"reversal_id"))&&text(p,"reversalOf").equals(text(correction,"entry_id"))&&amount(p,"amount").compareTo(amount(correction,"amount").negate())==0&&!text(p,"evidenceNo").isBlank());
        if(!workflow||!reversal)blockers.add("跨年冻结付款更正缺少审批或反向资金凭据");
      }
    }
    var rfq = data.path("rfq");
    if (!"已定标".equals(text(rfq,"status")) || text(rfq,"awardedSupplierId").isBlank()) blockers.add("采购项目尚未完成定标");
    for (var d : data.path("demands")) documents.add(doc(d,"需求：" + text(d,"title"),"status","budget","demands","id"));
    documents.add(new Document(text(rfq,"id"),"定标：" + text(rfq,"title"),text(rfq,"status"),null,"rfqs",text(rfq,"id")));
    if (list(data,"orders").isEmpty()) blockers.add("尚无采购订单");
    var cancelled = new java.util.HashSet<String>();
    var settled = new java.util.HashSet<String>();
    BigDecimal settlementTotal=BigDecimal.ZERO,settlementInvoices=BigDecimal.ZERO;
    BigDecimal paid = BigDecimal.ZERO;
    boolean unknownPaid = false;
    for (var order : data.path("orders")) {
      String id = text(order,"id");
      var clearing=matching(data,"orderSettlements","orderId",id).stream().filter(s->"settled".equals(text(s,"status"))).toList();
      if("已清算".equals(text(order,"status"))&&clearing.size()==1){
        var s=clearing.get(0);var proof=matching(data,"settlementEvidence","settlementId",text(s,"id"));
        BigDecimal net=amount(s,"initialPaid");for(var p:proof)if("payment".equals(text(p,"kind")))net=net.add(amount(p,"amount"));else if("refund".equals(text(p,"kind")))net=net.subtract(amount(p,"amount"));
        boolean approved=list(data,"workflowHistory").stream().anyMatch(h->text(h.path("instance"),"id").equals(text(s,"workflowInstanceId"))&&"approved".equals(text(h.path("instance"),"status")));
        if(!approved||text(s,"supplierActor").isBlank()||text(s,"completedBy").isBlank()||text(s,"completedAt").isBlank()||net.compareTo(amount(s,"finalAmount"))!=0)blockers.add("订单 "+id+" 清算审批、确认或净付款证据不完整");
        if(s.path("snapshot").path("invoicePlan").isArray()) {
          if(!com.procurement.order.application.OrderSettlementAllocationPolicy.archiveComplete(s,proof))blockers.add("订单 "+id+" 逐票清算或凭证核验不完整");
        } else if(amount(s,"goodsAmount").signum()>0&&proof.stream().noneMatch(p->"invoice".equals(text(p,"kind"))&&amount(p,"amount").compareTo(amount(s,"goodsAmount"))==0))blockers.add("订单 "+id+" 缺少最终结算发票凭证");
        settled.add(id);settlementTotal=settlementTotal.add(amount(s,"finalAmount"));settlementInvoices=settlementInvoices.add(amount(s,"goodsAmount"));paid=paid.add(net);
        documents.add(doc(order,"清算订单（原金额留档）："+id,"status","amount","orders","id"));documents.add(new Document(text(s,"id"),"合同解除及清算："+id,"已清算",amount(s,"finalAmount"),"orders",id));
        for(var c:matching(data,"contracts","relatedOrderId",id))documents.add(doc(c,"合同原始记录："+text(c,"contractName"),"status","amount","contracts","id"));
        for(var i:matching(data,"invoices","orderId",id))documents.add(doc(i,"原始发票（以清算净额为准）："+text(i,"id"),"paymentStatus","amount","invoices","id"));
        continue;
      }
      if ("已取消".equals(text(order,"status")) && matching(data,"orderCancellations","orderId",id).stream().anyMatch(c -> "accepted".equals(text(c,"status")) && !text(c,"createdBy").isBlank() && !text(c,"completedBy").isBlank() && !text(c,"completedAt").isBlank() && !text(c,"reason").isBlank() && !text(c,"response").isBlank())) {
        if (!matching(data,"receipts","orderId",id).isEmpty() || !matching(data,"contracts","relatedOrderId",id).isEmpty() || !matching(data,"invoices","orderId",id).isEmpty()) blockers.add("已取消订单 "+id+" 仍有关联履约或财务责任");
        else {
          cancelled.add(id);
          documents.add(doc(order,"已取消订单（保留原金额）："+id,"status","amount","orders","id"));
          continue;
        }
      }
      if (!Set.of("已收货","已完成").contains(text(order,"status"))) blockers.add("订单 " + id + " 尚未完成收货或已取消");
      documents.add(doc(order,"订单：" + id,"status","amount","orders","id"));
      var lines = matching(data,"orderLines","orderId",id);
      var receipts = matching(data,"receipts","orderId",id);
      if (lines.isEmpty()) blockers.add("订单 " + id + " 缺少订单行数量，无法证明足额收货");
      if (receipts.isEmpty()) blockers.add("订单 " + id + " 尚未收货验收");
      for (var line : lines) {
        var receiptLines = matching(data,"receiptLines","orderLineId",text(line,"id"));
        BigDecimal received = BigDecimal.ZERO;
        BigDecimal accepted = BigDecimal.ZERO;
        for (var rl : receiptLines) {
          var receipt = receipts.stream().filter(r -> text(r,"id").equals(text(rl,"receiptId"))).findFirst().orElse(null);
          if (receipt == null) { blockers.add("订单 " + id + " 收货行关联异常"); continue; }
          BigDecimal quantity = amount(rl,"receivedQuantity"), qualified = amount(rl,"qualifiedQuantity");
          if (quantity.signum() < 0 || qualified.signum() < 0 || qualified.compareTo(quantity) > 0) {
            blockers.add("订单 " + id + " 收货行数量无效"); continue;
          }
          received = received.add(quantity);
          boolean concession = acceptedDisposition(data,receipt);
          accepted = accepted.add(concession ? quantity : qualified.add(resolvedQuantity(data,rl)));
        }
        if (amount(line,"quantity").signum() <= 0 || received.compareTo(amount(line,"quantity")) != 0) {
          blockers.add("订单 " + id + " 行 " + text(line,"id") + " 未足额收货或超量收货");
        }
        if (accepted.compareTo(amount(line,"quantity")) != 0) blockers.add("订单 " + id + " 行 " + text(line,"id") + " 质检或处置尚未通过");
      }
      for (var receipt : receipts) {
        documents.add(doc(receipt,"验收：" + text(receipt,"id"),"inspectionConclusion",null,"receipts","orderId"));
        boolean qualified = "全部合格".equals(text(receipt,"inspectionConclusion"));
        boolean concession = Set.of("部分合格","全部不合格").contains(text(receipt,"inspectionConclusion"))
            && acceptedDisposition(data,receipt);
        boolean resolved=Set.of("部分合格","全部不合格").contains(text(receipt,"inspectionConclusion")) && matching(data,"receiptLines","receiptId",text(receipt,"id")).stream().allMatch(rl->amount(rl,"receivedQuantity").subtract(amount(rl,"qualifiedQuantity")).compareTo(resolvedQuantity(data,rl))==0);
        if (!qualified && !concession && !resolved) blockers.add("订单 " + id + " 验收质检或不合格处置未通过");
        var detail = matching(data,"receiptLines","receiptId",text(receipt,"id"));
        if (detail.isEmpty() || sum(detail,"receivedQuantity").compareTo(amount(receipt,"receivedQuantity")) != 0
            || sum(detail,"qualifiedQuantity").compareTo(amount(receipt,"qualifiedQuantity")) != 0
            || (qualified && amount(receipt,"receivedQuantity").compareTo(amount(receipt,"qualifiedQuantity")) != 0)) {
          blockers.add("订单 " + id + " 收货头行数量或质检证据不一致");
        }
      }
      var contracts = matching(data,"contracts","relatedOrderId",id);
      if (contracts.isEmpty()) blockers.add("订单 " + id + " 尚无合同");
      for (var c : contracts) {
        documents.add(doc(c,"合同：" + text(c,"contractName"),"status","amount","contracts","id"));
        if (!"已生效".equals(text(c,"status")) && !"已归档".equals(text(c,"archiveStatus"))) blockers.add("订单 " + id + " 合同尚未生效或归档");
        if (amount(c,"amount").compareTo(amount(order,"amount")) != 0) blockers.add("订单 " + id + " 合同与订单金额存在差异");
      }
      var invoices = matching(data,"invoices","orderId",id);
      var validInvoices = invoices.stream().filter(ProcurementExecutionPolicy::validInvoice).toList();
      if (validInvoices.isEmpty() || sum(validInvoices,"amount").compareTo(amount(order,"amount")) != 0) blockers.add("订单 " + id + " 有效开票合计不等于订单额");
      for (var invoice : invoices) {
        String invoiceId = text(invoice,"id");
        documents.add(doc(invoice,"发票及付款：" + invoiceId,"paymentStatus","amount","invoices","id"));
        var entries = matching(data,"payments","invoiceId",invoiceId);
        BigDecimal balance = sum(entries,"amount");
        // Legacy paid statuses predate the evidence ledger. Their real net payment is unknown, not zero.
        if (entries.isEmpty() && Set.of("已付款","paid","部分付款","部分已付").contains(text(invoice,"paymentStatus"))) {
          unknownPaid = true; blockers.add("发票 " + invoiceId + " 标记已付款但无付款流水，净付款金额未知");
        }
        paid = paid.add(balance);
        if (validInvoice(invoice) && (amount(invoice,"amount").signum() <= 0 || balance.compareTo(amount(invoice,"amount")) != 0)) blockers.add("发票 " + invoiceId + " 扣冲销的已知付款净额不等于开票额");
        if (!validInvoice(invoice) && balance.signum() != 0) blockers.add("失效发票 " + invoiceId + " 仍有未冲销付款");
        for (var entry : entries) {
          if (!text(entry,"reversalOf").isBlank()) {
            var original = entries.stream().filter(p -> text(p,"id").equals(text(entry,"reversalOf"))).findFirst().orElse(null);
            if (original == null || amount(original,"amount").signum() <= 0 || !text(original,"reversalOf").isBlank()
                || amount(original,"amount").add(amount(entry,"amount")).signum() != 0) blockers.add("发票 " + invoiceId + " 付款冲销关联或金额异常");
          } else if (amount(entry,"amount").signum() <= 0) blockers.add("发票 " + invoiceId + " 付款流水金额异常");
        }
      }
    }
    for (var v : data.path("variances")) if (!"已处理".equals(text(v,"status"))) blockers.add("存在未决差异：" + text(v,"id"));
    for (var r : data.path("reconciliations")) if (Set.of("差异处理中","金额差异","数量短缺","待财务经理签核").contains(text(r,"stage"))) blockers.add("存在未决对账差异：" + text(r,"id"));
    for (var h : data.path("workflowHistory")) if ("processing".equals(text(h.path("instance"),"status"))) blockers.add("存在未完成审批：" + text(h.path("instance"),"id"));
    for (var a : data.path("legacyApprovals")) if (Set.of("pending","待审批","待审核","processing").contains(text(a,"status"))) blockers.add("存在未完成历史审批：" + text(a,"id"));
    for (var reason : data.path("closeoutChecks")) blockers.add(reason.asText());
    for (var reason : data.path("attachmentChecks")) blockers.add(reason.asText());
    BigDecimal invoiced = settlementInvoices.add(sum(list(data,"invoices").stream().filter(i->!settled.contains(text(i,"orderId"))).filter(ProcurementExecutionPolicy::validInvoice).toList(),"amount"));
    BigDecimal ordered = settlementTotal.add(sum(list(data,"orders").stream().filter(o -> !cancelled.contains(text(o,"id"))&&!settled.contains(text(o,"id"))).toList(),"amount"));
    return new Evaluation(List.copyOf(documents), sum(list(data,"demands"),"budget"), ordered,
        invoiced, unknownPaid ? null : paid, unknownPaid ? null : ordered.subtract(paid), blockers.stream().distinct().toList());
  }

  private static boolean validInvoice(JsonNode invoice) {
    return !Set.of("作废","已作废","已取消","已红冲","void","voided","cancelled").contains(text(invoice,"paymentStatus"));
  }
  private static BigDecimal resolvedQuantity(JsonNode data,JsonNode receiptLine) {
    var rows=matching(data,"receiptQualityClearance","receiptLineId",text(receiptLine,"id"));
    if(rows.size()!=1||!rows.get(0).path("valid").asBoolean(false))return BigDecimal.ZERO;
    var row=rows.get(0);var quantity=amount(row,"returnedQuantity").add(amount(row,"exchangedQuantity"));
    return quantity.signum()>=0 && quantity.compareTo(amount(receiptLine,"receivedQuantity").subtract(amount(receiptLine,"qualifiedQuantity")))<=0 ? quantity : BigDecimal.ZERO;
  }
  private static boolean acceptedDisposition(JsonNode data,JsonNode receipt) {
    if ("让步接收".equals(text(receipt,"disposition"))) return true;
    return matching(data,"dispositionReviews","receiptId",text(receipt,"id")).stream().anyMatch(review ->
        "让步接收".equals(text(review,"decision")) && !text(review,"reason").isBlank()
        && !text(review,"evidenceNo").isBlank() && !text(review,"reviewedBy").isBlank() && !text(review,"reviewedAt").isBlank());
  }
  private static Document doc(JsonNode n,String label,String status,String amount,String module,String record) {
    return new Document(text(n,"id"),label,text(n,status),amount == null ? null : amount(n,amount),module,text(n,record));
  }
  public static String text(JsonNode n,String key) { return n.path(key).asText(""); }
  public static BigDecimal amount(JsonNode n,String key) { return n.path(key).isNumber() ? n.path(key).decimalValue() : BigDecimal.ZERO; }
  public static List<JsonNode> list(JsonNode n,String key) { return StreamSupport.stream(n.path(key).spliterator(),false).toList(); }
  private static List<JsonNode> matching(JsonNode data,String key,String field,String value) { return list(data,key).stream().filter(n -> text(n,field).equals(value)).toList(); }
  private static BigDecimal sum(List<JsonNode> nodes,String key) { return nodes.stream().map(n -> amount(n,key)).reduce(BigDecimal.ZERO,BigDecimal::add); }
}
