package com.procurement.order.application;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.procurement.order.api.OrderSettlementContracts.*;
import java.math.BigDecimal;
import java.util.*;

/** Explicit invoice attribution; never infer how a supplier should credit multiple invoices. */
public class OrderSettlementAllocationPolicy {
  private final ObjectMapper json;

  public OrderSettlementAllocationPolicy(ObjectMapper json) {
    this.json = json;
  }

  public ArrayNode basis(JsonNode baseline) {
    var rows = json.createArrayNode();
    BigDecimal invoiced = BigDecimal.ZERO;
    Set<String> ids = new HashSet<>();
    for (var i : baseline.path("invoices")) {
      String id = i.path("id").asText();
      if (id.isBlank() || id.startsWith("~") || !ids.add(id))
        throw new IllegalStateException("发票归属编号无效或重复");
      BigDecimal paid = BigDecimal.ZERO;
      for (var p : baseline.path("payments"))
        if (id.equals(p.path("invoice_id").asText()))
          paid = paid.add(p.path("amount").decimalValue());
      var row = rows.addObject();
      row.put("source", id);
      row.put("label", i.path("invoice_no").asText(id));
      row.put("face", i.path("amount").decimalValue());
      row.put("paid", paid);
      invoiced = invoiced.add(i.path("amount").decimalValue());
    }
    BigDecimal unbilled = baseline.path("amount").decimalValue().subtract(invoiced);
    if (unbilled.signum() > 0) {
      var row = rows.addObject();
      row.put("source", "~unbilled");
      row.put("label", "未开票货款");
      row.put("face", unbilled);
      row.put("paid", baseline.path("unbilledPaid").decimalValue());
    }
    return rows;
  }

  public boolean required(JsonNode baseline) {
    return baseline.path("invoices").size() > 1
        || (baseline.path("invoices").size() == 1
            && baseline
                    .path("invoices")
                    .get(0)
                    .path("amount")
                    .decimalValue()
                    .compareTo(baseline.path("amount").decimalValue())
                != 0);
  }

  public ArrayNode plan(
      JsonNode baseline, BigDecimal goods, BigDecimal compensation, List<Allocation> allocations) {
    if (allocations == null && !required(baseline)) return null;
    var values = new HashMap<String, BigDecimal>();
    if (allocations == null) throw new IllegalArgumentException("请逐票填写最终货款归属，不能自动分摊多张或分次发票");
    for (var a : allocations)
      if (a == null
          || a.source() == null
          || a.goodsAmount() == null
          || values.put(a.source(), a.goodsAmount()) != null)
        throw new IllegalArgumentException("发票归属重复或缺少金额");
    var rows = basis(baseline);
    BigDecimal total = BigDecimal.ZERO;
    for (var node : rows) {
      var row = (ObjectNode) node;
      BigDecimal target = values.remove(row.path("source").asText());
      if (target == null
          || target.signum() < 0
          || target.scale() > 2
          || target.compareTo(row.path("face").decimalValue()) > 0)
        throw new IllegalArgumentException("每张发票及未开票货款均须填写零至原金额范围内的清算归属");
      row.put("target", target);
      total = total.add(target);
    }
    if (!values.isEmpty() || total.compareTo(goods) != 0)
      throw new IllegalArgumentException("归属含其他订单发票或货款合计不等于清算货款");
    if (compensation.signum() > 0) {
      var row = rows.addObject();
      row.put("source", "~compensation");
      row.put("label", "补偿款");
      row.put("face", compensation);
      row.put("paid", BigDecimal.ZERO);
      row.put("target", compensation);
    }
    return rows;
  }

  public BigDecimal balance(JsonNode row, List<Evidence> items) {
    BigDecimal net = row.path("paid").decimalValue();
    for (var e : items)
      if (row.path("source").asText().equals(e.source())) {
        if ("payment".equals(e.kind())) net = net.add(e.amount());
        if ("refund".equals(e.kind())) net = net.subtract(e.amount());
      }
    return net;
  }

  public void validate(JsonNode plan, List<Evidence> items, EvidenceRequest r) {
    JsonNode row = null;
    for (var x : plan) if (x.path("source").asText().equals(r.source())) row = x;
    if (row == null) throw new IllegalArgumentException("请选择清算方案中的发票或款项归属");
    BigDecimal target = row.path("target").decimalValue(), net = balance(row, items);
    boolean cash = Set.of("refund", "payment").contains(r.kind());
    if (!cash) {
      String expected = "~compensation".equals(r.source()) ? "compensation_receipt" : "invoice";
      if (!expected.equals(r.kind())
          || r.amount().compareTo(target) != 0
          || items.stream()
              .anyMatch(x -> expected.equals(x.kind()) && Objects.equals(r.source(), x.source())))
        throw new IllegalStateException("该归属的最终发票或补偿凭证金额不符，或已登记");
    } else {
      BigDecimal due = "refund".equals(r.kind()) ? net.subtract(target) : target.subtract(net);
      if (r.amount().signum() <= 0 || r.amount().compareTo(due) > 0)
        throw new IllegalStateException("凭证金额超过该发票或款项的待退款/待补付款");
    }
  }

  public List<String> completionBlockers(JsonNode plan, List<Evidence> items) {
    var errors = new ArrayList<String>();
    for (var row : plan) {
      String source = row.path("source").asText(), label = row.path("label").asText();
      BigDecimal target = row.path("target").decimalValue();
      if (balance(row, items).compareTo(target) != 0) errors.add(label + "：净付款与本项清算金额不一致");
      String kind = "~compensation".equals(source) ? "compensation_receipt" : "invoice";
      if ((target.signum() > 0 || !source.startsWith("~"))
          && items.stream()
              .noneMatch(
                  x ->
                      kind.equals(x.kind())
                          && source.equals(x.source())
                          && x.amount().compareTo(target) == 0))
        errors.add(label + "：缺少本项最终发票/红冲或补偿凭证");
    }
    if (items.stream()
        .anyMatch(
            x -> {
              for (var row : plan) if (row.path("source").asText().equals(x.source())) return false;
              return true;
            })) errors.add("存在未归属清算凭证");
    return List.copyOf(errors);
  }

  public static boolean archiveComplete(JsonNode settlement, List<JsonNode> rows) {
    var plan = settlement.path("snapshot").path("invoicePlan");
    if (!plan.isArray()) return false;
    var evidence =
        rows.stream()
            .map(
                r ->
                    new Evidence(
                        null,
                        null,
                        r.path("kind").asText(),
                        r.path("amount").decimalValue(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        r.path("source").asText(null)))
            .toList();
    return new OrderSettlementAllocationPolicy(new ObjectMapper())
        .completionBlockers(plan, evidence)
        .isEmpty();
  }
}
