package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyRecords.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyDrafts {
  private final AgencyDirectory directory;
  private final AgencyJson json;

  public AgencyDrafts(AgencyDirectory directory, AgencyJson json) {
    this.directory = directory;
    this.json = json;
  }

  public AgencyDirectory directory() {
    return directory;
  }

  public AgencyJson json() {
    return json;
  }

  private String clean(String x) {
    return x == null || x.isBlank() ? null : x.strip();
  }

  public Draft normalize(Draft d) {
    if (d == null) throw new IllegalArgumentException("档案内容不能为空");
    String mode = clean(d.operatingMode());
    if (mode == null) mode = "half";
    if (!mode.equals("half")) throw new IllegalArgumentException("全流程规划中，当前仅可创建半流程档案");
    AgencyPolicy.amount(d.budget(), "预算");
    AgencyPolicy.amount(d.ceiling(), "最高限价");
    String title = clean(d.title());
    AgencyPolicy.text(title, 300, "项目包名称");
    for (String v :
        Arrays.asList(
            d.groupId(),
            d.businessCategory(),
            d.objectCode(),
            d.procurementMethod(),
            d.regime(),
            d.region(),
            d.departmentId(),
            d.ownerId())) AgencyPolicy.text(v, 120, "分类字段");
    String currency = clean(d.currency());
    if (currency == null) currency = "CNY";
    if (!currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("币种须为三位大写代码");
    if (clean(d.procurementMethod()) != null
        && !AgencyPolicy.METHODS.contains(d.procurementMethod()))
      throw new IllegalArgumentException("采购方式不在六种方式中");
    var people = directory.people();
    var ids = people.stream().map(Person::id).toList();
    if (clean(d.ownerId()) != null && !ids.contains(d.ownerId()))
      throw new IllegalArgumentException("主负责人必须为当前公司的有效人员");
    if (clean(d.departmentId()) != null
        && directory.departmentsList().stream().noneMatch(x -> x.id().equals(d.departmentId())))
      throw new IllegalArgumentException("部门不属于当前公司或已停用");
    List<Member> members = d.members() == null ? new ArrayList<>() : new ArrayList<>(d.members());
    if (members.size() > 200) throw new IllegalArgumentException("协作人员过多");
    Set<String> seen = new HashSet<>();
    for (Member m : members) {
      if (m == null
          || !ids.contains(m.userId())
          || m.role() == null
          || !Set.of("EDITOR", "VIEWER", "DRAFTER", "OFFICE").contains(m.role())
          || !seen.add(m.userId())
          || Objects.equals(m.userId(), d.ownerId()))
        throw new IllegalArgumentException("协作人员无效、重复或与主负责人重复");
    }
    return new Draft(
        d.expectedVersion(),
        clean(d.groupId()),
        title == null ? "" : title,
        clean(d.businessCategory()),
        clean(d.objectCode()),
        clean(d.procurementMethod()),
        clean(d.regime()),
        clean(d.region()),
        mode,
        clean(d.departmentId()),
        clean(d.ownerId()),
        d.budget(),
        d.ceiling(),
        currency,
        fields(
            d.purchaser(),
            Set.of(
                "name",
                "creditCode",
                "contact",
                "contactRole",
                "phone",
                "email",
                "address",
                "demandContact",
                "notes")),
        fields(
            d.entrustment(),
            Set.of("status", "agreementNo", "signedOn", "serviceScope", "period", "specialTerms")),
        fields(
            d.feeAgreement(),
            Set.of(
                "mode",
                "basis",
                "rate",
                "discount",
                "fixedAmount",
                "payer",
                "payee",
                "trigger",
                "taxNotes",
                "notes")),
        fields(d.supplement(), Set.of("projectName", "externalNumber", "source", "tags", "notes")),
        List.copyOf(members));
  }

  private Map<String, String> fields(Map<String, String> values, Set<String> keys) {
    Map<String, String> out = new TreeMap<>();
    if (values == null) return out;
    for (var e : values.entrySet()) {
      if (!keys.contains(e.getKey())) throw new IllegalArgumentException("不支持的扩展字段：" + e.getKey());
      AgencyPolicy.text(e.getValue(), 4000, e.getKey());
      out.put(e.getKey(), e.getValue() == null ? "" : e.getValue().strip());
    }
    return out;
  }

  public void ready(Draft d, Numbering config) {
    if (AgencyPolicy.blank(d.title())
        || AgencyPolicy.blank(d.businessCategory())
        || AgencyPolicy.blank(d.objectCode())
        || AgencyPolicy.blank(d.procurementMethod())
        || AgencyPolicy.blank(d.purchaser().get("name"))
        || AgencyPolicy.blank(d.ownerId())
        || AgencyPolicy.blank(d.departmentId()))
      throw new IllegalArgumentException("提交须填写项目包名称、业务类别、采购对象、采购方式、采购人、部门与主负责人；委托协议可后补");
    if (!json.tree(config.categories()).has(d.businessCategory())
        || !json.tree(config.objects()).has(d.objectCode()))
      throw new IllegalArgumentException("业务类别或采购对象代码不在公司编号配置中");
  }

  public boolean importantChange(Draft a, Draft b) {
    return !Objects.equals(a.groupId(), b.groupId())
        || !Objects.equals(a.title(), b.title())
        || !Objects.equals(a.businessCategory(), b.businessCategory())
        || !Objects.equals(a.objectCode(), b.objectCode())
        || !Objects.equals(a.procurementMethod(), b.procurementMethod())
        || !Objects.equals(a.regime(), b.regime())
        || !Objects.equals(a.region(), b.region())
        || !Objects.equals(a.ownerId(), b.ownerId())
        || !Objects.equals(a.departmentId(), b.departmentId())
        || !Objects.equals(a.budget(), b.budget())
        || !Objects.equals(a.ceiling(), b.ceiling())
        || !Objects.equals(a.currency(), b.currency())
        || !Objects.equals(a.purchaser().get("name"), b.purchaser().get("name"))
        || !Objects.equals(a.purchaser().get("creditCode"), b.purchaser().get("creditCode"));
  }
}
