package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.identity.application.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyCollaborationService {
  private final AgencyExecutionSupport s;
  private final AgencyDirectory directory;
  private final AgencyPlanInitializer plans;

  public AgencyCollaborationService(
      AgencyExecutionSupport s, AgencyDirectory directory, AgencyPlanInitializer plans) {
    this.s = s;
    this.directory = directory;
    this.plans = plans;
  }

  @Transactional
  public Participation saveParticipation(String pkg, String id, ParticipationDraft d) {
    s.write(pkg, "buyer:agency:participation:manage");
    s.text(d.supplierName(), 300, true, "供应商名称");
    s.text(d.source(), 1000, true, "记录来源");
    for (String v : Arrays.asList(d.creditCode(), d.contact(), d.phone(), d.riskNote(), d.notes()))
      s.text(v, 4000, false, "台账字段");
    if (d.acquisitionStatus() == null
        || !Set.of("unknown", "acquired", "not_applicable").contains(d.acquisitionStatus())
        || d.submissionStatus() == null
        || !Set.of("unknown", "submitted", "withdrawn").contains(d.submissionStatus())
        || d.riskStatus() == null
        || !Set.of("pending", "checked", "not_applicable").contains(d.riskStatus()))
      throw new IllegalArgumentException("参与台账状态不合法，不得在此登记准入或资格结论");
    if (d.evidenceVersionId() != null && !d.evidenceVersionId().isBlank())
      s.sourceVersion(d.evidenceVersionId(), pkg);
    d =
        new ParticipationDraft(
            d.expectedVersion(),
            d.supplierName(),
            d.creditCode(),
            d.contact(),
            d.phone(),
            d.source(),
            d.acquisitionStatus(),
            d.submissionStatus(),
            s.str(d.riskNote()),
            d.riskStatus(),
            d.evidenceVersionId(),
            s.str(d.notes()));
    Participation before = null;
    if (id == null) {
      id = "agency-participation-" + UUID.randomUUID();
      s.data.participationCreate(s.guard.tenant(), id, pkg, d, s.guard.actor());
    } else {
      before = s.data.participation(s.guard.tenant(), id);
      if (before == null || !pkg.equals(before.packageId()))
        throw new IllegalArgumentException("台账记录不存在");
      s.expected(before.version(), d.expectedVersion());
      s.data.participationUpdate(s.guard.tenant(), id, before.version(), d);
    }
    var result = s.data.participation(s.guard.tenant(), id);
    s.event(pkg, "participation", id, before, result, "维护内部参与记录，不生成资格结论");
    return result;
  }

  public boolean userVisible(PackageRow p, String user) {
    if (!s.guard.permissions().userHas(user, "buyer:agency:read")) return false;
    if (user.equals(p.createdBy())
        || user.equals(p.ownerId())
        || s.packages.members(p.tenantId(), p.id()).stream().anyMatch(m -> m.userId().equals(user)))
      return true;
    var scope = s.guard.scopes().userDataScope(p.tenantId(), user);
    return !scope.restricted()
        || scope.requesterId() != null && scope.requesterId().equals(p.createdBy())
        || p.departmentId() != null && scope.departmentIds().contains(p.departmentId());
  }

  @Transactional
  public Milestone updateMilestone(String pkg, String id, MilestoneDraft d) {
    var p = s.write(pkg, "buyer:agency:plan:manage");
    var old = s.data.milestone(s.guard.tenant(), id);
    if (old == null || !pkg.equals(old.packageId())) throw new IllegalArgumentException("计划节点不存在");
    s.expected(old.version(), d.expectedVersion());
    s.text(d.title(), 200, true, "节点名称");
    s.text(d.reason(), 1000, true, "调整原因");
    s.text(d.resultNote(), 2000, false, "完成结果");
    s.text(d.materialRequirement(), 2000, false, "材料要求");
    if (d.ownerId() == null
        || directory.people().stream().noneMatch(u -> u.id().equals(d.ownerId()))
        || !userVisible(p, d.ownerId())) throw new IllegalArgumentException("责任人须为可访问本项目的有效人员");
    if (d.status() == null
        || !Set.of("planned", "doing", "completed", "cancelled", "not_applicable")
            .contains(d.status())) throw new IllegalArgumentException("计划状态不合法");
    if (d.startsAt() != null && d.dueAt() != null && d.startsAt().isAfter(d.dueAt()))
      throw new IllegalArgumentException("计划起止时间不合法");
    boolean legalChanged =
        !Objects.equals(d.legalDeadline(), old.legalDeadline())
            || !Objects.equals(d.legalBasis(), old.legalBasis())
            || old.legalDeadline() != null
                && Set.of("cancelled", "not_applicable").contains(d.status());
    if (legalChanged) {
      s.guard.permissions().require("buyer:agency:plan:legal");
      s.text(d.legalBasis(), 2000, true, "法定期限依据或例外授权");
    }
    var nodes = s.data.milestones(s.guard.tenant(), pkg);
    List<String> dependencies = d.dependencies() == null ? List.of() : d.dependencies();
    if (dependencies.size() > 30
        || dependencies.contains(id)
        || new HashSet<>(dependencies).size() != dependencies.size()
        || dependencies.stream().anyMatch(dep -> nodes.stream().noneMatch(n -> n.id().equals(dep))))
      throw new IllegalArgumentException("依赖节点无效");
    Map<String, List<String>> graph = new HashMap<>();
    for (var node : nodes)
      graph.put(node.id(), Arrays.asList(s.json.read(node.dependenciesJson(), String[].class)));
    graph.put(id, dependencies);
    checkCycle(id, graph, new HashSet<>(), new HashSet<>());
    if (d.status().equals("completed")) {
      s.text(d.resultNote(), 2000, true, "完成结果或凭证说明");
      for (String dep : dependencies)
        if (nodes.stream()
            .filter(n -> n.id().equals(dep))
            .noneMatch(
                n -> Set.of("completed", "not_applicable", "cancelled").contains(n.status())))
          throw new IllegalStateException("前置依赖尚未完成");
    }
    s.data.milestoneUpdate(s.guard.tenant(), id, old.version(), d, s.json.write(dependencies));
    var result = s.data.milestone(s.guard.tenant(), id);
    s.event(pkg, "milestone", id, old, result, d.reason());
    return result;
  }

  private void checkCycle(
      String id, Map<String, List<String>> graph, Set<String> visiting, Set<String> done) {
    if (done.contains(id)) return;
    if (!visiting.add(id)) throw new IllegalArgumentException("计划依赖形成循环");
    for (String dep : graph.getOrDefault(id, List.of())) checkCycle(dep, graph, visiting, done);
    visiting.remove(id);
    done.add(id);
  }

  public Preparation preparation(String pkg) {
    var p = s.data.preparation(s.guard.tenant(), pkg);
    if (p == null) return null;
    if (s.guard.permissions().currentUserHas("buyer:agency:preparation:confidential")) return p;
    return new Preparation(
        p.tenantId(),
        p.packageId(),
        p.venue(),
        p.scheduledAt(),
        p.materialNotes(),
        "受限资料",
        "受限资料",
        null,
        p.version(),
        p.updatedBy(),
        p.updatedAt(),
        p.scheduledEndAt(),
        p.purpose());
  }

  @Transactional
  public Preparation prepare(String pkg, PreparationDraft d) {
    s.write(pkg, "buyer:agency:preparation:manage");
    s.guard.permissions().require("buyer:agency:preparation:confidential");
    var old = s.data.preparation(s.guard.tenant(), pkg);
    s.expected(old == null ? 0 : old.version(), d.expectedVersion());
    for (String text :
        Arrays.asList(d.venue(), d.materialNotes(), d.committeeNotes(), d.drawNotes(), d.purpose()))
      s.text(text, 6000, false, "会前资料");
    if (d.evidenceVersionId() != null && !d.evidenceVersionId().isBlank())
      s.sourceVersion(d.evidenceVersionId(), pkg);
    d =
        new PreparationDraft(
            d.expectedVersion(),
            s.str(d.venue()),
            d.scheduledAt(),
            s.str(d.materialNotes()),
            s.str(d.committeeNotes()),
            s.str(d.drawNotes()),
            d.evidenceVersionId(),
            d.scheduledEndAt(),
            s.str(d.purpose()));
    if (d.scheduledAt() != null) {
      if (d.venue().isBlank()
          || d.scheduledEndAt() == null
          || !d.scheduledEndAt().isAfter(d.scheduledAt()))
        throw new IllegalArgumentException("场地预订须填写场地和有效起止时间");
      s.text(d.purpose(), 1000, true, "场地用途");
      s.packages.lockRequest(
          s.guard.tenant(), "venue:" + d.venue().strip().toLowerCase(Locale.ROOT));
      if (s.data.venueConflicts(
              s.guard.tenant(), pkg, d.venue(), d.scheduledAt(), d.scheduledEndAt())
          > 0) throw new IllegalStateException("该场地时段已有内部预订，请调整时间或场地");
    } else if (d.scheduledEndAt() != null) throw new IllegalArgumentException("场地结束时间不能缺少开始时间");
    s.data.preparationSave(s.guard.tenant(), pkg, d, s.guard.actor());
    var result = s.data.preparation(s.guard.tenant(), pkg);
    s.event(pkg, "preparation", pkg, old, result, "维护实际人员、材料及外部抽取依据，不宣称已对接专家库");
    return result;
  }

  @Transactional
  public Milestone createMilestone(String pkg, MilestoneDraft d) {
    var p = s.write(pkg, "buyer:agency:plan:manage");
    plans.ensure(p);
    String id = "agency-plan-" + UUID.randomUUID();
    s.data.milestoneCreate(
        s.guard.tenant(),
        id,
        pkg,
        "custom_" + UUID.randomUUID().toString().replace("-", ""),
        d.title(),
        d.ownerId(),
        "[]",
        s.str(d.materialRequirement()),
        0);
    return updateMilestone(
        pkg,
        id,
        new MilestoneDraft(
            1L,
            d.title(),
            d.ownerId(),
            d.startsAt(),
            d.dueAt(),
            d.dependencies(),
            d.materialRequirement(),
            d.status(),
            d.resultNote(),
            d.reason(),
            d.legalDeadline(),
            d.legalBasis()));
  }

  public PlanTemplate planTemplate(String method) {
    s.guard.permissions().require("buyer:agency:plan:read");
    if (!com.procurement.agency.domain.AgencyPolicy.METHODS.contains(method))
      throw new IllegalArgumentException("采购方式不合法");
    return s.data.planTemplate(s.guard.tenant(), method);
  }

  @Transactional
  public PlanTemplate savePlanTemplate(
      String method, Long expected, List<PlanNode> nodes, String reason) {
    s.guard.permissions().require("buyer:agency:plan:configure");
    s.text(reason, 2000, true, "计划模板调整原因");
    if (!com.procurement.agency.domain.AgencyPolicy.METHODS.contains(method)
        || nodes == null
        || nodes.isEmpty()
        || nodes.size() > 30) throw new IllegalArgumentException("采购方式或计划节点不合法");
    s.packages.lockRequest(s.guard.tenant(), "plan-template:" + method);
    var old = s.data.planTemplate(s.guard.tenant(), method);
    s.expected(old == null ? 0 : old.version(), expected);
    Map<String, List<String>> graph = new HashMap<>();
    for (var n : nodes) {
      if (n == null) throw new IllegalArgumentException("计划模板节点不能为空");
      if (n.key() == null
          || !n.key().matches("[a-z][a-z0-9_]{0,49}")
          || graph.put(n.key(), n.dependencies() == null ? List.of() : n.dependencies()) != null)
        throw new IllegalArgumentException("计划模板节点编码重复或不合法");
      s.text(n.title(), 200, true, "节点标题");
      s.text(n.materialRequirement(), 2000, false, "材料要求");
    }
    for (String key : graph.keySet()) {
      if (graph.get(key).stream().anyMatch(dep -> !graph.containsKey(dep)))
        throw new IllegalArgumentException("模板依赖不存在");
      checkCycle(key, graph, new HashSet<>(), new HashSet<>());
    }
    var normalized =
        nodes.stream()
            .map(
                n ->
                    new PlanNode(
                        n.key(),
                        n.title(),
                        n.dependencies() == null ? List.of() : n.dependencies(),
                        s.str(n.materialRequirement()),
                        normalizeReminder(n.reminders())))
            .toList();
    s.data.planTemplateCreate(
        s.guard.tenant(),
        method,
        old == null ? 1 : old.version() + 1,
        s.json.write(normalized),
        reason,
        s.guard.actor());
    return s.data.planTemplate(s.guard.tenant(), method);
  }

  private ReminderSettings normalizeReminder(ReminderSettings value) {
    var policy = com.procurement.agency.domain.AgencyReminderRules.normalize(value);
    if (policy.escalationUserId() != null
        && (directory.people().stream().noneMatch(u -> u.id().equals(policy.escalationUserId()))
            || !s.guard.permissions().userHas(policy.escalationUserId(), "buyer:agency:plan:read")))
      throw new IllegalArgumentException("模板升级接收人须为本公司可查看项目计划的有效人员");
    return policy;
  }
}
