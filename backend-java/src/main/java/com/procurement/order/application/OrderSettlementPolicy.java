package com.procurement.order.application;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.procurement.order.api.OrderSettlementContracts.*;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class OrderSettlementPolicy {
  public Entry sanitizedEntry(Entry entry) {
    ObjectNode node = json.valueToTree(entry);
    ObjectNode safe = json.createObjectNode();
    ObjectNode assessment = json.createObjectNode();
    assessment.set("lines", tree(entry.snapshot()).path("assessment").path("lines"));
    safe.set("assessment", assessment);
    if (tree(entry.snapshot()).has("invoicePlan")) safe.set("invoicePlan", tree(entry.snapshot()).path("invoicePlan"));
    node.put("snapshot", write(safe));
    return json.convertValue(node, Entry.class);
  }

  private final ObjectMapper json;

  public OrderSettlementPolicy(ObjectMapper json) {
    this.json = json;
  }

  public JsonNode tree(String value) {
    try {
      return json.readTree(value);
    } catch (Exception e) {
      throw new IllegalStateException("清算依据无法解析", e);
    }
  }

  public String write(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("清算依据无法保存", e);
    }
  }

  public record Assessment(
      String contractId,
      String kind,
      BigDecimal goods,
      BigDecimal paid,
      BigDecimal invoiced,
      String snapshot,
      List<String> blockers) {}

  public Assessment assess(String baseline, List<Price> prices) {
    JsonNode b = tree(baseline);
    var errors = new ArrayList<String>();
    var contract = b.path("contracts");
    String contractId = null, kind = "termination";
    if (contract.size() > 1) errors.add("关联多个合同须先核对合同归属");
    else if (contract.isEmpty()) kind = "order_closeout";
    else {
      var c = contract.get(0);
      contractId = c.path("id").asText();
      String s = c.path("status").asText();
      if (!Set.of("草案", "已生效").contains(s) || "已归档".equals(c.path("archive_status").asText()))
        errors.add("合同须为未归档草案或已生效合同");
      if ("草案".equals(s)) kind = "draft_void";
      if (c.path("amount").decimalValue().compareTo(b.path("amount").decimalValue()) != 0
          || !c.path("supplier_id").asText().equals(b.path("supplierId").asText()))
        errors.add("合同与订单金额或供应商不一致");
    }
    var priceMap = new HashMap<String, BigDecimal>();
    if (prices != null)
      for (var p : prices)
        if (priceMap.put(p.lineId(), p.unitPrice()) != null) errors.add("清算行号重复");
    BigDecimal goods = BigDecimal.ZERO, original = BigDecimal.ZERO;
    boolean residual = false, received = false;
    ArrayNode lines = json.createArrayNode();
    if (b.path("lines").isEmpty()) errors.add("订单缺少可核验行明细");
    for (var l : b.path("lines")) {
      BigDecimal q = l.path("quantity").decimalValue(),
          s = l.path("shipped").decimalValue(),
          r = l.path("received").decimalValue(),
          a = l.path("qualified").decimalValue(),
          p = l.path("unitPrice").decimalValue();
      BigDecimal selected = priceMap.remove(l.path("id").asText());
      if (selected == null) selected = p;
      if (q.signum() <= 0
          || p.signum() < 0
          || q.multiply(p)
                  .setScale(2, RoundingMode.HALF_UP)
                  .compareTo(l.path("lineAmount").decimalValue())
              != 0) errors.add("订单原始数量或金额不一致");
      BigDecimal resolved=l.path("resolvedUnqualified").decimalValue();
      if (resolved.signum()<0 || a.signum()<0 || a.compareTo(r)>0 || s.compareTo(r) != 0 || r.compareTo(a.add(resolved)) != 0 || r.signum() < 0 || r.compareTo(q) > 0)
        errors.add("存在在途、待验收或不合格货物，须先完成实物处理");
      BigDecimal returned=l.path("verifiedReturned").decimalValue();
      if(returned.signum()<0 || returned.compareTo(r)>0)errors.add("已核验退货量与原收货量不一致");
      r=r.subtract(returned);
      if (selected.signum() < 0 || selected.compareTo(p) > 0 || selected.scale() > 2)
        errors.add("清算单价须在零至原单价范围内且最多两位小数");
      if (q.compareTo(r) > 0) {
        residual = true;
        if (!l.path("skuId").isNull()
            && !l.path("skuId").isMissingNode()
            && l.path("reserved").isNull()) errors.add("历史库存预留不明，不能自动释放库存");
      }
      if (r.signum() > 0) received = true;
      original = original.add(l.path("lineAmount").decimalValue());
      goods = goods.add(r.multiply(selected).setScale(2, RoundingMode.HALF_UP));
      ObjectNode kept = l.deepCopy();
      kept.put("settlementUnitPrice", selected);
      kept.put("retainedQuantity", r);
      kept.put("cancelledQuantity", q.subtract(r));
      kept.put("returnedQuantity", returned);
      lines.add(kept);
    }
    if (!priceMap.isEmpty()) errors.add("清算单价含不属于本订单的行");
    if (original.compareTo(b.path("amount").decimalValue()) != 0) errors.add("订单总额与行明细不一致");
    BigDecimal paid = BigDecimal.ZERO, invoiced = BigDecimal.ZERO;
    for (var i : b.path("invoices")) {
      BigDecimal face = i.path("amount").decimalValue(), balance = BigDecimal.ZERO;
      for (var e : b.path("payments"))
        if (i.path("id").asText().equals(e.path("invoice_id").asText()))
          balance = balance.add(e.path("amount").decimalValue());
      String state = i.path("payment_status").asText();
      if (balance.signum() < 0
          || balance.compareTo(face) > 0
          || (!Set.of("待付款", "部分付款", "已付款").contains(state))
          || ("已付款".equals(state) && balance.compareTo(face) != 0)
          || ("待付款".equals(state) && balance.signum() != 0)
          || ("部分付款".equals(state) && (balance.signum() <= 0 || balance.compareTo(face) >= 0)))
        errors.add("历史付款状态与真实金额流水不一致，不能按零推算");
      if (face.signum() <= 0 || !i.path("supplier_id").asText(b.path("supplierId").asText()).equals(b.path("supplierId").asText())) errors.add("原始发票金额或供应商不一致");
      paid = paid.add(balance);
      invoiced = invoiced.add(face);
    }
    if (invoiced.compareTo(b.path("amount").decimalValue()) > 0) errors.add("原始累计开票金额超过订单金额");
    for (var payment : b.path("payments")) {
      boolean found = false;
      for (var invoice : b.path("invoices")) if (invoice.path("id").asText().equals(payment.path("invoice_id").asText())) found = true;
      if (!found || payment.path("amount").decimalValue().signum() <= 0) errors.add("付款流水缺少本订单有效发票归属");
    }
    if ("draft_void".equals(kind) && (received || invoiced.signum() > 0 || paid.signum() > 0))
      errors.add("有实际履约或财务记录的草案不能直接撤销");
    if (!Set.of("draft_void", "order_closeout").contains(kind) && received && residual) kind = "reduction";
    ObjectNode result = json.createObjectNode();
    result.set("baseline", b);
    result.set("lines", lines);
    return new Assessment(
        contractId,
        kind,
        goods,
        paid,
        invoiced,
        write(result),
        List.copyOf(new LinkedHashSet<>(errors)));
  }

  public BigDecimal net(Entry e, List<Evidence> items) {
    BigDecimal n = e.initialPaid();
    for (var x : items)
      if ("payment".equals(x.kind())) n = n.add(x.amount());
      else if ("refund".equals(x.kind())) n = n.subtract(x.amount());
    return n;
  }

  public List<String> completionBlockers(Entry e, List<Evidence> items) {
    if (tree(e.snapshot()).has("invoicePlan")) return new OrderSettlementAllocationPolicy(json).completionBlockers(tree(e.snapshot()).path("invoicePlan"), items);
    var b = new ArrayList<String>();
    if (net(e, items).compareTo(e.finalAmount()) != 0) b.add("实际净付款尚未等于约定清算金额");
    if (e.goodsAmount().signum() > 0 || e.initialInvoiced().signum() > 0) {
      if (items.stream()
          .noneMatch(x -> "invoice".equals(x.kind()) && x.amount().compareTo(e.goodsAmount()) == 0))
        b.add("缺少最终货款发票或红冲核对凭证");
    }
    if (e.compensationAmount().signum() > 0
        && items.stream()
            .noneMatch(
                x ->
                    "compensation_receipt".equals(x.kind())
                        && x.amount().compareTo(e.compensationAmount()) == 0)) b.add("缺少补偿款结算凭证");
    return b;
  }
}
