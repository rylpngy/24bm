package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Entry;
import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import com.procurement.agency.domain.AgencyEvaluationRecords.MemberSnapshot;
import com.procurement.agency.domain.AgencyEvaluationRecords.RulePair;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.Campaign;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.Result;
import com.procurement.agency.domain.AgencyFinalResponseRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFinalResponseService {
  private final AgencyAssessmentContext c;
  private final AgencyFinalResponseMapper data;
  private final AgencyFinalQuoteMapper finals;
  private final AgencyFinalQuoteService files;
  private final AgencyRequirementChangeMapper changes;
  private final AgencyPriceMapper prices;
  private final com.procurement.workflow.application.UnifiedWorkflowApplicationService workflows;

  public AgencyFinalResponseService(
      AgencyAssessmentContext c,
      AgencyFinalResponseMapper data,
      AgencyFinalQuoteMapper finals,
      AgencyFinalQuoteService files,
      AgencyRequirementChangeMapper changes,
      AgencyPriceMapper prices,
      com.procurement.workflow.application.UnifiedWorkflowApplicationService workflows) {
    this.c = c;
    this.data = data;
    this.finals = finals;
    this.files = files;
    this.changes = changes;
    this.prices = prices;
    this.workflows = workflows;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private String digest(String raw) {
    return c.s.json.hash(c.s.json.read(raw, Map.class));
  }

  private Branch branch(AgencyAssessmentContext.Access a) {
    return AgencyMethodPolicy.branch(
        c.s.packages.find(tenant(), a.session().packageId()).procurementMethod(),
        a.config().evaluationMethod());
  }

  private AgencyAssessmentContext.Access access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.s.guard.permissions().require("buyer:agency:evaluation:final-response:read");
    return a;
  }

  private Campaign campaign(String session) {
    var r = finals.campaign(tenant(), session);
    if (r == null || !r.status().equals("confirmed"))
      throw new IllegalStateException("须先截止并确认最终响应副本及最后报价；接收确认不代表实质响应通过");
    return r;
  }

  private Snapshot snapshot(Plan p) {
    return c.s.json.read(p.snapshotJson(), Snapshot.class);
  }

  private List<Entry> entries(Sheet p) {
    return Arrays.asList(c.s.json.read(p.entriesJson(), Entry[].class));
  }

  private Plan active(AgencyAssessmentContext.Access a) {
    var p = data.plan(tenant(), a.session().id());
    if (p == null || !p.mode().equals("active")) throw new IllegalStateException("须先冻结最终响应复核依据");
    integrity(a, p);
    return p;
  }

  private void integrity(AgencyAssessmentContext.Access a, Plan p) {
    if (p == null || !p.mode().equals("active")) return;
    var snap = snapshot(p);
    if (!digest(p.snapshotJson()).equals(p.frozenHash())
        || !snap.roundHash().equals(a.session().roundHash())
        || !snap.campaignHash().equals(c.s.json.hash(campaign(a.session().id()))))
      throw new IllegalStateException("最终响应复核依据或最后报价快照不一致");
  }

  private String fp(AgencyAssessmentContext.Access a) {
    return c.s.json.hash(
        Arrays.asList(
            a.session().roundHash(),
            finals.campaign(tenant(), a.session().id()),
            data.plan(tenant(), a.session().id()),
            data.mine(tenant(), a.session().id(), c.s.guard.actor()) == null
                ? null
                : data.mine(tenant(), a.session().id(), c.s.guard.actor()).id(),
            c.controls.marker(a.session().roundId())));
  }

  private void expected(String actual, String supplied) {
    if (!Objects.equals(actual, supplied))
      throw new AgencyConflictException("最终响应依据或轮次控制已变化，请重新核对");
  }

  private String proof(String pkg, String id) {
    c.s.publicProjectSource(id, pkg, "脱敏最终响应复核凭证");
    return c.s.source(id, pkg).hash();
  }

  private void verifyFiles(Snapshot snap) {
    var rs = finals.receipts(tenant(), snap.campaignId());
    for (var s : snap.subjects()) {
      var r =
          rs.stream()
              .filter(
                  v ->
                      v.id().equals(s.receiptId())
                          && v.participationId().equals(s.participationId())
                          && v.status().equals("received"))
              .findFirst()
              .orElseThrow(() -> new IllegalStateException("最终响应来源不一致"));
      var v = files.verified(r);
      if (!v.id().equals(s.fileVersionId())
          || !v.hash().equals(s.responseHash())
          || !Objects.equals(v.attachmentId(), s.attachmentId()))
        throw new IllegalStateException("最终响应版本或实际字节不一致");
    }
  }

  private void sheetIntegrity(Plan p, Sheet sheet) {
    if (sheet.status().equals("submitted")) {
      if (!digest(sheet.snapshotJson()).equals(sheet.frozenHash())
          || !c.s.json.tree(sheet.snapshotJson()).path("planHash").asText().equals(p.frozenHash())
          || !c.s.json.tree(sheet.snapshotJson()).path("userId").asText().equals(sheet.userId())
          || !c.s
              .json
              .tree(sheet.snapshotJson())
              .path("entries")
              .equals(c.s.json.tree(sheet.entriesJson())))
        throw new IllegalStateException("最终响应个人意见指纹不一致");
    }
  }

  public Gate gate(AgencyAssessmentContext.Access a) {
    if (!branch(a).finalResponseRequired()) return new Gate(true, Set.of(), List.of(), null);
    var p = data.plan(tenant(), a.session().id());
    if (p != null && p.mode().equals("legacy")) return new Gate(true, Set.of(), List.of(), null);
    if (p == null)
      return new Gate(false, Set.of(), List.of("最终响应尚未建立独立复核，不能直接沿用初次响应意见计算"), "required");
    integrity(a, p);
    var snap = snapshot(p);
    var sheets = data.sheets(tenant(), a.session().id());
    List<String> blockers = new ArrayList<>();
    var requests = data.corrections(tenant(), a.session().id());
    if (requests.stream().anyMatch(r -> r.status().equals("processing")))
      blockers.add("存在待审最终响应更正，须完成授权及本人重新提交后复核计算");
    Set<String> failed = new HashSet<>();
    for (var m : snap.members()) {
      var sheet =
          sheets.stream()
              .filter(v -> v.userId().equals(m.userId()))
              .findFirst()
              .orElseThrow(() -> new IllegalStateException("最终响应成员任务缺失"));
      sheetIntegrity(p, sheet);
      if (!sheet.status().equals("submitted")) blockers.add("最终响应独立复核尚未全部提交");
    }
    if (blockers.isEmpty())
      for (var subject : snap.subjects())
        for (var criterion : snap.criteria())
          if (criterion.resultType().equals("pass_fail")) {
            Set<String> conclusions = new HashSet<>();
            for (var sheet : sheets) {
              var e =
                  entries(sheet).stream()
                      .filter(
                          v ->
                              v.participationId().equals(subject.participationId())
                                  && v.criterionKey().equals(criterion.key()))
                      .findFirst()
                      .orElseThrow(() -> new IllegalStateException("最终响应意见缺项"));
              conclusions.add(e.conclusion());
            }
            if (conclusions.size() > 1) blockers.add("最终响应存在成员结论分歧，须按适用规则有权处理，不自动多数表决或改写");
            if (conclusions.contains("fail")) failed.add(subject.participationId());
          }
    var result =
        new Gate(
            false,
            failed,
            blockers.stream().distinct().toList(),
            c.s.json.hash(
                Arrays.asList(
                    p.frozenHash(),
                    sheets.stream()
                        .map(v -> Arrays.asList(v.id(), v.version(), v.status(), v.frozenHash()))
                        .toList())));
    return requests.isEmpty()
        ? result
        : new Gate(
            false,
            failed,
            result.blockers(),
            c.s.json.hash(
                Arrays.asList(
                    result.marker(),
                    requests.stream()
                        .map(r -> Arrays.asList(r.id(), r.status(), r.sheetHash(), r.cellsJson()))
                        .toList())));
  }

  public Workspace workspace(String pkg, String session) {
    var a = access(pkg, session, false);
    var p = data.plan(tenant(), session);
    integrity(a, p);
    List<String> blockers = new ArrayList<>(a.blockers());
    try {
      if (branch(a).finalResponseRequired()) campaign(session);
    } catch (IllegalStateException e) {
      blockers.add(e.getMessage());
    }
    var snap = p != null && p.mode().equals("active") ? snapshot(p) : null;
    List<Progress> progress = new ArrayList<>();
    if (snap != null)
      for (var m : snap.members()) {
        var s = data.mine(tenant(), session, m.userId());
        progress.add(new Progress(m.userId(), m.name(), s == null ? "missing" : s.status()));
      }
    return new Workspace(
        p == null ? "required" : p.mode(), branch(a), fp(a), p, snap, progress, blockers);
  }

  @Transactional
  public Plan activate(String pkg, String session, Activate d) {
    var a = access(pkg, session, true);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:evaluation:final-response:organize");
    AgencyMethodPolicy.finalResponse(branch(a).procurementMethod(), a.config().evaluationMethod());
    if (d == null || !d.reviewed())
      throw new IllegalArgumentException("须核对最终需求、实际响应副本、职责人员与未改变的评分规则");
    c.s.text(d.reason(), 2000, true, "复核组织依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-response-activate:" + d.idempotencyKey(),
        h = c.s.begin(key, Arrays.asList(session, d));
    var cache = c.s.remembered(key);
    if (cache != null) return c.s.json.read(cache, Plan.class);
    var old = data.plan(tenant(), session);
    c.s.expected(old == null ? 0 : old.version(), d.expectedVersion());
    expected(fp(a), d.expectedFingerprint());
    if (old != null && old.mode().equals("active"))
      throw new IllegalStateException("最终响应复核依据已冻结，不能覆盖");
    if (!prices.history(tenant(), session).isEmpty())
      throw new IllegalStateException("已有价格计算，不能事后变更复核路径，须按异常程序另行组织");
    var campaign = campaign(session);
    var results = Arrays.asList(c.s.json.read(campaign.decisionsJson(), Result[].class));
    var names =
        Arrays.asList(
            c.s.json.read(
                campaign.subjectsJson(),
                com.procurement.agency.domain.AgencyAssessmentRecords.Subject[].class));
    List<Subject> subjects = new ArrayList<>();
    for (var r : results)
      if (r.status().equals("accepted"))
        subjects.add(
            new Subject(
                r.participationId(),
                names.stream()
                    .filter(v -> v.participationId().equals(r.participationId()))
                    .findFirst()
                    .orElseThrow()
                    .supplierName(),
                r.receiptId(),
                r.fileVersionId(),
                c.s.packages.version(tenant(), r.fileVersionId()).attachmentId(),
                r.hash()));
    if (subjects.isEmpty()) throw new IllegalStateException("无已确认有效最终响应，不能补造复核或自动复制首次响应");
    var round = c.rounds.round(tenant(), a.session().roundId());
    var frozen = c.s.json.tree(round.frozenJson());
    var roster =
        Arrays.asList(
                c.s.json.read(
                    frozen.path("basis").path("members").toString(), MemberSnapshot[].class))
            .stream()
            .filter(v -> v.roles().contains("review_member"))
            .toList();
    if (roster.isEmpty()) throw new IllegalStateException("冻结人员未指定承担最终评审职责的成员，不能以组长或技术管理员身份代填");
    List<Clause> clauses = new ArrayList<>();
    clauses.add(
        new Clause(
            "__final:complete",
            "对照共同最终需求逐项核对实质响应",
            "共同最终需求全文及变更清单",
            "依照最终共同需求逐项核对，意见须定位实际响应内容；不是仅核对文件齐备",
            campaign.requirementsVersionId(),
            campaign.requirementsHash()));
    var source = frozen.path("basis").path("source");
    for (var pair : a.config().rules())
      if (pair.configuredRule().stage().equals("conformity")
          && pair.configuredRule().resultType().equals("pass_fail"))
        clauses.add(
            new Clause(
                "__final:base:" + pair.configuredRule().key(),
                pair.configuredRule().title(),
                pair.locator(),
                "原冻结符合性条款对照，适用共同授权变更；不得改动资格及评分规则",
                source.path("fileVersionId").asText(),
                source.path("hash").asText()));
    if (campaign.requirementChangesJson() != null)
      for (var ref :
          c.s.json.read(
              campaign.requirementChangesJson(),
              com.procurement.agency.domain.AgencyRequirementChangeRecords.Reference[].class)) {
        var change = changes.change(tenant(), ref.id());
        if (change == null
            || !change.sessionId().equals(session)
            || !change.status().equals("notified")
            || !Objects.equals(ref.hash(), change.completionHash())
            || !digest(change.snapshotJson()).equals(change.frozenHash())
            || !digest(change.completionJson()).equals(change.completionHash()))
          throw new IllegalStateException("共同变更通知引用不一致");
        var content =
            c.s
                .json
                .read(
                    change.snapshotJson(),
                    com.procurement.agency.domain.AgencyRequirementChangeRecords.Snapshot.class)
                .content();
        clauses.add(
            new Clause(
                "__final:change:" + change.ordinal(),
                "共同变更第" + change.ordinal() + "项",
                content.locator(),
                content.afterText(),
                content.requirementsVersionId(),
                c.s
                    .json
                    .tree(change.snapshotJson())
                    .path("evidenceHashes")
                    .path("requirements")
                    .asText()));
      }
    List<Criterion> criteria =
        new ArrayList<>(
            a.config().rules().stream()
                .map(RulePair::configuredRule)
                .filter(v -> Set.of("technical", "commercial").contains(v.stage()))
                .toList());
    for (var cl : clauses)
      criteria.add(
          new Criterion(
              cl.key(),
              cl.title(),
              "conformity",
              "全部有效最终响应",
              "pass_fail",
              BigDecimal.ZERO,
              BigDecimal.ZERO,
              BigDecimal.ZERO,
              "",
              true,
              0,
              "HALF_UP"));
    if ((long) criteria.size() * subjects.size() > 3000)
      throw new IllegalStateException("最终响应复核超过3000项技术上限，须按适用规则拆分组织，不得遗漏职责项");
    c.s.publicProjectSource(campaign.requirementsVersionId(), pkg, "脱敏共同最终需求");
    if (!c.s
        .source(campaign.requirementsVersionId(), pkg)
        .hash()
        .equals(campaign.requirementsHash())) throw new IllegalStateException("最终需求字节不一致");
    var snap =
        new Snapshot(
            session,
            a.session().roundHash(),
            campaign.id(),
            c.s.json.hash(campaign),
            campaign.requirementsVersionId(),
            campaign.requirementsHash(),
            campaign.requirementChangesJson(),
            subjects,
            clauses,
            criteria,
            roster,
            d.evidenceVersionId(),
            proof(pkg, d.evidenceVersionId()),
            d.reason(),
            c.s.guard.actor());
    verifyFiles(snap);
    String raw = c.s.json.write(snap), hash = digest(raw);
    if (old == null)
      data.create(
          new Plan(tenant(), session, pkg, "active", 1, raw, hash, c.s.guard.actor(), null));
    else if (data.activate(tenant(), session, old.version(), raw, hash, c.s.guard.actor()) != 1)
      throw new AgencyConflictException("复核依据已变化");
    for (var member : roster)
      data.sheet("agency-final-response-" + UUID.randomUUID(), tenant(), session, member.userId());
    var saved = data.plan(tenant(), session);
    trace(pkg, "final_response_activated", session, hash, "active");
    c.s.remember(key, h, saved);
    return saved;
  }

  private Sheet mine(AgencyAssessmentContext.Access a) {
    var p = active(a);
    if (snapshot(p).members().stream().noneMatch(v -> v.userId().equals(c.s.guard.actor())))
      throw new PermissionDeniedException("当前账号没有本人的最终响应复核任务，组织身份不代表评审职责");
    var sheet = data.mine(tenant(), a.session().id(), c.s.guard.actor());
    if (sheet == null) throw new PermissionDeniedException("没有本人任务");
    sheetIntegrity(p, sheet);
    return sheet;
  }

  public Mine mine(String pkg, String session) {
    var a = access(pkg, session, false);
    var p = active(a);
    var sheet = mine(a);
    return new Mine(
        fp(a),
        p,
        snapshot(p),
        sheet,
        a.blockers(),
        data.history(tenant(), session, c.s.guard.actor()),
        data.corrections(tenant(), session).stream()
            .filter(r -> r.userId().equals(c.s.guard.actor()))
            .toList());
  }

  @Transactional
  public Sheet save(String pkg, String session, Save d) {
    var a = access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:final-response:review");
    if (d == null) throw new IllegalArgumentException("缺少本人意见");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-response-save:" + d.idempotencyKey(),
        h = c.s.begin(key, Arrays.asList(session, d));
    var cache = c.s.remembered(key);
    if (cache != null) return c.s.json.read(cache, Sheet.class);
    var p = active(a);
    var sheet = mine(a);
    if (!sheet.status().equals("draft"))
      throw new IllegalStateException("本人提交已锁定；发现错误须暂停并按异常程序另行组织，不能覆盖");
    c.s.expected(sheet.version(), d.expectedVersion());
    expected(fp(a), d.expectedFingerprint());
    validate(snapshot(p), d.entries(), false);
    correctionScope(sheet, d.entries());
    if (data.save(
            tenant(), session, c.s.guard.actor(), sheet.version(), c.s.json.write(d.entries()))
        != 1) throw new AgencyConflictException("本人草稿版本已变化");
    var saved = data.mine(tenant(), session, c.s.guard.actor());
    trace(
        pkg, "final_response_draft_saved", saved.id(), c.s.json.hash(d.entries()), saved.status());
    c.s.remember(key, h, saved);
    return saved;
  }

  private void validate(Snapshot snap, List<Entry> entries, boolean complete) {
    AgencyAssessmentPolicy.validate(
        snap.subjects().stream()
            .map(
                v ->
                    new com.procurement.agency.domain.AgencyAssessmentRecords.Subject(
                        v.participationId(), v.supplierName()))
            .toList(),
        snap.criteria(),
        entries,
        complete);
  }

  @Transactional
  public Sheet submit(String pkg, String session, Submit d) {
    var a = access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:final-response:review");
    if (d == null || !d.personallyConfirmed())
      throw new IllegalArgumentException("须本人核对最终需求、响应版本和全部职责项后独立提交");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-response-submit:" + d.idempotencyKey(),
        h = c.s.begin(key, Arrays.asList(session, d));
    var cache = c.s.remembered(key);
    if (cache != null) return c.s.json.read(cache, Sheet.class);
    var p = active(a);
    var sheet = mine(a);
    if (!sheet.status().equals("draft")) throw new IllegalStateException("本人意见已提交，不可覆盖");
    c.s.expected(sheet.version(), d.expectedVersion());
    expected(fp(a), d.expectedFingerprint());
    validate(snapshot(p), entries(sheet), true);
    correctionScope(sheet, entries(sheet));
    verifyFiles(snapshot(p));
    Map<String, Object> frozen = new TreeMap<>();
    frozen.put("planHash", p.frozenHash());
    frozen.put("userId", sheet.userId());
    frozen.put("entries", entries(sheet));
    frozen.put("evidenceVersionId", d.evidenceVersionId());
    frozen.put("evidenceHash", proof(pkg, d.evidenceVersionId()));
    if (sheet.correctionId() != null) {
      frozen.put("previousId", sheet.previousId());
      frozen.put("previousHash", data.byId(tenant(), sheet.previousId()).frozenHash());
      frozen.put("correctionId", sheet.correctionId());
      frozen.put("ordinal", sheet.ordinal());
    }
    String raw = c.s.json.write(frozen);
    if (data.submit(tenant(), session, sheet.userId(), sheet.version(), raw, digest(raw)) != 1)
      throw new AgencyConflictException("本人意见版本已变化");
    var saved = data.mine(tenant(), session, sheet.userId());
    trace(pkg, "final_response_submitted", saved.id(), saved.frozenHash(), saved.status());
    c.s.remember(key, h, saved);
    return saved;
  }

  public AgencyTotalPolicy.Sample sample(
      AgencyAssessmentContext.Access a, String user, String criterion, String participant) {
    var p = data.plan(tenant(), a.session().id());
    if (p == null || !p.mode().equals("active")) return null;
    integrity(a, p);
    var s = data.mine(tenant(), a.session().id(), user);
    if (s == null || !s.status().equals("submitted"))
      throw new IllegalStateException("最终响应计分意见尚未提交");
    sheetIntegrity(p, s);
    var e =
        entries(s).stream()
            .filter(
                v -> v.participationId().equals(participant) && v.criterionKey().equals(criterion))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("最终响应计分项缺失"));
    return new AgencyTotalPolicy.Sample(user, s.id(), s.frozenHash(), e.score());
  }

  private void correctionScope(Sheet sheet, List<Entry> values) {
    if (sheet.correctionId() == null) return;
    var r = data.correction(tenant(), sheet.correctionId());
    if (r == null
        || !r.status().equals("approved")
        || !r.sheetId().equals(sheet.previousId())
        || !r.userId().equals(sheet.userId())) throw new IllegalStateException("最终响应更正授权不一致");
    var old = data.byId(tenant(), r.sheetId());
    if (!Objects.equals(old.frozenHash(), r.sheetHash()))
      throw new IllegalStateException("原提交指纹变化");
    AgencyAssessmentPolicy.correctionScope(
        entries(old),
        values,
        Arrays.asList(
            c.s.json.read(
                r.cellsJson(),
                com.procurement.agency.domain.AgencyAssessmentRecords.Cell[].class)));
  }

  @Transactional
  public com.procurement.agency.domain.AgencyAssessmentRecords.Correction correction(
      String pkg, String session, CorrectionDraft d) {
    var a = access(pkg, session, true);
    c.s.guard.permissions().require("buyer:agency:evaluation:final-response:review");
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:request");
    if (d == null) throw new IllegalArgumentException("缺少最终响应更正申请");
    c.s.text(d.reason(), 2000, true, "更正原因");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "final-response-correction:" + d.idempotencyKey(),
        h = c.s.begin(key, Arrays.asList(session, d));
    var cache = c.s.remembered(key);
    if (cache != null)
      return c.s.json.read(
          cache, com.procurement.agency.domain.AgencyAssessmentRecords.Correction.class);
    var old = mine(a);
    if (!old.status().equals("submitted")) throw new IllegalStateException("只能为本人最新已提交的最终响应意见申请更正");
    c.s.expected(old.version(), d.expectedVersion());
    expected(fp(a), d.expectedFingerprint());
    var cells =
        entries(old).stream()
            .map(
                e ->
                    new com.procurement.agency.domain.AgencyAssessmentRecords.Cell(
                        e.participationId(), e.criterionKey()))
            .toList();
    if (d.cells() == null
        || d.cells().isEmpty()
        || d.cells().size() > 3000
        || new HashSet<>(d.cells()).size() != d.cells().size()
        || !cells.containsAll(d.cells()))
      throw new IllegalArgumentException("限定更正范围须属于本人的原提交对象及职责项");
    if (data.corrections(tenant(), session).stream()
        .anyMatch(r -> r.userId().equals(old.userId()) && r.status().equals("processing")))
      throw new IllegalStateException("已有待审更正");
    String id = "agency-final-correction-" + UUID.randomUUID();
    var row =
        new com.procurement.agency.domain.AgencyAssessmentRecords.Correction(
            id,
            tenant(),
            session,
            old.id(),
            old.userId(),
            old.version(),
            old.frozenHash(),
            c.s.json.write(d.cells()),
            d.reason(),
            d.evidenceVersionId(),
            proof(pkg, d.evidenceVersionId()),
            "processing",
            null,
            "",
            null);
    data.createCorrection(row);
    Map<String, Object> snap = new TreeMap<>();
    snap.put("reviewKind", "final_response");
    snap.put("packageId", pkg);
    snap.put("sessionId", session);
    snap.put("requestId", id);
    snap.put("reviewerId", old.userId());
    snap.put("sheetHash", old.frozenHash());
    snap.put("cells", d.cells());
    snap.put("reason", d.reason());
    snap.put("evidenceVersionId", d.evidenceVersionId());
    snap.put("evidenceHash", row.evidenceHash());
    var wf =
        workflows.start(
            new com.procurement.workflow.application.WorkflowStartCommand(
                "agency_assessment_correction",
                id,
                c.s.packages.find(tenant(), pkg).departmentId(),
                null,
                d.formData() == null ? Map.of() : d.formData(),
                snap));
    if (data.bind(tenant(), id, wf.workflowInstanceId()) != 1)
      throw new IllegalStateException("更正流程绑定失败");
    var saved = data.correction(tenant(), id);
    trace(pkg, "final_response_correction_requested", id, c.s.json.hash(snap), "processing");
    c.s.remember(key, h, saved);
    return saved;
  }

  @Transactional
  public void withdraw(String pkg, String session, String id, String reason) {
    access(pkg, session, false);
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:request");
    var r = data.correction(tenant(), id);
    if (r == null || !r.sessionId().equals(session) || !r.userId().equals(c.s.guard.actor()))
      throw new PermissionDeniedException("仅本人可撤回最终响应更正");
    workflows.withdrawAgencyExecution(r.workflowId(), reason);
  }

  private void trace(String pkg, String type, String id, String hash, String status) {
    c.s.event(
        pkg,
        type,
        id,
        null,
        Map.of("hash", hash, "status", status),
        "最终响应独立复核，事件不含个人意见；不自动决定资格、推荐或成交");
  }
}
