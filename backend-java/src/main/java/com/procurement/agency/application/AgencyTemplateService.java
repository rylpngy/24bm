package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.workflow.application.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyTemplateService {
  private final AgencyExecutionSupport s;
  private final UnifiedWorkflowApplicationService workflows;

  public AgencyTemplateService(
      AgencyExecutionSupport s, UnifiedWorkflowApplicationService workflows) {
    this.s = s;
    this.workflows = workflows;
  }

  public List<TemplateView> search(String pkg, String method, String keyword) {
    s.read(pkg, "buyer:agency:document:read");
    List<TemplateView> out = new ArrayList<>();
    for (var t : s.data.templates(s.guard.tenant(), s.str(method), s.str(keyword))) {
      if (!t.active() && !s.guard.permissions().currentUserHas("buyer:agency:template:manage"))
        continue;
      if ("project".equals(t.scope()) && !pkg.equals(t.packageId())) continue;
      var versions = s.data.templateVersions(s.guard.tenant(), t.id());
      boolean manager = s.guard.permissions().currentUserHas("buyer:agency:template:manage");
      var allowed =
          versions.stream()
              .filter(v -> "project".equals(t.scope()) || manager || "published".equals(v.status()))
              .toList();
      if (!allowed.isEmpty()) out.add(new TemplateView(t, allowed));
    }
    return out;
  }

  private Template permitted(String id) {
    var t = s.data.template(s.guard.tenant(), id);
    if (t == null) throw new IllegalArgumentException("模板不存在");
    s.guard.permissions().require("buyer:agency:template:manage");
    if (t.packageId() != null) s.write(t.packageId(), "buyer:agency:template:manage");
    return t;
  }

  @Transactional
  public TemplateView create(TemplateDraft d) {
    s.guard.permissions().require("buyer:agency:template:manage");
    validate(d);
    if ("project".equals(d.scope())) s.write(d.packageId(), "buyer:agency:template:manage");
    else if (d.packageId() != null) throw new IllegalArgumentException("公司模板不能附属于具体采购包");
    String id = "agency-template-" + UUID.randomUUID(), v = "agency-tv-" + UUID.randomUUID();
    s.data.createTemplate(s.guard.tenant(), id, d, s.guard.actor());
    s.data.templateVersion(
        s.guard.tenant(),
        v,
        id,
        1,
        s.json.write(s.validateChapters(d.sections())),
        d.sourceNote(),
        s.guard.actor(),
        d.sourceDate(),
        s.str(d.policyVersion()),
        null);
    s.templateEvent(id, null, d, "保存模板不可变章节版本");
    return new TemplateView(
        s.data.template(s.guard.tenant(), id), s.data.templateVersions(s.guard.tenant(), id));
  }

  @Transactional
  public TemplateView next(String id, TemplateDraft d) {
    var t = permitted(id);
    t = s.data.lockTemplate(s.guard.tenant(), id);
    s.expected(t.version(), d.expectedVersion());
    validate(d);
    if (s.data.templateVersions(s.guard.tenant(), id).stream()
        .anyMatch(v -> "processing".equals(v.status())))
      throw new IllegalStateException("模板发布审核中，不能创建新版本");
    if (!Objects.equals(d.procurementMethod(), t.procurementMethod())
        || !Objects.equals(d.scope(), t.scope())
        || !Objects.equals(d.packageId(), t.packageId()))
      throw new IllegalArgumentException("版本不得改变模板归属或采购方式，请另建模板");
    if (!Objects.equals(t.name(), d.name())
        || !s.str(t.objectCode()).equals(s.str(d.objectCode()))
        || !s.str(t.regime()).equals(s.str(d.regime()))
        || !s.str(t.region()).equals(s.str(d.region()))
        || !s.str(t.description()).equals(s.str(d.description())))
      throw new IllegalArgumentException("新增章节版本不能改写模板分类及名称，请另建模板");
    s.data.nextTemplate(s.guard.tenant(), id, t.version());
    s.data.templateVersion(
        s.guard.tenant(),
        "agency-tv-" + UUID.randomUUID(),
        id,
        t.latestOrdinal() + 1,
        s.json.write(s.validateChapters(d.sections())),
        d.sourceNote(),
        s.guard.actor(),
        d.sourceDate(),
        s.str(d.policyVersion()),
        null);
    s.templateEvent(id, null, d, "保存模板不可变章节版本");
    return new TemplateView(
        s.data.template(s.guard.tenant(), id), s.data.templateVersions(s.guard.tenant(), id));
  }

  private void validate(TemplateDraft d) {
    if (d == null) throw new IllegalArgumentException("缺少模板数据");
    s.text(d.name(), 200, true, "模板名称");
    s.text(d.sourceNote(), 2000, true, "模板来源及适用依据");
    if ((d.scope() == null || !Set.of("company", "project").contains(d.scope()))
        || d.procurementMethod() == null
        || !AgencyPolicy.METHODS.contains(d.procurementMethod()))
      throw new IllegalArgumentException("模板范围或采购方式不合法");
    s.text(d.description(), 4000, false, "模板说明");
    s.validateChapters(d.sections());
    if (d.sourceDate() != null && d.sourceDate().isAfter(java.time.LocalDate.now()))
      throw new IllegalArgumentException("模板来源日期不能晚于今天");
    s.text(d.policyVersion(), 200, false, "政策或制度版本");
  }

  @Transactional
  public TemplateVersion submit(String id, String key, Map<String, Object> form) {
    var v = s.data.templateVersionById(s.guard.tenant(), id);
    if (v == null) throw new IllegalArgumentException("模板版本不存在");
    var t = permitted(v.templateId());
    s.data.lockTemplate(s.guard.tenant(), t.id());
    String hash = s.begin(key, Arrays.asList("template-submit", id, form));
    var old = s.remembered(key);
    if (old != null) return s.json.read(old, TemplateVersion.class);
    if (!"company".equals(t.scope())) throw new IllegalArgumentException("项目自有模板直接在本包使用，不发布到公司库");
    if (v.ordinal() != t.latestOrdinal()
        || !Set.of("draft", "rejected", "withdrawn").contains(v.status()))
      throw new IllegalStateException("仅当前可编辑模板版本可送审");
    s.data.templateState(
        s.guard.tenant(), id, v.status(), "processing", null, s.guard.actor(), null);
    var w =
        workflows.start(
            new WorkflowStartCommand(
                "agency_template_publication",
                id,
                null,
                null,
                form == null ? Map.of() : form,
                Map.of(
                    "templateId",
                    t.id(),
                    "templateName",
                    t.name(),
                    "sections",
                    s.chapters(v.sectionsJson()),
                    "sourceNote",
                    v.sourceNote(),
                    "sourceDate",
                    v.sourceDate() == null ? "" : v.sourceDate().toString(),
                    "policyVersion",
                    v.policyVersion(),
                    "originTemplateVersionId",
                    v.originTemplateVersionId() == null ? "" : v.originTemplateVersionId(),
                    "hash",
                    s.json.hash(v.sectionsJson()))));
    s.data.templateState(
        s.guard.tenant(),
        id,
        "processing",
        "processing",
        w.workflowInstanceId(),
        s.guard.actor(),
        null);
    var result = s.data.templateVersionById(s.guard.tenant(), id);
    s.remember(key, hash, result);
    return result;
  }

  @Transactional
  public Template active(String id, Long expected, boolean active, String reason) {
    var t = permitted(id);
    t = s.data.lockTemplate(s.guard.tenant(), id);
    s.expected(t.version(), expected);
    s.text(reason, 1000, true, "启停原因");
    if (s.data.templateVersions(s.guard.tenant(), id).stream()
        .anyMatch(v -> "processing".equals(v.status())))
      throw new IllegalStateException("模板审核中不能启停");
    s.data.templateActive(s.guard.tenant(), id, t.version(), active);
    s.templateEvent(id, t, s.data.template(s.guard.tenant(), id), reason);
    return s.data.template(s.guard.tenant(), id);
  }

  @Transactional
  public TemplateVersion withdraw(String id, String reason) {
    var v = s.data.templateVersionById(s.guard.tenant(), id);
    if (v == null) throw new IllegalArgumentException("模板版本不存在");
    permitted(v.templateId());
    s.data.lockTemplate(s.guard.tenant(), v.templateId());
    workflows.withdrawAgencyExecution(v.workflowId(), reason);
    return s.data.templateVersionById(s.guard.tenant(), id);
  }

  public TemplateVersion usable(String pkg, String id) {
    var v = s.data.templateVersionById(s.guard.tenant(), id);
    if (v == null) throw new IllegalArgumentException("模板版本不存在");
    var t = s.data.template(s.guard.tenant(), v.templateId());
    if (t == null || !t.active()) throw new IllegalStateException("模板已停用");
    var p = s.read(pkg, "buyer:agency:document:read");
    if (!t.procurementMethod().equals(p.procurementMethod()))
      throw new IllegalArgumentException("模板采购方式与当前包不一致");
    if ("project".equals(t.scope())) {
      if (!pkg.equals(t.packageId())) throw new IllegalArgumentException("不能引用其他采购包自有模板");
    } else if (!"published".equals(v.status()) || !id.equals(t.publishedVersionId()))
      throw new IllegalStateException("公司模板须使用当前已审核发布版本");
    return v;
  }

  @Transactional
  public TemplateView promote(
      String versionId,
      String name,
      String note,
      java.time.LocalDate sourceDate,
      String policyVersion,
      String key) {
    s.guard.permissions().require("buyer:agency:template:promote");
    var source = s.data.templateVersionById(s.guard.tenant(), versionId);
    if (source == null) throw new IllegalArgumentException("来源模板版本不存在");
    var parent = permitted(source.templateId());
    if (!"project".equals(parent.scope())) throw new IllegalArgumentException("仅项目自有模板可申请纳入公司库");
    s.data.lockTemplate(s.guard.tenant(), parent.id());
    String hash =
        s.begin(
            key,
            Arrays.asList("template-promote", versionId, name, note, sourceDate, policyVersion));
    String prior = s.remembered(key);
    if (prior != null) return s.json.read(prior, TemplateView.class);
    var d =
        new TemplateDraft(
            null,
            null,
            name,
            "company",
            parent.procurementMethod(),
            parent.objectCode(),
            parent.regime(),
            parent.region(),
            parent.description(),
            s.chapters(source.sectionsJson()),
            note,
            sourceDate,
            policyVersion);
    validate(d);
    String id = "agency-template-" + UUID.randomUUID(), v = "agency-tv-" + UUID.randomUUID();
    s.data.createTemplate(s.guard.tenant(), id, d, s.guard.actor());
    s.data.templateVersion(
        s.guard.tenant(),
        v,
        id,
        1,
        s.json.write(d.sections()),
        note,
        s.guard.actor(),
        sourceDate,
        s.str(policyVersion),
        source.id());
    var result =
        new TemplateView(
            s.data.template(s.guard.tenant(), id), s.data.templateVersions(s.guard.tenant(), id));
    s.templateEvent(
        id,
        null,
        Map.of("originTemplateVersionId", source.id(), "companyTemplateId", id),
        "申请项目模板纳入公司库，尚未审核发布");
    s.remember(key, hash, result);
    return result;
  }
}
