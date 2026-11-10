package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyDiscussionRecords.Content;
import com.procurement.agency.domain.AgencyRequirementChangeRecords.*;
import com.procurement.agency.infrastructure.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyRequirementChangeService {
  private final AgencyAssessmentContext c;
  private final AgencyRequirementChangeMapper data;
  private final AgencyDiscussionMapper discussions;
  private final AgencyFinalQuoteMapper finals;

  public AgencyRequirementChangeService(
      AgencyAssessmentContext c,
      AgencyRequirementChangeMapper data,
      AgencyDiscussionMapper discussions,
      AgencyFinalQuoteMapper finals) {
    this.c = c;
    this.data = data;
    this.discussions = discussions;
    this.finals = finals;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private String digest(String raw) {
    return c.s.json.hash(c.s.json.read(raw, Map.class));
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:change:read");
    if (write) {
      c.s.guard.permissions().require("buyer:agency:evaluation:change:register");
      if (finals.campaign(tenant(), session) != null)
        throw new IllegalStateException("最后报价已发起，授权变更及通知凭证只读保留");
    }
    AgencyDiscussionPolicy.method(c.s.packages.find(tenant(), pkg).procurementMethod());
    return a;
  }

  private com.procurement.agency.domain.AgencyDiscussionRecords.Plan plan(
      AgencyAssessmentContext.Access a) {
    var p = discussions.plan(tenant(), a.session().id());
    if (p == null || !p.mode().equals("active"))
      throw new IllegalStateException("须先启用逐家沟通计划；历史路径不能倒补变更");
    if (!digest(p.basisJson()).equals(p.frozenHash())
        || !c.s.json.tree(p.basisJson()).path("roundHash").asText().equals(a.session().roundHash())
        || !c.s.json.tree(p.basisJson()).path("subjects").equals(c.s.json.tree(p.subjectsJson())))
      throw new IllegalStateException("逐家沟通计划依据不一致");
    return p;
  }

  private List<Subject> subjects(AgencyAssessmentContext.Access a) {
    return Arrays.asList(c.s.json.read(plan(a).subjectsJson(), Subject[].class));
  }

  private List<com.procurement.agency.domain.AgencyDiscussionRecords.Row> sources(String session) {
    var rows = discussions.records(tenant(), session);
    for (var r : rows)
      if (r.status().equals("confirmed")
          && (!digest(r.frozenJson()).equals(r.frozenHash())
              || !c.s
                  .json
                  .tree(r.frozenJson())
                  .path("content")
                  .equals(c.s.json.tree(r.contentJson()))))
        throw new IllegalStateException("来源沟通指纹不一致");
    return rows.stream()
        .filter(
            r ->
                r.status().equals("confirmed")
                    && "requires_authorized_change"
                        .equals(c.s.json.read(r.contentJson(), Content.class).changeDisposition()))
        .toList();
  }

  private Snapshot snapshot(Change r) {
    return c.s.json.read(r.snapshotJson(), Snapshot.class);
  }

  private ReceiptSnapshot snapshot(Receipt r) {
    return c.s.json.read(r.snapshotJson(), ReceiptSnapshot.class);
  }

  private List<Receipt> latest(Change r, List<Receipt> all) {
    Map<String, Receipt> latest = new TreeMap<>();
    for (var v : all)
      if (v.changeId().equals(r.id()))
        latest.merge(v.participationId(), v, (x, y) -> x.ordinal() > y.ordinal() ? x : y);
    return List.copyOf(latest.values());
  }

  public Gate gate(AgencyAssessmentContext.Access a) {
    var changes = data.changes(tenant(), a.session().id());
    var receipts = data.receipts(tenant(), a.session().id());
    Set<String> covered = new HashSet<>();
    List<String> blockers = new ArrayList<>();
    String previous = null;
    var pending = sources(a.session().id());
    for (var r : changes) {
      var snap = snapshot(r);
      if (!digest(r.snapshotJson()).equals(r.frozenHash())
          || !snap.roundHash().equals(a.session().roundHash())
          || !Objects.equals(previous, snap.previousHash()))
        throw new IllegalStateException("需求变更冻结依据或前序指纹不一致");
      for (var ref : snap.sourceRecords())
        if (pending.stream()
            .noneMatch(
                v ->
                    v.id().equals(ref.recordId())
                        && v.frozenHash().equals(ref.frozenHash())
                        && v.participationId().equals(ref.participationId())))
          throw new IllegalStateException("需求变更的来源沟通已不一致");
      for (var n : receipts)
        if (n.changeId().equals(r.id())
            && (!digest(n.snapshotJson()).equals(n.frozenHash())
                || !snapshot(n).changeHash().equals(r.frozenHash())))
          throw new IllegalStateException("通知凭证指纹不一致");
      if (r.status().equals("notified")) {
        var done = c.s.json.read(r.completionJson(), Completion.class);
        var refs =
            latest(r, receipts).stream().map(v -> new Reference(v.id(), v.frozenHash())).toList();
        if (!digest(r.completionJson()).equals(r.completionHash())
            || !done.changeHash().equals(r.frozenHash())
            || !done.receipts().equals(refs)
            || !new HashSet<>(latest(r, receipts).stream().map(Receipt::participationId).toList())
                .equals(
                    new HashSet<>(snap.subjects().stream().map(Subject::participationId).toList())))
          throw new IllegalStateException("通知完成快照不完整或指纹不一致");
        snap.sourceRecords().forEach(v -> covered.add(v.recordId()));
      } else blockers.add("第" + r.ordinal() + "项授权变更尚未完成全部冻结参与者的同一通知送达核对，不能排除对象绕过");
      previous = r.frozenHash();
    }
    String fp =
        c.s.json.hash(
            Arrays.asList(
                a.session().roundHash(),
                discussions.plan(tenant(), a.session().id()),
                discussions.records(tenant(), a.session().id()),
                changes,
                receipts,
                c.controls.marker(a.session().roundId())));
    return new Gate(covered, blockers, fp, changes);
  }

  private void expected(String actual, String supplied) {
    if (!Objects.equals(actual, supplied))
      throw new AgencyConflictException("需求变更、通知、沟通或轮次控制版本已变化，请重新核对");
  }

  private String proof(String pkg, String id, String label) {
    c.s.publicProjectSource(id, pkg, "脱敏" + label);
    return c.s.source(id, pkg).hash();
  }

  private Change require(String session, String id) {
    var r = data.change(tenant(), id);
    if (r == null || !r.sessionId().equals(session))
      throw new IllegalArgumentException("变更不属于当前任务");
    return r;
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var g = gate(a);
    List<String> blockers = new ArrayList<>(a.blockers());
    List<Subject> subjects = List.of();
    try {
      subjects = subjects(a);
    } catch (IllegalStateException e) {
      blockers.add(e.getMessage());
    }
    if (finals.campaign(tenant(), session) != null) blockers.add("最后报价已发起，变更与通知凭证只读保留");
    return new Workspace(
        g.fingerprint(),
        g.changes(),
        data.receipts(tenant(), session),
        sources(session).stream()
            .filter(v -> !g.covered().contains(v.id()))
            .map(
                v ->
                    new com.procurement.agency.domain.AgencyDiscussionRecords.Reference(
                        v.participationId(), v.id(), v.ordinal(), v.frozenHash()))
            .toList(),
        subjects,
        blockers);
  }

  @Transactional
  public Change create(String pkg, String session, Create d) {
    var a = access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少登记内容");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "requirement-change:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Change.class);
    var p = plan(a);
    var g = gate(a);
    expected(g.fingerprint(), d.expectedFingerprint());
    if (!g.blockers().isEmpty()) throw new IllegalStateException(String.join("；", g.blockers()));
    if (g.changes().size() >= 100) throw new IllegalStateException("每任务最多100项变更登记");
    if (discussions.records(tenant(), session).stream().anyMatch(v -> v.status().equals("draft")))
      throw new IllegalStateException("须先处理全部沟通草稿，不能把未确认事实当作授权依据");
    var pending = sources(session).stream().filter(v -> !g.covered().contains(v.id())).toList();
    if (pending.isEmpty()) throw new IllegalStateException("没有待有权确认的沟通来源，不能凭空登记变更");
    var latest =
        pending.stream()
            .map(v -> c.s.json.read(v.contentJson(), Content.class).endedAt())
            .max(Comparator.naturalOrder())
            .orElseThrow();
    if (!g.changes().isEmpty()) {
      var previous = g.changes().getLast();
      var effective = c.s.json.read(previous.completionJson(), Completion.class).effectiveAt();
      if (effective.isAfter(latest)) latest = effective;
      if (snapshot(previous).content().requirementsVersionId().equals(d.requirementsVersionId()))
        throw new IllegalArgumentException("后续变更须追加新的最终需求版本，不得复用旧版冒充调整");
    }
    AgencyRequirementChangePolicy.create(d, a.session().openedAt(), latest, OffsetDateTime.now());
    var evidence = new TreeMap<String, String>();
    evidence.put("authorization", proof(pkg, d.authorizationVersionId(), "外部有权确认凭证"));
    evidence.put("requirements", proof(pkg, d.requirementsVersionId(), "共同最终需求"));
    evidence.put("notice", proof(pkg, d.noticeVersionId(), "共同变更通知"));
    var refs =
        pending.stream()
            .map(
                v ->
                    new com.procurement.agency.domain.AgencyDiscussionRecords.Reference(
                        v.participationId(), v.id(), v.ordinal(), v.frozenHash()))
            .toList();
    String raw =
        c.s.json.write(
            new Snapshot(
                session,
                a.session().roundHash(),
                p.frozenHash(),
                g.changes().size() + 1,
                g.changes().isEmpty() ? null : g.changes().getLast().frozenHash(),
                refs,
                subjects(a),
                d,
                evidence,
                c.s.guard.actor()));
    var row =
        new Change(
            "agency-change-" + UUID.randomUUID(),
            tenant(),
            session,
            pkg,
            g.changes().size() + 1,
            "authorized",
            1,
            raw,
            digest(raw),
            null,
            null,
            c.s.guard.actor(),
            null);
    data.create(row);
    var saved = require(session, row.id());
    trace(pkg, "requirement_change_registered", saved.id(), saved.frozenHash(), saved.status());
    c.s.remember(key, hash, saved);
    return saved;
  }

  @Transactional
  public Receipt register(String pkg, String session, String id, Register d) {
    var a = access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少送达登记");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "requirement-receipt:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, id, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Receipt.class);
    var g = gate(a);
    expected(g.fingerprint(), d.expectedFingerprint());
    var row = require(session, id);
    if (!row.status().equals("authorized"))
      throw new IllegalStateException("通知已复核锁定，不得改写；须按异常程序重新组织");
    var snap = snapshot(row);
    AgencyRequirementChangePolicy.receipt(d, snap, OffsetDateTime.now());
    var subject =
        snap.subjects().stream()
            .filter(v -> v.participationId().equals(d.participationId()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("接收对象不在冻结通知范围"));
    var all = data.receipts(tenant(), session);
    if (all.stream().filter(v -> v.changeId().equals(id)).count() >= 1000)
      throw new IllegalStateException("单变更通知凭证技术上限1000条");
    var previous =
        latest(row, all).stream()
            .filter(v -> v.participationId().equals(d.participationId()))
            .findFirst()
            .orElse(null);
    expected(previous == null ? null : previous.id(), d.expectedPreviousId());
    if (previous != null) c.s.text(d.replacementReason(), 2000, true, "追加更正依据");
    else c.s.text(d.replacementReason(), 2000, false, "追加更正依据");
    String raw =
        c.s.json.write(
            new ReceiptSnapshot(
                row.frozenHash(),
                subject.participationId(),
                subject.supplierName(),
                previous == null ? 1 : previous.ordinal() + 1,
                previous == null ? null : previous.frozenHash(),
                d,
                proof(pkg, d.evidenceVersionId(), "逐家通知送达凭证"),
                c.s.guard.actor()));
    var r =
        new Receipt(
            "agency-change-notice-" + UUID.randomUUID(),
            tenant(),
            id,
            subject.participationId(),
            previous == null ? 1 : previous.ordinal() + 1,
            previous == null ? null : previous.id(),
            raw,
            digest(raw),
            c.s.guard.actor(),
            null);
    data.receipt(r);
    if (data.bump(tenant(), id, row.version()) != 1) throw new AgencyConflictException("通知版本已变化");
    trace(pkg, "requirement_notice_registered", r.id(), r.frozenHash(), "recorded");
    c.s.remember(key, hash, r);
    return r;
  }

  @Transactional
  public Change complete(String pkg, String session, String id, Complete d) {
    var a = access(pkg, session, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须逐家复核同一冻结通知内容及送达凭证");
    c.s.text(d.note(), 2000, true, "通知复核说明");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "requirement-complete:" + d.idempotencyKey(),
        hash = c.s.begin(key, Arrays.asList(session, id, d));
    var cached = c.s.remembered(key);
    if (cached != null) return c.s.json.read(cached, Change.class);
    var g = gate(a);
    expected(g.fingerprint(), d.expectedFingerprint());
    var row = require(session, id);
    if (!row.status().equals("authorized")) throw new IllegalStateException("通知已经锁定");
    var latest = latest(row, data.receipts(tenant(), session));
    if (!new HashSet<>(latest.stream().map(Receipt::participationId).toList())
        .equals(
            new HashSet<>(
                snapshot(row).subjects().stream().map(Subject::participationId).toList())))
      throw new IllegalStateException("须全部冻结参与者均有同一通知送达凭证，不得通过排除对象绕过");
    var effective =
        latest.stream()
            .map(v -> snapshot(v).content().receivedAt())
            .max(Comparator.naturalOrder())
            .orElseThrow();
    String raw =
        c.s.json.write(
            new Completion(
                row.frozenHash(),
                latest.stream().map(v -> new Reference(v.id(), v.frozenHash())).toList(),
                d.evidenceVersionId(),
                proof(pkg, d.evidenceVersionId(), "通知统一复核凭证"),
                d.note(),
                effective,
                c.s.guard.actor()));
    if (data.complete(tenant(), id, row.version(), raw, digest(raw)) != 1)
      throw new AgencyConflictException("通知版本已变化");
    var saved = require(session, id);
    trace(pkg, "requirement_notice_completed", id, saved.completionHash(), saved.status());
    c.s.remember(key, hash, saved);
    return saved;
  }

  public List<Reference> finalReferences(
      AgencyAssessmentContext.Access a,
      String requirements,
      OffsetDateTime initiated,
      OffsetDateTime cutoff) {
    var g = gate(a);
    if (!g.blockers().isEmpty()) throw new IllegalStateException(String.join("；", g.blockers()));
    if (g.changes().isEmpty()) return List.of();
    var last = g.changes().getLast();
    if (!snapshot(last).content().requirementsVersionId().equals(requirements))
      throw new IllegalArgumentException("最后报价须引用最新已完成通知核对的共同最终需求版本");
    for (var r : g.changes())
      AgencyRequirementChangePolicy.finalWindow(
          initiated,
          cutoff,
          c.s.json.read(r.completionJson(), Completion.class).effectiveAt(),
          snapshot(r).content().responseDeadlineAt());
    return g.changes().stream().map(v -> new Reference(v.id(), v.completionHash())).toList();
  }

  private void trace(String pkg, String type, String id, String hash, String status) {
    c.s.event(
        pkg,
        type,
        id,
        null,
        Map.of("hash", hash, "status", status),
        "外部授权及线下通知凭证登记；不代替采购人决定，不代表实际发送");
  }
}
