package com.procurement.buyer.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.*;
import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.api.ProjectExpansionContracts.*;
import com.procurement.buyer.infrastructure.*;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public record ProjectAllocationPolicy(
    ProcurementProjectMapper projects,
    ProjectExpansionMapper expansion,
    ProjectPlanSupport plans,
    ObjectMapper json) {
  public <T> T read(String text, Class<T> type) {
    try {
      return json.readValue(text, type);
    } catch (Exception e) {
      throw new IllegalStateException("项目快照读取失败", e);
    }
  }

  public List<Line> lines(String text) {
    try {
      return json.readValue(text, new TypeReference<List<Line>>() {});
    } catch (Exception e) {
      throw new IllegalStateException("项目明细快照读取失败", e);
    }
  }

  public String write(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException("项目快照保存失败", e);
    }
  }

  public JsonNode tree(String text) {
    try {
      return json.reader().with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS).readTree(text);
    } catch (Exception e) {
      throw new IllegalStateException("项目快照读取失败", e);
    }
  }

  public void noPending(Project p) {
    if (expansion.pending(p.tenantId(), p.id()) > 0)
      throw new IllegalStateException("立项变更审批中，暂不能新增分包、需求或采购执行");
  }

  public Map<String, Object> definition(Project p) {
    var m = new LinkedHashMap<String, Object>();
    m.put("id", p.id());
    m.put("projectNo", p.projectNo());
    m.put("title", p.title());
    m.put("departmentId", p.departmentId());
    m.put("ownerId", p.ownerId());
    m.put("period", p.period());
    m.put("fundingSource", p.fundingSource());
    m.put("plannedAmount", p.plannedAmount());
    m.put("purpose", p.purpose());
    m.put("lines", projects.lines(p.tenantId(), p.id()));
    return m;
  }

  public void freezeLegacy(Project p) {
    if (p.executionId() != null)
      expansion.insertBaseline(
          p.tenantId(),
          p.id(),
          p.executionType(),
          p.executionId(),
          write(definition(p)),
          write(
              projects.demands(p.tenantId(), p.id()).stream()
                  .filter(d -> expansion.demandLot(p.tenantId(), d.id()) == null)
                  .map(Demand::id)
                  .toList()));
  }

  public List<String> legacyDemands(Project p) {
    if (p.executionId() == null) return List.of();
    String s = expansion.baselineDemands(p.tenantId(), p.executionType(), p.executionId());
    if (s == null) return projects.demands(p.tenantId(), p.id()).stream().map(Demand::id).toList();
    var result = new ArrayList<String>();
    tree(s).forEach(n -> result.add(n.asText()));
    return result;
  }

  public List<Line> legacyLines(Project p) {
    if (p.executionId() == null) return List.of();
    String s = expansion.baseline(p.tenantId(), p.executionType(), p.executionId());
    return s == null
        ? projects.lines(p.tenantId(), p.id())
        : lines(tree(s).path("lines").toString());
  }

  private void add(Map<String, BigDecimal> qty, List<Line> lines) {
    for (var l : lines) qty.merge(l.materialId(), l.quantity(), BigDecimal::add);
  }

  public Map<String, BigDecimal> protectedQuantity(Project p, String excludeLot) {
    var qty = new HashMap<String, BigDecimal>();
    add(qty, legacyLines(p));
    for (var lot : expansion.packages(p.tenantId(), p.id()))
      if (!lot.id().equals(excludeLot) && !"cancelled".equals(lot.status()))
        add(qty, lines(lot.lines()));
    var legacy = legacyDemands(p);
    for (var d : projects.demands(p.tenantId(), p.id()))
      if (!"已取消".equals(d.status()) && expansion.demandLot(p.tenantId(), d.id()) == null && !legacy.contains(d.id()))
        for (var l : tree(expansion.demandLines(p.tenantId(), d.id())))
          qty.merge(
              l.path("materialId").asText(), l.path("quantity").decimalValue(), BigDecimal::add);
    return qty;
  }

  public BigDecimal protectedAmount(Project p, String excludeLot) {
    BigDecimal amount = plans.total(legacyLines(p));
    var legacy = legacyDemands(p);
    BigDecimal legacyBudgets =
        projects.demands(p.tenantId(), p.id()).stream()
            .filter(d -> legacy.contains(d.id()))
            .map(Demand::budget)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    amount = amount.max(legacyBudgets);
    for (var lot : expansion.packages(p.tenantId(), p.id()))
      if (!lot.id().equals(excludeLot) && !"cancelled".equals(lot.status()))
        amount = amount.add(lot.amount());
    for (var d : projects.demands(p.tenantId(), p.id()))
      if (!"已取消".equals(d.status()) && expansion.demandLot(p.tenantId(), d.id()) == null && !legacy.contains(d.id()))
        amount = amount.add(d.budget());
    return amount;
  }

  public List<Line> allocate(
      Project p, List<Allocation> request, String excludeLot, List<String> adoptedDemands) {
    var protectedQty = protectedQuantity(p, excludeLot);
    BigDecimal protectedBudget = protectedAmount(p, excludeLot);
    for (var id : adoptedDemands) {
      protectedBudget = protectedBudget.subtract(projects.demand(p.tenantId(), id).budget());
      for (var l : tree(expansion.demandLines(p.tenantId(), id)))
        protectedQty.merge(
            l.path("materialId").asText(),
            l.path("quantity").decimalValue().negate(),
            BigDecimal::add);
    }
    var source = projects.lines(p.tenantId(), p.id());
    var result = new ArrayList<Line>();
    var seen = new HashSet<String>();
    for (var input : request) {
      if (!seen.add(input.materialId())
          || input.quantity().signum() <= 0
          || input.quantity().scale() > 4) throw new IllegalArgumentException("分包物料重复或数量无效");
      var l =
          source.stream()
              .filter(x -> x.materialId().equals(input.materialId()))
              .findFirst()
              .orElseThrow(() -> new IllegalArgumentException("分包物料不在已批准项目中"));
      if (input
              .quantity()
              .add(protectedQty.getOrDefault(l.materialId(), BigDecimal.ZERO))
              .compareTo(l.quantity())
          > 0) throw new IllegalStateException("分包累计数量超过已批准数量：" + l.name());
      result.add(
          new Line(
              l.id(),
              l.materialId(),
              l.name(),
              l.specification(),
              l.unit(),
              input.quantity(),
              l.unitPrice(),
              l.purpose()));
    }
    amountFor(p, result, excludeLot, adoptedDemands);
    return result;
  }

  public BigDecimal amountFor(
      Project p, List<Line> lines, String excludeLot, List<String> adopted) {
    BigDecimal occupied = protectedAmount(p, excludeLot);
    for (var id : adopted) occupied = occupied.subtract(projects.demand(p.tenantId(), id).budget());
    BigDecimal remaining = p.plannedAmount().subtract(occupied), calculated = plans.total(lines);
    var qty = protectedQuantity(p, excludeLot);
    for (var id : adopted)
      for (var item : tree(expansion.demandLines(p.tenantId(), id)))
        qty.merge(
            item.path("materialId").asText(),
            item.path("quantity").decimalValue().negate(),
            BigDecimal::add);
    add(qty, lines);
    var source = projects.lines(p.tenantId(), p.id());
    boolean complete =
        source.stream()
            .allMatch(
                l ->
                    l.quantity().compareTo(qty.getOrDefault(l.materialId(), BigDecimal.ZERO)) == 0);
    var previous = new ArrayList<>(legacyLines(p));
    for (var lot : expansion.packages(p.tenantId(), p.id()))
      if (!lot.id().equals(excludeLot) && !"cancelled".equals(lot.status()))
        previous.addAll(lines(lot.lines()));
    boolean samePrices =
        previous.stream()
            .allMatch(
                l ->
                    source.stream()
                        .anyMatch(
                            s ->
                                s.materialId().equals(l.materialId())
                                    && s.unitPrice().compareTo(l.unitPrice()) == 0));
    var legacy = legacyDemands(p);
    boolean noUnassigned =
        projects.demands(p.tenantId(), p.id()).stream()
            .allMatch(
                d ->
                    "已取消".equals(d.status()) || adopted.contains(d.id())
                        || legacy.contains(d.id())
                        || expansion.demandLot(p.tenantId(), d.id()) != null);
    BigDecimal legacyBudget =
        projects.demands(p.tenantId(), p.id()).stream()
            .filter(d -> legacy.contains(d.id()))
            .map(Demand::budget)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    if (complete
        && samePrices
        && noUnassigned
        && legacyBudget.compareTo(plans.total(legacyLines(p))) <= 0
        && calculated
                .subtract(remaining)
                .abs()
                .compareTo(
                    new BigDecimal("0.01")
                        .multiply(BigDecimal.valueOf(previous.size() + lines.size())))
            <= 0) calculated = remaining;
    if (calculated.signum() <= 0 || calculated.compareTo(remaining) > 0)
      throw new IllegalStateException("分包累计金额超过已批准立项金额");
    return calculated;
  }

  public List<Line> validateChange(Project p, Draft d) {
    var result = plans.validateState(p.tenantId(), d);
    if (!projects.demands(p.tenantId(), p.id()).isEmpty()
        || !expansion.packages(p.tenantId(), p.id()).isEmpty()
        || p.executionId() != null) {
      if (!p.departmentId().equals(d.departmentId()) || !p.period().equals(d.period()))
        throw new IllegalStateException("已有分包或需求后不能变更部门、年度，请新建项目承接");
    }
    var required = protectedQuantity(p, null);
    for (var entry : required.entrySet()) {
      var q =
          result.stream()
              .filter(l -> l.materialId().equals(entry.getKey()))
              .map(Line::quantity)
              .findFirst()
              .orElse(BigDecimal.ZERO);
      if (q.compareTo(entry.getValue()) < 0)
        throw new IllegalStateException("变更不能删除或减少已分配、已关联采购的物料数量");
    }
    if (plans.total(result).compareTo(protectedAmount(p, null)) < 0)
      throw new IllegalStateException("变更金额不能低于已分配分包及关联需求金额");
    return result;
  }

  public void validateLotDemands(PackageRow lot) {
    var qty = new HashMap<String, BigDecimal>();
    BigDecimal amount = BigDecimal.ZERO;
    var ids = expansion.lotDemands(lot.tenantId(), lot.id());
    if (ids.isEmpty()) throw new IllegalStateException("分包尚无采购需求");
    for (var id : ids) {
      var d = projects.demand(lot.tenantId(), id);
      if (d == null || !List.of("已通过", "已转询价").contains(d.status()))
        throw new IllegalStateException("分包需求尚未全部审批通过");
      amount = amount.add(d.budget());
      for (var l : tree(expansion.demandLines(lot.tenantId(), id)))
        qty.merge(
            l.path("materialId").asText(), l.path("quantity").decimalValue(), BigDecimal::add);
    }
    var expected = new HashMap<String, BigDecimal>();
    add(expected, lines(lot.lines()));
    if (qty.size() != expected.size()
        || expected.entrySet().stream()
            .anyMatch(
                e -> e.getValue().compareTo(qty.getOrDefault(e.getKey(), BigDecimal.ZERO)) != 0))
      throw new IllegalStateException("分包需求的物料及数量须与分包一致，请先核对需求");
    if (amount.compareTo(lot.amount()) > 0)
      throw new IllegalStateException("分包需求预算超过分包批准金额，请先办理立项变更及分包调整");
  }
}
