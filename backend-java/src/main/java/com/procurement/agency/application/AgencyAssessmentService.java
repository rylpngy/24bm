package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.application.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyAssessmentService {
  private final AgencyAssessmentContext c;
  private final UnifiedWorkflowApplicationService workflows;
  private final AgencyAssessmentStages stages;
  private final com.procurement.agency.infrastructure.AgencyOpeningMapper openings;

  public AgencyAssessmentService(
      AgencyAssessmentContext c,
      UnifiedWorkflowApplicationService workflows,
      AgencyAssessmentStages stages,
      com.procurement.agency.infrastructure.AgencyOpeningMapper openings) {
    this.c = c;
    this.workflows = workflows;
    this.stages = stages;
    this.openings = openings;
  }

  public Overview overview(String pkg, String round) {
    var v = c.evaluations.roundForAssessment(pkg, round);
    var actor = c.s.guard.actor();
    if (v.config().members().stream().noneMatch(m -> m.userId().equals(actor)))
      throw new PermissionDeniedException("非冻结人员不能访问独立评审任务");
    var session = c.data.byRound(c.s.guard.tenant(), round);
    boolean organizer =
        c.s.guard.permissions().currentUserHas("buyer:agency:evaluation:organize")
            && v.config().members().stream()
                .anyMatch(
                    m ->
                        m.userId().equals(actor)
                            && (m.roles().contains("organizer") || m.roles().contains("leader")));
    var subjects =
        organizer
            ? c.s.data.participations(c.s.guard.tenant(), pkg).stream()
                .map(p -> Map.of("id", p.id(), "supplierName", p.supplierName()))
                .toList()
            : List.<Map<String, String>>of();
    return new Overview(session == null ? List.of() : List.of(session), subjects);
  }

  @Transactional
  public Session start(String pkg, String round, Start d) {
    c.s.guard.require(pkg, false);
    c.s.packages.lock(c.s.guard.tenant(), pkg);
    var p = c.s.guard.require(pkg, false);
    if (!p.status().equals("approved")
        || p.workflowId() != null
        || !p.operatingMode().equals("half")) throw new IllegalStateException("建档状态不允许启动独立评审");
    var v = c.evaluations.roundForAssessment(pkg, round);
    c.controls.requireWritable(round);
    c.organizer(v.config());
    if (d == null) throw new IllegalArgumentException("缺少评审对象及开启记录");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "assessment-start:" + d.idempotencyKey();
    String hash = c.s.begin(key, Arrays.asList(pkg, round, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Session.class);
    c.s.expected(v.round().version(), d.expectedRoundVersion());
    if (!v.round().status().equals("frozen") || v.frozenBasisStale() || !v.blockers().isEmpty())
      throw new IllegalStateException("须使用当前有效且无阻断项的冻结规则");
    if (!d.openingReviewed() || d.openedAt() == null || d.openedAt().isAfter(OffsetDateTime.now()))
      throw new IllegalArgumentException("须人工确认真实线下开启记录及非未来开启时间");
    c.s.text(d.note(), 2000, true, "开启与对象核对说明");
    if (d.participationIds() == null
        || d.participationIds().isEmpty()
        || d.participationIds().size() > 30
        || new HashSet<>(d.participationIds()).size() != d.participationIds().size())
      throw new IllegalArgumentException("须明确1至30个不同评审对象");
    c.s.publicProjectSource(d.openingEvidenceVersionId(), pkg, "线下开启凭证");
    var proof = c.s.source(d.openingEvidenceVersionId(), pkg);
    List<Subject> subjects = new ArrayList<>();
    for (String id : d.participationIds()) {
      var row = c.s.data.participation(c.s.guard.tenant(), id);
      if (row == null || !pkg.equals(row.packageId()))
        throw new IllegalArgumentException("评审对象不属于当前采购包");
      subjects.add(new Subject(id, row.supplierName()));
    }
    if (c.data.byRound(c.s.guard.tenant(), round) != null)
      throw new IllegalStateException("该轮次已有独立评审任务");
    var reviewers =
        v.config().members().stream()
            .filter(m -> !AgencyAssessmentPolicy.assigned(v.config(), m.userId()).isEmpty())
            .toList();
    if (reviewers.isEmpty()) throw new IllegalStateException("没有承担本轮审查或评分项的账号");
    var opening = openings.opening(c.s.guard.tenant(), round);
    if (opening == null) throw new IllegalStateException("须先完成受控材料接收及正式开启");
    var openedSubjects = Arrays.asList(c.s.json.read(opening.subjectsJson(), Subject[].class));
    if (!new HashSet<>(openedSubjects.stream().map(Subject::participationId).toList())
            .equals(new HashSet<>(d.participationIds()))
        || !opening.evidenceVersionId().equals(d.openingEvidenceVersionId())
        || !opening.openedAt().toInstant().equals(d.openedAt().toInstant()))
      throw new IllegalArgumentException("独立任务须与正式开启的对象、凭证及时间一致");
    subjects = new ArrayList<>(openedSubjects);
    String id = "agency-assessment-" + UUID.randomUUID();
    var session =
        new Session(
            id,
            c.s.guard.tenant(),
            pkg,
            round,
            v.round().frozenHash(),
            c.s.json.write(subjects),
            d.openingEvidenceVersionId(),
            proof.hash(),
            d.openedAt(),
            d.note(),
            c.s.guard.actor(),
            null);
    c.data.createSession(session);
    for (var m : reviewers)
      for (String stage : stages.assigned(v.config(), m.userId()))
        c.newDraft(c.s.guard.tenant(), id, m.userId(), stage, 1, "[]", null, null);
    stages.initial(pkg, session, v.config());
    var saved = c.data.session(c.s.guard.tenant(), id);
    c.s.event(
        pkg,
        "assessment_started",
        id,
        null,
        Map.of(
            "round",
            round,
            "subjectCount",
            subjects.size(),
            "reviewerCount",
            reviewers.size(),
            "openingHash",
            proof.hash()),
        d.note());
    c.s.remember(key, hash, saved);
    return saved;
  }

  public Mine mine(String pkg, String session, String requestedStage) {
    var a = c.access(pkg, session, false);
    c.s.guard.permissions().require("buyer:agency:evaluation:review");
    String stage = stages.select(session, c.s.guard.actor(), requestedStage);
    var criteria = stages.criteria(a.config(), c.s.guard.actor(), stage);
    var blockers = new ArrayList<>(a.blockers());
    if (stages.released(session, stage) == null) blockers.add("本阶段尚未开放");
    if (criteria.isEmpty()) throw new PermissionDeniedException("当前职责没有独立评审项");
    return new Mine(
        a.session(),
        c.data.sheets(c.s.guard.tenant(), session, c.s.guard.actor()).stream()
            .map(Sheet::stageKey)
            .distinct()
            .sorted()
            .toList(),
        stage,
        stages.subjects(session, stage, a.subjects()),
        criteria,
        c.history(session, c.s.guard.actor(), stage),
        c.data.corrections(c.s.guard.tenant(), session, c.s.guard.actor()).stream()
            .filter(r -> c.data.sheet(c.s.guard.tenant(), r.sheetId()).stageKey().equals(stage))
            .toList(),
        blockers.isEmpty(),
        blockers);
  }

  private void correctionScope(Sheet sheet, List<Entry> entries) {
    if (sheet.previousId() != null) {
      var auth = c.data.correction(c.s.guard.tenant(), sheet.correctionId());
      if (auth == null || !auth.status().equals("approved"))
        throw new IllegalStateException("更正授权失效");
      AgencyAssessmentPolicy.correctionScope(
          c.entries(c.data.sheet(c.s.guard.tenant(), sheet.previousId())), entries, c.cells(auth));
    }
  }

  @Transactional
  public Sheet save(String pkg, String session, String requestedStage, SheetSave d) {
    var a = c.access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:review");
    String stage = stages.select(session, c.s.guard.actor(), requestedStage);
    stages.writable(session, stage);
    var old = c.latest(session, c.s.guard.actor(), stage);
    if (d == null) throw new IllegalArgumentException("缺少个人意见");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "assessment-save:" + d.idempotencyKey();
    String hash = c.s.begin(key, Arrays.asList(session, stage, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Sheet.class);
    c.s.expected(old.version(), d.expectedVersion());
    if (!old.status().equals("draft")) throw new IllegalStateException("已提交意见锁定，须申请受控更正");
    AgencyAssessmentPolicy.validate(
        stages.subjects(session, stage, a.subjects()),
        stages.criteria(a.config(), c.s.guard.actor(), stage),
        d.entries(),
        false);
    correctionScope(old, d.entries());
    if (c.data.save(c.s.guard.tenant(), old.id(), old.version(), c.s.json.write(d.entries())) != 1)
      throw new IllegalStateException("个人意见版本冲突");
    var after = c.data.sheet(c.s.guard.tenant(), old.id());
    c.trace(pkg, "assessment_draft", old, after);
    c.s.remember(key, hash, after);
    return after;
  }

  @Transactional
  public Sheet submit(String pkg, String session, String requestedStage, Submit d) {
    var a = c.access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:review");
    String stage = stages.select(session, c.s.guard.actor(), requestedStage);
    stages.writable(session, stage);
    var old = c.latest(session, c.s.guard.actor(), stage);
    if (d == null || !d.personallyConfirmed()) throw new IllegalArgumentException("须本人复核后确认独立提交");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "assessment-submit:" + d.idempotencyKey();
    String hash = c.s.begin(key, Arrays.asList(session, stage, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Sheet.class);
    c.s.expected(old.version(), d.expectedVersion());
    if (!old.status().equals("draft")) throw new IllegalStateException("意见已提交锁定");
    var entries = c.entries(old);
    AgencyAssessmentPolicy.validate(
        stages.subjects(session, stage, a.subjects()),
        stages.criteria(a.config(), c.s.guard.actor(), stage),
        entries,
        true);
    correctionScope(old, entries);
    String fingerprint =
        c.s.json.hash(
            Map.of(
                "reviewerId",
                old.userId(),
                "session",
                session,
                "roundHash",
                a.session().roundHash(),
                "stage",
                stage,
                "ordinal",
                old.ordinal(),
                "entries",
                entries));
    if (c.data.submit(c.s.guard.tenant(), old.id(), old.version(), fingerprint) != 1)
      throw new IllegalStateException("个人意见版本冲突");
    var after = c.data.sheet(c.s.guard.tenant(), old.id());
    c.trace(pkg, "assessment_submitted", old, after);
    c.s.remember(key, hash, after);
    return after;
  }

  public List<Progress> progress(String pkg, String session) {
    var a = c.access(pkg, session, false);
    c.organizer(a.config());
    List<Progress> rows = new ArrayList<>();
    var snapshot = c.rounds.round(c.s.guard.tenant(), a.session().roundId());
    var names =
        Arrays.asList(
            c.s.json.read(
                c.s.json.tree(snapshot.frozenJson()).path("basis").path("members").toString(),
                MemberSnapshot[].class));
    for (var member : a.config().members())
      if (!AgencyAssessmentPolicy.assigned(a.config(), member.userId()).isEmpty()) {
        var userSheets = c.data.sheets(c.s.guard.tenant(), session, member.userId());
        for (String stage :
            userSheets.stream().anyMatch(v -> v.stageKey().equals("legacy"))
                ? List.of("legacy")
                : stages.assigned(a.config(), member.userId())) {
          var sheet = c.latest(session, member.userId(), stage);
          rows.add(
              new Progress(
                  member.userId(),
                  names.stream()
                      .filter(m -> m.userId().equals(member.userId()))
                      .findFirst()
                      .map(MemberSnapshot::name)
                      .orElse(member.userId()),
                  sheet.status(),
                  sheet.ordinal(),
                  stage));
        }
      }
    return rows;
  }

  @Transactional
  public Correction correction(
      String pkg, String session, String requestedStage, CorrectionDraft d) {
    var a = c.access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:review");
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:request");
    String stage = stages.select(session, c.s.guard.actor(), requestedStage);
    stages.writable(session, stage);
    var old = c.latest(session, c.s.guard.actor(), stage);
    if (d == null) throw new IllegalArgumentException("缺少更正申请");
    c.s.text(d.reason(), 2000, true, "更正原因");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "assessment-correction:" + d.idempotencyKey();
    String hash = c.s.begin(key, Arrays.asList(session, stage, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Correction.class);
    c.s.expected(old.version(), d.expectedVersion());
    if (!old.status().equals("submitted")) throw new IllegalStateException("只能为本人已提交的最新意见申请更正");
    stages.correctionAllowed(session, old, a.config());
    var originals =
        c.entries(old).stream().map(e -> new Cell(e.participationId(), e.criterionKey())).toList();
    if (d.cells() == null
        || d.cells().isEmpty()
        || d.cells().size() > 3000
        || new HashSet<>(d.cells()).size() != d.cells().size()
        || !originals.containsAll(d.cells()))
      throw new IllegalArgumentException("更正范围须为本人的原提交项目，且不能重复");
    if (c.data.corrections(c.s.guard.tenant(), session, c.s.guard.actor()).stream()
        .anyMatch(x -> x.status().equals("processing")))
      throw new IllegalStateException("已有待审更正申请");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "更正依据");
    var evidence = c.s.source(d.evidenceVersionId(), pkg);
    String id = "agency-correction-" + UUID.randomUUID();
    var row =
        new Correction(
            id,
            c.s.guard.tenant(),
            session,
            old.id(),
            old.userId(),
            old.version(),
            old.contentHash(),
            c.s.json.write(d.cells()),
            d.reason(),
            d.evidenceVersionId(),
            evidence.hash(),
            "processing",
            null,
            "",
            null);
    c.data.createCorrection(row);
    Map<String, Object> snap = new TreeMap<>();
    snap.put("packageId", pkg);
    snap.put("sessionId", session);
    snap.put("requestId", id);
    snap.put("sheetId", old.id());
    snap.put("reviewerId", old.userId());
    snap.put("sheetHash", old.contentHash());
    snap.put("cells", d.cells());
    snap.put("reason", d.reason());
    snap.put("evidenceVersionId", d.evidenceVersionId());
    snap.put("evidenceHash", evidence.hash());
    var wf =
        workflows.start(
            new WorkflowStartCommand(
                "agency_assessment_correction",
                id,
                c.s.packages.find(c.s.guard.tenant(), pkg).departmentId(),
                null,
                d.formData() == null ? Map.of() : d.formData(),
                snap));
    if (c.data.bind(c.s.guard.tenant(), id, wf.workflowInstanceId()) != 1)
      throw new IllegalStateException("更正审批绑定失败");
    var saved = c.data.correction(c.s.guard.tenant(), id);
    c.s.event(pkg, "assessment_correction_requested", id, null, snap, d.reason());
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public void withdraw(String pkg, String session, String id, String reason) {
    c.access(pkg, session, false);
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:request");
    var row = c.data.correction(c.s.guard.tenant(), id);
    if (row == null || !row.sessionId().equals(session) || !row.userId().equals(c.s.guard.actor()))
      throw new PermissionDeniedException("仅本人可撤回更正申请");
    workflows.withdrawAgencyExecution(row.workflowId(), reason);
  }
}
