package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyDiscussionRecords.*;
import com.procurement.agency.infrastructure.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyDiscussionService {
  private final AgencyAssessmentContext c;
  private final AgencyAssessmentStages stages;
  private final AgencyDiscussionMapper data;
  private final AgencyFinalQuoteMapper finals;
  private final AgencyRequirementChangeService changes;

  public AgencyDiscussionService(
      AgencyAssessmentContext c,
      AgencyAssessmentStages stages,
      AgencyDiscussionMapper data,
      AgencyFinalQuoteMapper finals,
      AgencyRequirementChangeService changes) {
    this.c = c;
    this.stages = stages;
    this.data = data;
    this.finals = finals;
    this.changes = changes;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:discussion:read");
    if (write) c.s.guard.permissions().require("buyer:agency:evaluation:discussion:manage");
    AgencyDiscussionPolicy.method(c.s.packages.find(tenant(), pkg).procurementMethod());
    return a;
  }

  private void noFinal(String session) {
    if (finals.campaign(tenant(), session) != null)
      throw new IllegalStateException("最后报价已发起，逐家沟通过程只读保留，不得倒改依据");
  }

  private List<Subject> candidates(AgencyAssessmentContext.Access a) {
    if (stages.released(a.session().id(), "evaluation") == null)
      throw new IllegalStateException("须先按冻结规则完成前置审查并开放评审阶段");
    return stages.subjects(a.session().id(), "evaluation", a.subjects());
  }

  private List<Subject> subjects(Plan p) {
    return Arrays.asList(c.s.json.read(p.subjectsJson(), Subject[].class));
  }

  private Plan active(AgencyAssessmentContext.Access a) {
    var p = data.plan(tenant(), a.session().id());
    if (p == null || !p.mode().equals("active")) throw new IllegalStateException("须先启用并核对逐家沟通范围");
    integrity(p, a);
    return p;
  }

  private void integrity(Plan p, AgencyAssessmentContext.Access a) {
    if (p != null
        && p.mode().equals("active")
        && (!c.s.json.hash(c.s.json.read(p.basisJson(), Map.class)).equals(p.frozenHash())
            || !c.s
                .json
                .tree(p.basisJson())
                .path("roundHash")
                .asText()
                .equals(a.session().roundHash())
            || !c.s
                .json
                .tree(p.basisJson())
                .path("subjects")
                .equals(c.s.json.tree(p.subjectsJson()))))
      throw new IllegalStateException("逐家沟通计划冻结指纹不一致");
  }

  private Subject subject(Plan p, String participant) {
    return subjects(p).stream()
        .filter(s -> s.participationId().equals(participant))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("对象不在已启用的逐家沟通范围"));
  }

  private Row require(String session, String participant, String id) {
    var r = data.row(tenant(), id);
    if (r == null || !r.sessionId().equals(session) || !r.participationId().equals(participant))
      throw new IllegalArgumentException("沟通记录不属于当前对象或任务");
    return r;
  }

  private Row latest(List<Row> rows) {
    return rows.stream().filter(r -> r.status().equals("confirmed")).findFirst().orElse(null);
  }

  private Content content(Row r) {
    return c.s.json.read(r.contentJson(), Content.class);
  }

  private void rowIntegrity(Row r) {
    if (r.status().equals("confirmed")
        && (!c.s.json.hash(c.s.json.read(r.frozenJson(), Map.class)).equals(r.frozenHash())
            || !c.s
                .json
                .tree(r.frozenJson())
                .path("content")
                .equals(c.s.json.tree(r.contentJson()))))
      throw new IllegalStateException("已确认沟通记录指纹不一致");
  }

  public Gate gate(AgencyAssessmentContext.Access a) {
    var p = data.plan(tenant(), a.session().id());
    integrity(p, a);
    var rows = data.records(tenant(), a.session().id());
    rows.forEach(this::rowIntegrity);
    String mode = p == null ? "required" : p.mode();
    List<String> blockers = new ArrayList<>();
    if (mode.equals("required")) blockers.add("新任务须启用逐家谈判/磋商计划并记录过程，不能直接发起最后报价");
    if (rows.stream().anyMatch(r -> r.status().equals("draft")))
      blockers.add("仍有未确认沟通草稿，须确认或有依据作废，不得跳过");
    var changeGate = changes.gate(a);
    blockers.addAll(changeGate.blockers());
    if (rows.stream()
        .anyMatch(
            r ->
                r.status().equals("confirmed")
                    && "requires_authorized_change".equals(content(r).changeDisposition())
                    && !changeGate.covered().contains(r.id())))
      blockers.add("沟通中记录了待有权确认的需求调整；须完成有权确认及全部冻结参与者的同一通知凭证核对，不能通过追加无调整记录或排除对象绕过");
    String fingerprint =
        c.s.json.hash(
            Arrays.asList(
                mode, p, a.session().roundHash(), rows, c.controls.marker(a.session().roundId())));
    if (!changeGate.changes().isEmpty())
      fingerprint = c.s.json.hash(Arrays.asList(fingerprint, changeGate.fingerprint()));
    return new Gate(mode, fingerprint, blockers);
  }

  public List<Reference> finalManifest(
      AgencyAssessmentContext.Access a,
      List<String> ids,
      String expectedFingerprint,
      OffsetDateTime initiatedAt) {
    var g = gate(a);
    if (!g.mode().equals("legacy") || expectedFingerprint != null && !expectedFingerprint.isBlank())
      if (!Objects.equals(g.fingerprint(), expectedFingerprint))
        throw new AgencyConflictException("逐家沟通或轮次控制版本已变化，请重新核对最后报价发起条件");
    if (!g.blockers().isEmpty()) throw new IllegalStateException(String.join("；", g.blockers()));
    if (g.mode().equals("legacy")) return List.of();
    var p = active(a);
    List<Reference> out = new ArrayList<>();
    for (String id : ids) {
      var s = subject(p, id);
      var latest = latest(data.supplier(tenant(), a.session().id(), id));
      if (latest == null)
        throw new IllegalStateException(s.supplierName() + "尚无确认的逐家沟通记录，不能发起最后报价");
      if (content(latest).endedAt().isAfter(initiatedAt))
        throw new IllegalArgumentException("最后报价发起不得早于所选对象最后一次确认沟通结束");
      out.add(new Reference(id, latest.id(), latest.ordinal(), latest.frozenHash()));
    }
    return out;
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var p = data.plan(tenant(), session);
    var gate = gate(a);
    List<String> blockers = new ArrayList<>(a.blockers());
    List<Subject> candidates = List.of();
    try {
      candidates = p != null && p.mode().equals("active") ? subjects(p) : candidates(a);
    } catch (IllegalStateException e) {
      blockers.add(e.getMessage());
    }
    if (finals.campaign(tenant(), session) != null) blockers.add("最后报价已发起，逐家沟通只读保留");
    var coveredChanges = changes.gate(a).covered();
    List<Progress> progress = new ArrayList<>();
    for (var s : candidates) {
      var rows = data.supplier(tenant(), session, s.participationId());
      var last = latest(rows);
      progress.add(
          new Progress(
              s.participationId(),
              s.supplierName(),
              (int) rows.stream().filter(r -> r.status().equals("confirmed")).count(),
              rows.stream().anyMatch(r -> r.status().equals("draft")),
              rows.stream()
                  .anyMatch(
                      r ->
                          r.status().equals("confirmed")
                              && "requires_authorized_change".equals(content(r).changeDisposition())
                              && !coveredChanges.contains(r.id())),
              last == null
                  ? null
                  : new Reference(
                      s.participationId(), last.id(), last.ordinal(), last.frozenHash())));
    }
    blockers.addAll(gate.blockers());
    return new Workspace(
        p,
        gate.mode(),
        gate.fingerprint(),
        candidates,
        progress,
        blockers.stream().distinct().toList(),
        a.session().openedAt());
  }

  public Ledger ledger(String pkg, String session, String participant) {
    var a = access(pkg, session, false);
    var p = active(a);
    var subject = subject(p, participant);
    var rows = data.supplier(tenant(), session, participant);
    rows.forEach(this::rowIntegrity);
    List<String> blockers = new ArrayList<>(a.blockers());
    if (finals.campaign(tenant(), session) != null) blockers.add("最后报价已发起，不能改写过程依据");
    return new Ledger(subject, rows, blockers);
  }

  @Transactional
  public Plan activate(String pkg, String session, Activate d) {
    var a = access(pkg, session, true);
    noFinal(session);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对逐家沟通适用方式、对象及依据");
    c.s.text(d.reason(), 2000, true, "逐家沟通启用依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "discussion-activate:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Plan.class);
    var old = data.plan(tenant(), session);
    c.s.expected(old == null ? 0 : old.version(), d.expectedVersion());
    if (old != null && old.mode().equals("active"))
      throw new IllegalStateException("逐家沟通计划已启用并锁定，不可覆盖");
    var subjects = candidates(a);
    if (subjects.isEmpty()) throw new IllegalStateException("没有可确认的沟通对象");
    c.s.publicProjectSource(d.evidenceVersionId(), pkg, "脱敏逐家沟通启用凭证");
    var proof = c.s.source(d.evidenceVersionId(), pkg);
    String raw =
        c.s.json.write(
            Map.of(
                "roundHash",
                a.session().roundHash(),
                "subjects",
                subjects,
                "evidenceVersionId",
                d.evidenceVersionId(),
                "evidenceHash",
                proof.hash(),
                "reason",
                d.reason()));
    String frozenHash = c.s.json.hash(c.s.json.read(raw, Map.class));
    if (old == null)
      data.createPlan(
          new Plan(
              tenant(),
              session,
              pkg,
              "active",
              1,
              c.s.json.write(subjects),
              raw,
              frozenHash,
              c.s.guard.actor(),
              null));
    else if (data.activate(
            tenant(),
            session,
            old.version(),
            c.s.json.write(subjects),
            raw,
            frozenHash,
            c.s.guard.actor())
        != 1) throw new AgencyConflictException("沟通启用版本已变化");
    var saved = data.plan(tenant(), session);
    c.s.event(
        pkg,
        "supplier_discussion_enabled",
        session,
        null,
        Map.of("planHash", frozenHash),
        "逐家沟通范围已启用，不能退回旧人工过程路径");
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Row save(String pkg, String session, String participant, Save d) {
    var a = access(pkg, session, true);
    noFinal(session);
    var p = active(a);
    subject(p, participant);
    if (d == null) throw new IllegalArgumentException("缺少沟通草稿");
    var members = new HashSet<>(a.config().members().stream().map(m -> m.userId()).toList());
    AgencyDiscussionPolicy.validate(
        d.content(), members, a.session().openedAt(), OffsetDateTime.now(), false);
    c.s.text(d.reason(), 2000, true, "草稿维护说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "discussion-save:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, participant, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Row.class);
    Row row;
    if (d.recordId() == null || d.recordId().isBlank()) {
      c.s.expected(0, d.expectedVersion());
      var rows = data.supplier(tenant(), session, participant);
      if (rows.stream().anyMatch(r -> r.status().equals("draft")))
        throw new IllegalStateException("本对象已有沟通草稿，先续写或有依据作废");
      if (rows.size() >= 100 || data.records(tenant(), session).size() >= 1000)
        throw new IllegalStateException("达到技术存储上限：每对象100条、每任务1000条；不是固定业务轮数");
      var previous = latest(rows);
      row =
          new Row(
              "agency-discussion-" + UUID.randomUUID(),
              tenant(),
              session,
              participant,
              rows.isEmpty() ? 1 : rows.getFirst().ordinal() + 1,
              previous == null ? null : previous.id(),
              "draft",
              1,
              c.s.json.write(d.content()),
              null,
              null,
              c.s.guard.actor(),
              null,
              null,
              null,
              null);
      data.create(row);
    } else {
      row = require(session, participant, d.recordId());
      c.s.expected(row.version(), d.expectedVersion());
      if (data.save(tenant(), row.id(), row.version(), c.s.json.write(d.content())) != 1)
        throw new IllegalStateException("沟通记录已确认或作废，不覆盖历史；请追加过程或按异常程序处理");
    }
    var saved = data.row(tenant(), row.id());
    c.s.event(
        pkg,
        "supplier_discussion_draft_saved",
        saved.id(),
        null,
        Map.of(
            "ordinal",
            saved.ordinal(),
            "version",
            saved.version(),
            "contentHash",
            c.s.json.hash(d.content())),
        "逐家沟通草稿按对象隔离，业务事件不包含沟通正文");
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Row confirm(String pkg, String session, String participant, String id, Confirm d) {
    var a = access(pkg, session, true);
    noFinal(session);
    var p = active(a);
    var subject = subject(p, participant);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对本对象实际沟通过程及线下确认凭证");
    c.s.text(d.supplierConfirmationNote(), 2000, true, "线下确认情况及来源");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "discussion-confirm:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, participant, id, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Row.class);
    if (!Objects.equals(gate(a).fingerprint(), d.expectedFingerprint()))
      throw new AgencyConflictException("沟通或轮次控制版本已变化，请重新核对本次确认");
    var row = require(session, participant, id);
    c.s.expected(row.version(), d.expectedVersion());
    if (!row.status().equals("draft")) throw new IllegalStateException("仅草稿可确认，旧确认不得覆盖");
    var previous = latest(data.supplier(tenant(), session, participant));
    if (!Objects.equals(row.previousId(), d.expectedPreviousId())
        || !Objects.equals(row.previousId(), previous == null ? null : previous.id()))
      throw new AgencyConflictException("本对象前次确认版本已变化，请重新核对");
    var content = content(row);
    AgencyDiscussionPolicy.validate(
        content,
        new HashSet<>(a.config().members().stream().map(m -> m.userId()).toList()),
        a.session().openedAt(),
        OffsetDateTime.now(),
        true);
    AgencyDiscussionPolicy.chronology(previous == null ? null : content(previous), content);
    c.s.publicProjectSource(content.evidenceVersionId(), pkg, "脱敏逐家过程凭证");
    c.s.publicProjectSource(d.supplierConfirmationVersionId(), pkg, "脱敏线下确认凭证");
    var proof = c.s.source(content.evidenceVersionId(), pkg);
    var confirmation = c.s.source(d.supplierConfirmationVersionId(), pkg);
    var roster =
        c.s
            .json
            .tree(c.rounds.round(tenant(), a.session().roundId()).frozenJson())
            .path("basis")
            .path("members");
    List<Object> staff = new ArrayList<>();
    for (var m : roster)
      if (content.staffUserIds().contains(m.path("userId").asText()))
        staff.add(c.s.json.read(m.toString(), Map.class));
    if (staff.size() != content.staffUserIds().size()) throw new IllegalStateException("冻结人员快照不完整");
    Map<String, Object> snapshot = new TreeMap<>();
    snapshot.put("roundHash", a.session().roundHash());
    snapshot.put("sessionId", session);
    snapshot.put("recordId", id);
    snapshot.put("ordinal", row.ordinal());
    snapshot.put("planHash", p.frozenHash());
    snapshot.put("subject", subject);
    snapshot.put("content", content);
    snapshot.put("staff", staff);
    snapshot.put("previousId", row.previousId());
    snapshot.put("previousHash", previous == null ? null : previous.frozenHash());
    snapshot.put("evidenceHash", proof.hash());
    snapshot.put("supplierConfirmationVersionId", d.supplierConfirmationVersionId());
    snapshot.put("supplierConfirmationHash", confirmation.hash());
    snapshot.put("supplierConfirmationNote", d.supplierConfirmationNote());
    String raw = c.s.json.write(snapshot),
        frozenHash = c.s.json.hash(c.s.json.read(raw, Map.class));
    if (data.confirm(tenant(), row.id(), row.version(), raw, frozenHash, c.s.guard.actor()) != 1)
      throw new AgencyConflictException("本次沟通版本已变化");
    var saved = data.row(tenant(), id);
    c.s.event(
        pkg,
        "supplier_discussion_confirmed",
        id,
        null,
        Map.of("ordinal", saved.ordinal(), "frozenHash", frozenHash),
        "本对象线下沟通过程已确认；不代表在线身份或需求变更批准");
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Row voidDraft(String pkg, String session, String participant, String id, VoidDraft d) {
    access(pkg, session, true);
    noFinal(session);
    if (d == null) throw new IllegalArgumentException("缺少作废草稿信息");
    c.s.text(d.reason(), 2000, true, "草稿作废原因");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "discussion-void:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, participant, id, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Row.class);
    var row = require(session, participant, id);
    c.s.expected(row.version(), d.expectedVersion());
    if (data.voidDraft(tenant(), id, row.version(), d.reason()) != 1)
      throw new IllegalStateException("仅未确认草稿可作废，保留原内容");
    var saved = data.row(tenant(), id);
    c.s.event(
        pkg,
        "supplier_discussion_draft_voided",
        id,
        null,
        Map.of("version", saved.version()),
        "作废沟通草稿，原内容保留在受控记录中");
    c.s.remember(key, hash, saved);
    return saved;
  }
}
