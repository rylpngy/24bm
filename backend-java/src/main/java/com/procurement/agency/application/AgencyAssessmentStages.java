package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.domain.AgencyOpeningRecords.*;
import com.procurement.agency.infrastructure.AgencyOpeningMapper;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyAssessmentStages {
  private final AgencyAssessmentContext c;
  private final AgencyOpeningMapper data;
  private final com.procurement.agency.infrastructure.AgencyFinalQuoteMapper finalQuotes;

  public AgencyAssessmentStages(
      AgencyAssessmentContext c,
      AgencyOpeningMapper data,
      com.procurement.agency.infrastructure.AgencyFinalQuoteMapper finalQuotes) {
    this.c = c;
    this.data = data;
    this.finalQuotes = finalQuotes;
  }

  public static String group(Criterion r) {
    return switch (r.stage()) {
      case "qualification" -> "qualification";
      case "conformity" -> "conformity";
      default -> "evaluation";
    };
  }

  public static List<String> order(
      com.procurement.agency.domain.AgencyEvaluationRecords.Config config, String method) {
    Set<String> groups = new HashSet<>();
    config.rules().forEach(r -> groups.add(group(r.configuredRule())));
    if (Set.of("公开招标", "邀请招标").contains(method)
        && (!groups.contains("qualification") || !groups.contains("conformity")))
      throw new IllegalStateException("招标方式须在定稿规则中明确资格及符合性审查，不能跳过或自动补造");
    return List.of("qualification", "conformity", "evaluation").stream()
        .filter(groups::contains)
        .toList();
  }

  public List<String> assigned(
      com.procurement.agency.domain.AgencyEvaluationRecords.Config config, String user) {
    Set<String> groups = new HashSet<>();
    AgencyAssessmentPolicy.assigned(config, user).forEach(r -> groups.add(group(r)));
    return List.of("qualification", "conformity", "evaluation").stream()
        .filter(groups::contains)
        .toList();
  }

  public String select(String session, String user, String requested) {
    var sheets = c.data.sheets(c.s.guard.tenant(), session, user);
    var available =
        List.of("qualification", "conformity", "evaluation", "legacy").stream()
            .filter(stage -> sheets.stream().anyMatch(s -> s.stageKey().equals(stage)))
            .toList();
    if (available.isEmpty())
      throw new com.procurement.common.tenant.PermissionDeniedException("当前账号没有本人任务");
    String stage = requested == null || requested.isBlank() ? available.getFirst() : requested;
    if (!available.contains(stage))
      throw new com.procurement.common.tenant.PermissionDeniedException("当前账号没有该阶段任务");
    return stage;
  }

  public List<Criterion> criteria(
      com.procurement.agency.domain.AgencyEvaluationRecords.Config cfg, String user, String stage) {
    return AgencyAssessmentPolicy.assigned(cfg, user).stream()
        .filter(r -> stage.equals("legacy") || group(r).equals(stage))
        .toList();
  }

  public Release released(String session, String stage) {
    return data.stages(c.s.guard.tenant(), session).stream()
        .filter(r -> r.stageKey().equals(stage))
        .findFirst()
        .orElse(null);
  }

  public List<Subject> subjects(String session, String stage, List<Subject> original) {
    var release = released(session, stage);
    return release == null
        ? original
        : Arrays.asList(c.s.json.read(release.subjectsJson(), Subject[].class));
  }

  public void initial(
      String pkg,
      Session session,
      com.procurement.agency.domain.AgencyEvaluationRecords.Config cfg) {
    var stages = order(cfg, c.s.packages.find(c.s.guard.tenant(), pkg).procurementMethod());
    if (stages.isEmpty()) throw new IllegalStateException("没有可开放的评审阶段");
    data.release(
        new Release(
            "agency-stage-" + UUID.randomUUID(),
            c.s.guard.tenant(),
            session.id(),
            stages.getFirst(),
            session.subjectsJson(),
            session.roundHash(),
            session.openingEvidenceVersionId(),
            session.openingHash(),
            "依据正式开启快照开放首阶段",
            "{}",
            c.s.guard.actor(),
            null));
  }

  public void writable(String session, String stage) {
    if (stage.equals("legacy") || released(session, stage) == null)
      throw new IllegalStateException("本阶段尚未经有权人员开放；历史无阶段任务只读保留");
  }

  public void correctionAllowed(
      String session,
      Sheet sheet,
      com.procurement.agency.domain.AgencyEvaluationRecords.Config config) {
    if (finalQuotes != null && finalQuotes.campaign(c.s.guard.tenant(), session) != null)
      throw new IllegalStateException("已发起最后报价，不能更改其上游意见；须按异常程序另行组织");
    var sequence =
        order(
            config,
            c.s
                .packages
                .find(c.s.guard.tenant(), c.data.session(c.s.guard.tenant(), session).packageId())
                .procurementMethod());
    int index = sequence.indexOf(sheet.stageKey());
    if (index < 0) throw new IllegalStateException("历史无阶段任务不支持继续更正");
    if (sequence.subList(index + 1, sequence.size()).stream()
        .anyMatch(stage -> released(session, stage) != null))
      throw new IllegalStateException("后续阶段已开放，不能直接更正上游意见；须按异常程序另行组织");
  }

  private record State(boolean complete, List<Sheet> sheets, List<Subject> subjects, String hash) {}

  private State state(AgencyAssessmentContext.Access a, String stage) {
    var release = released(a.session().id(), stage);
    if (release == null) return new State(false, List.of(), List.of(), "");
    List<Sheet> sheets = new ArrayList<>();
    boolean complete = true;
    for (var m : a.config().members())
      if (!criteria(a.config(), m.userId(), stage).isEmpty()) {
        var sheet = c.latest(a.session().id(), m.userId(), stage);
        sheets.add(sheet);
        if (!sheet.status().equals("submitted")) complete = false;
        if (c.data.corrections(c.s.guard.tenant(), a.session().id(), m.userId()).stream()
            .anyMatch(r -> r.status().equals("processing") && r.sheetId().equals(sheet.id())))
          complete = false;
      }
    var subjects = subjects(a.session().id(), stage, a.subjects());
    String hash =
        c.s.json.hash(
            sheets.stream()
                .map(
                    s ->
                        Map.of(
                            "id",
                            s.id(),
                            "version",
                            s.version(),
                            "status",
                            s.status(),
                            "hash",
                            Objects.toString(s.contentHash(), "")))
                .toList());
    return new State(complete, sheets, subjects, hash);
  }

  private boolean passed(State state, Subject subject) {
    for (var sheet : state.sheets())
      for (var e : c.entries(sheet))
        if (e.participationId().equals(subject.participationId())
            && e.conclusion() != null
            && !e.conclusion().isBlank()
            && !e.conclusion().equals("pass")) return false;
    return true;
  }

  public StageBoard board(String pkg, String session) {
    var a = c.access(pkg, session, false);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:stage:manage");
    var order = order(a.config(), c.s.packages.find(c.s.guard.tenant(), pkg).procurementMethod());
    List<StageView> list = new ArrayList<>();
    for (int i = 0; i < order.size(); i++) {
      String stage = order.get(i);
      var current = state(a, stage);
      var previous = i == 0 ? current : state(a, order.get(i - 1));
      var candidates =
          previous.complete()
              ? previous.subjects().stream()
                  .map(
                      s ->
                          new Candidate(s.participationId(), s.supplierName(), passed(previous, s)))
                  .toList()
              : List.<Candidate>of();
      list.add(
          new StageView(
              stage,
              released(session, stage) != null,
              current.complete(),
              candidates,
              previous.hash()));
    }
    return new StageBoard(list);
  }

  @Transactional
  public Release release(String pkg, String session, String stage, ReleaseDraft d) {
    var a = c.access(pkg, session, true);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:stage:manage");
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对前阶段意见、对象和处理依据");
    c.s.text(d.note(), 2000, true, "阶段核对说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "assessment-stage:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, stage, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Release.class);
    if (released(session, stage) != null) throw new IllegalStateException("本阶段已开放，不能覆盖原处理记录");
    var order = order(a.config(), c.s.packages.find(c.s.guard.tenant(), pkg).procurementMethod());
    int index = order.indexOf(stage);
    if (index < 1) throw new IllegalArgumentException("只能顺序开放后续阶段");
    State previous = state(a, order.get(index - 1));
    if (!previous.complete()) throw new IllegalStateException("前阶段意见尚未全部提交或存在待审更正，不能开放后续阶段");
    if (!previous.hash().equals(d.prerequisiteHash()))
      throw new com.procurement.agency.domain.AgencyConflictException("前阶段意见版本已变化，请重新核对");
    if (d.participationIds() == null
        || d.participationIds().isEmpty()
        || new HashSet<>(d.participationIds()).size() != d.participationIds().size())
      throw new IllegalArgumentException("须明确本阶段对象，不自动判定总体资格结论");
    Set<String> ids = new HashSet<>(d.participationIds());
    var openingPlan = data.plan(c.s.guard.tenant(), a.session().roundId());
    if (openingPlan != null
        && ids.size()
            < c.s
                .json
                .read(
                    openingPlan.configJson(),
                    com.procurement.agency.domain.AgencyOpeningRecords.Config.class)
                .minimumSubjects()) throw new IllegalStateException("进入对象数量不足已确认门槛，不能自动放宽条件");
    if (!previous.subjects().stream().map(Subject::participationId).toList().containsAll(ids))
      throw new IllegalArgumentException("对象超出前阶段范围");
    Map<String, String> exclusions = d.exclusions() == null ? Map.of() : d.exclusions();
    Set<String> omitted = new HashSet<>();
    for (var subject : previous.subjects())
      if (ids.contains(subject.participationId())) {
        if (!passed(previous, subject)) throw new IllegalStateException("包含前阶段不通过意见的对象不能直接进入后续阶段");
      } else {
        omitted.add(subject.participationId());
        c.s.text(exclusions.get(subject.participationId()), 2000, true, "未进入后阶段对象的处理依据");
      }
    if (!exclusions.keySet().equals(omitted))
      throw new IllegalArgumentException("排除说明须与未进入本阶段的对象逐一对应");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "阶段处理依据");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    var subjects =
        previous.subjects().stream().filter(s -> ids.contains(s.participationId())).toList();
    var row =
        new Release(
            "agency-stage-" + UUID.randomUUID(),
            c.s.guard.tenant(),
            session,
            stage,
            c.s.json.write(subjects),
            previous.hash(),
            d.evidenceVersionId(),
            proof.hash(),
            d.note(),
            c.s.json.write(exclusions),
            c.s.guard.actor(),
            null);
    data.release(row);
    c.s.event(
        pkg,
        "assessment_stage_opened",
        row.id(),
        null,
        Map.of("stage", stage, "count", subjects.size(), "prerequisiteHash", previous.hash()),
        d.note());
    c.s.remember(key, hash, row);
    return row;
  }
}
