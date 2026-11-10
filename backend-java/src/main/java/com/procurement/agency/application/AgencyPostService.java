package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyPostRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.application.*;
import java.io.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPostService {
  final AgencyExecutionSupport s;
  final AgencyPostMapper data;
  final AgencyAssessmentContext c;
  final AgencyRecommendationMapper reports;
  final AgencyEvaluationEvidence evidence;
  final UnifiedWorkflowApplicationService workflows;

  public AgencyPostService(
      AgencyExecutionSupport s,
      AgencyPostMapper data,
      AgencyAssessmentContext c,
      AgencyRecommendationMapper reports,
      AgencyEvaluationEvidence evidence,
      UnifiedWorkflowApplicationService workflows) {
    this.s = s;
    this.data = data;
    this.c = c;
    this.reports = reports;
    this.evidence = evidence;
    this.workflows = workflows;
  }

  String t() {
    return s.guard.tenant();
  }

  String id(String kind) {
    return "agency-post-" + kind + "-" + UUID.randomUUID();
  }

  void access(String p, boolean w) {
    if (w) s.write(p, "buyer:agency:post:manage");
    else s.read(p, "buyer:agency:post:read");
  }

  String hash(String raw) {
    return s.json.hash(s.json.read(raw, Map.class));
  }

  String proof(String p, String file) {
    s.publicProjectSource(file, p, "标后脱敏实际凭证");
    return s.source(file, p).hash();
  }

  void time(OffsetDateTime at) {
    if (at == null || at.isAfter(OffsetDateTime.now().plusMinutes(5)))
      throw new IllegalArgumentException("实际办理时间缺失或晚于当前时间");
  }

  void event(String p, String object, String kind, Object value) {
    String raw = s.json.write(value);
    data.event(new Event(id("event"), t(), p, object, kind, raw, hash(raw), s.guard.actor(), null));
    s.event(p, "post_" + kind, object, null, Map.of("hash", hash(raw)), "线下实际办理登记");
  }

  public Workspace workspace(String p) {
    access(p, false);
    return new Workspace(
        sources(p),
        data.control(t(), p) == null ? "active" : data.control(t(), p).state(),
        data.results(t(), p),
        data.documents(t(), p),
        data.events(t(), p),
        data.issues(t(), p));
  }

  List<ResultSource> sources(String p) {
    var out = new ArrayList<ResultSource>();
    for (var round : c.rounds.rounds(t(), p)) {
      var session = c.data.byRound(t(), round.id());
      if (session == null) continue;
      var ready = new ArrayList<SourceReport>();
      for (var report : reports.reports(t(), session.id()))
        if (report.status().equals("approved")) {
          var rec = reports.recommendation(t(), report.recommendationId());
          if (rec != null
              && hash(rec.snapshotJson()).equals(rec.frozenHash())
              && rec.sourceFingerprint().equals(evidence.stamp(t(), session.id()))) {
            var snap =
                s.json.read(
                    rec.snapshotJson(),
                    com.procurement.agency.domain.AgencyRecommendationRecords.Snapshot.class);
            ready.add(
                new SourceReport(
                    report.id(),
                    "已审核报告 · " + Objects.toString(report.createdAt(), ""),
                    snap.candidates()));
          }
        }
      out.add(
          new ResultSource(
              session.id(),
              round.ordinal(),
              s.json.tree(round.frozenJson()).path("config").path("documentRevisionId").asText(),
              ready));
    }
    return out;
  }

  @Transactional
  public Result decide(String p, Decision d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对有权确认范围与实际依据");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "post-result:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Result.class);
    var history = data.results(t(), p);
    String previous = history.isEmpty() ? null : history.getFirst().id();
    if (!Objects.equals(previous, d.expectedPreviousId()))
      throw new AgencyConflictException("结果版本已变化");
    if (previous != null) {
      s.guard.permissions().require("buyer:agency:post:correct");
      if (data.documents(t(), p).stream()
          .anyMatch(
              r ->
                  Set.of("reviewing", "published", "issued", "delivered", "signed")
                      .contains(r.status())))
        throw new IllegalStateException("存在审核中或已对外办理文书，须先按有权程序处理其影响，不能直接改结果");
    }
    if (!Set.of("award", "failed", "terminated").contains(Objects.toString(d.kind(), "")))
      throw new IllegalArgumentException("结果类型无效");
    var session = c.data.session(t(), d.sessionId());
    if (session == null || !session.packageId().equals(p))
      throw new IllegalArgumentException("任务不属于当前采购包");
    time(d.confirmedAt());
    s.text(d.authorityName(), 300, true, "有权主体");
    s.text(d.authorityRole(), 300, true, "主体职责");
    s.text(d.authorityScope(), 2000, true, "确认权限范围");
    s.text(d.reason(), 4000, true, "实际决定及依据");
    if ("purchaser_account".equals(d.authorityMode())) {
      s.guard.permissions().require("buyer:agency:post:confirm");
      var cfg = s.json.tree(c.rounds.round(t(), session.roundId()).frozenJson()).path("config");
      boolean representative = false;
      for (var m : cfg.path("members"))
        if (m.path("userId").asText().equals(s.guard.actor()))
          for (var role : m.path("roles"))
            if (role.asText().equals("purchaser_rep")) representative = true;
      if (!representative) throw new PermissionDeniedException("本账号不是本轮冻结采购人代表");
    } else if ("offline_authority".equals(d.authorityMode()))
      s.guard.permissions().require("buyer:agency:post:register");
    else throw new IllegalArgumentException("须选择采购人代表账号确认或真实有权书面决定登记");
    String rh = null,
        ch = null,
        stamp = null,
        supplier = null,
        currency = s.packages.find(t(), p).currency();
    BigDecimal amount = null;
    if (d.kind().equals("award")) {
      requireActive(p);
      var r = reports.report(t(), d.reportId());
      if (r == null
          || !r.packageId().equals(p)
          || !r.sessionId().equals(session.id())
          || !r.status().equals("approved")) throw new IllegalStateException("须引用本任务已独立审核通过的报告");
      var rec = reports.recommendation(t(), r.recommendationId());
      if (rec == null
          || !hash(rec.snapshotJson()).equals(rec.frozenHash())
          || !evidence.stamp(t(), session.id()).equals(rec.sourceFingerprint()))
        throw new IllegalStateException("报告或推荐来源已变化");
      var snap =
          s.json.read(
              rec.snapshotJson(),
              com.procurement.agency.domain.AgencyRecommendationRecords.Snapshot.class);
      var selected =
          snap.candidates().stream()
              .filter(v -> v.participationId().equals(d.participationId()))
              .findFirst()
              .orElseThrow(() -> new IllegalArgumentException("结果必须来自当前报告人工推荐名单"));
      if (!snap.candidates().getFirst().participationId().equals(selected.participationId()))
        throw new IllegalStateException("跳过首位候选人的实际例外须先有权处理并更正报告，不能自行改中选人");
      if (!c.controls.reviewBlockers(session.roundId()).isEmpty())
        throw new IllegalStateException("存在未处理评审事项，不能确认成交");
      s.source(r.artifactVersionId(), p);
      rh = r.artifactHash();
      ch = rec.frozenHash();
      stamp = rec.sourceFingerprint();
      supplier = selected.supplierName();
      amount = selected.responseAmount();
      currency = selected.currency();
    } else {
      if (d.participationId() != null || d.reportId() != null)
        throw new IllegalArgumentException("失败或终止不填写已成交对象及报告");
    }
    var snap =
        new ResultSnapshot(
            d,
            rh,
            ch,
            supplier,
            amount,
            currency,
            proof(p, d.evidenceVersionId()),
            s.guard.actor());
    String raw = s.json.write(snap);
    var r =
        new Result(
            id("result"),
            t(),
            p,
            session.id(),
            history.size() + 1,
            previous,
            d.kind(),
            d.reportId(),
            stamp,
            raw,
            hash(raw),
            s.guard.actor(),
            null);
    data.createResult(r);
    event(p, r.id(), "decision", Map.of("hash", r.frozenHash(), "kind", r.kind()));
    s.remember(k, h, r);
    return r;
  }

  void requireActive(String p) {
    var control = data.control(t(), p);
    if (control != null && !control.state().equals("active"))
      throw new IllegalStateException("标后业务已由有权决定暂停或终止，仅可读取和按授权处理事项，不可继续签发发布");
  }

  Result current(String p, String result) {
    var history = data.results(t(), p);
    requireActive(p);
    if (history.isEmpty() || !history.getFirst().id().equals(result))
      throw new IllegalStateException("必须引用当前已确认结果");
    var r = history.getFirst();
    if (!hash(r.snapshotJson()).equals(r.frozenHash())) throw new IllegalStateException("结果指纹不一致");
    if (r.kind().equals("award")
        && !Objects.equals(r.sourceFingerprint(), evidence.stamp(t(), r.sessionId())))
      throw new IllegalStateException("已确认结果的评审依据已变化，须有权复核");
    return r;
  }

  @Transactional
  public Document generate(String p, DocumentDraft d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工对照确认结果和采购文件范本");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String key = "post-document:" + d.idempotencyKey(), ih = s.begin(key, Arrays.asList(p, d));
    var cached = s.remembered(key);
    if (cached != null) return s.json.read(cached, Document.class);
    var r = current(p, d.resultId());
    if (!Set.of("announcement", "notice", "contract").contains(Objects.toString(d.kind(), "")))
      throw new IllegalArgumentException("文书类型无效");
    if (!r.kind().equals("award") && !d.kind().equals("announcement"))
      throw new IllegalArgumentException("失败或终止不得生成成交通知或合同");
    s.text(d.text(), 16000, true, "拟稿内容");
    s.text(d.applicabilityBasis(), 4000, true, "本方式公告或文书适用依据");
    s.text(d.reason(), 2000, true, "拟稿核对依据");
    s.publicProjectSource(d.templateVersionId(), p, "脱敏范本");
    var template = s.source(d.templateVersionId(), p);
    if (!template.name().toLowerCase(Locale.ROOT).endsWith(".docx"))
      throw new IllegalArgumentException("须采用DOCX实际范本");
    String procurementHash = null;
    var pack = s.packages.find(t(), p);
    var result = s.json.read(r.snapshotJson(), ResultSnapshot.class);
    if (d.kind().equals("contract")) {
      s.text(d.obligations(), 12000, true, "采购文件履行要求");
      s.text(d.responseCommitments(), 12000, true, "响应承诺核对");
      var revision = s.data.revision(t(), d.procurementRevisionId());
      var session = c.data.session(t(), r.sessionId());
      var cfg = s.json.tree(c.rounds.round(t(), session.roundId()).frozenJson()).path("config");
      if (revision == null
          || !cfg.path("documentRevisionId").asText().equals(revision.id())
          || !revision.status().equals("approved"))
        throw new IllegalArgumentException("合同须引用本轮实际采购文件已审核版本");
      procurementHash = s.source(revision.fileVersionId(), p).hash();
    }
    String purchaser = s.json.tree(pack.dataJson()).path("purchaser").path("name").asText();
    if (purchaser.isBlank())
      purchaser = s.json.tree(pack.dataJson()).path("purchaserSnapshot").path("name").asText();
    if (purchaser.isBlank()) throw new IllegalStateException("采购人快照名称缺失，请核对档案");
    var snap =
        new DocumentSnapshot(
            d,
            r.frozenHash(),
            template.hash(),
            procurementHash,
            purchaser,
            result.supplierName(),
            pack.title(),
            pack.number(),
            result.amount(),
            result.currency());
    String raw = s.json.write(snap), docId = id("document");
    byte[] bytes;
    try (var doc = new XWPFDocument(new ByteArrayInputStream(template.bytes()));
        var out = new ByteArrayOutputStream()) {
      var paragraph = doc.createParagraph();
      paragraph.setPageBreak(true);
      String noun = Set.of("公开招标", "邀请招标").contains(pack.procurementMethod()) ? "中标" : "成交";
      var lines =
          List.of(
              d.kind().equals("announcement")
                  ? (r.kind().equals("award")
                      ? noun + "结果公告"
                      : "采购" + (r.kind().equals("failed") ? "失败" : "终止") + "公告")
                  : d.kind().equals("notice") ? noun + "通知书（待审核签发）" : "合同草稿（待双方签署）",
              "采购人：" + purchaser,
              "项目：" + pack.title() + " / " + pack.number(),
              "供应商：" + Objects.toString(result.supplierName(), "不适用"),
              "确认金额：" + Objects.toString(result.amount(), "不适用") + " " + result.currency(),
              d.text(),
              "适用依据：" + d.applicabilityBasis(),
              d.kind().equals("contract")
                  ? "采购文件履行要求：" + d.obligations() + "\n响应承诺核对：" + d.responseCommitments()
                  : "本次生成不等于外部发布、签发或送达");
      for (var line : lines) {
        var run = doc.createParagraph().createRun();
        run.setFontFamily("宋体");
        run.setFontSize(11);
        for (var text : line.split("\\R", -1)) {
          run.setText(text);
          run.addBreak();
        }
      }
      doc.write(out);
      bytes = out.toByteArray();
    } catch (IOException ex) {
      throw new IllegalArgumentException("实际DOCX范本不可用", ex);
    }
    var file = s.artifact(p, "标后文书-" + docId + ".docx", bytes);
    var doc =
        new Document(
            docId,
            t(),
            p,
            r.id(),
            d.kind(),
            raw,
            hash(raw),
            file.id(),
            file.hash(),
            "generated",
            1,
            null,
            s.guard.actor(),
            null);
    data.createDocument(doc);
    event(
        p,
        doc.id(),
        "generated",
        Map.of("sourceHash", doc.frozenHash(), "fileHash", doc.fileHash()));
    s.remember(key, ih, doc);
    return doc;
  }

  Document document(String p, String id) {
    var d = data.document(t(), id);
    if (d == null || !d.packageId().equals(p)) throw new PermissionDeniedException("文书不属于当前项目");
    if (!hash(d.snapshotJson()).equals(d.frozenHash()))
      throw new IllegalStateException("文书快照指纹不一致");
    return d;
  }

  @Transactional
  public Document submit(String p, String id, Submit d) {
    access(p, true);
    if (d == null) throw new IllegalArgumentException("缺少提交参数");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "post-submit:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(id, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Document.class);
    var r = document(p, id);
    s.expected(r.version(), d.expectedVersion());
    if (!Set.of("generated", "rejected").contains(r.status()))
      throw new IllegalStateException("文书状态不允许提审");
    current(p, r.resultId());
    if (!s.source(r.fileVersionId(), p).hash().equals(r.fileHash()))
      throw new IllegalStateException("文书字节不一致");
    s.text(d.reason(), 2000, true, "提交依据");
    var wf =
        workflows.start(
            new WorkflowStartCommand(
                "agency_post_document",
                id,
                s.packages.find(t(), p).departmentId(),
                null,
                d.formData() == null ? Map.of() : d.formData(),
                Map.of(
                    "packageId",
                    p,
                    "documentId",
                    id,
                    "version",
                    r.version() + 1,
                    "snapshotHash",
                    r.frozenHash(),
                    "fileVersionId",
                    r.fileVersionId(),
                    "fileHash",
                    r.fileHash())));
    if (data.state(t(), id, r.version(), r.status(), "reviewing", wf.workflowInstanceId()) != 1)
      throw new AgencyConflictException("文书状态变化");
    var result = data.document(t(), id);
    s.remember(k, h, result);
    return result;
  }

  @Transactional
  public void withdraw(String p, String id, String reason) {
    access(p, false);
    s.guard.permissions().require("buyer:agency:post:manage");
    var d = document(p, id);
    if (!d.createdBy().equals(s.guard.actor()) || d.workflowId() == null)
      throw new PermissionDeniedException("仅当前提审人可撤回进行中文书审批");
    workflows.withdrawAgencyExecution(d.workflowId(), reason);
  }

  @Transactional
  public Document act(String p, String id, Action d) {
    access(p, true);
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对真实办理证据");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "post-action:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(id, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Document.class);
    var r = document(p, id);
    s.expected(r.version(), d.expectedVersion());
    current(p, r.resultId());
    time(d.occurredAt());
    s.text(d.recipient(), 500, true, "发布渠道或实际接收主体");
    s.text(d.channel(), 500, true, "办理途径");
    s.text(d.reference(), 2000, true, "外部编号或定位");
    s.text(d.reason(), 4000, true, "实际办理依据");
    String next =
        switch (r.kind() + ":" + r.status() + ":" + d.action()) {
          case "announcement:approved:publish" -> "published";
          case "notice:approved:issue" -> "issued";
          case "notice:issued:deliver" -> "delivered";
          case "contract:approved:sign" -> "signed";
          default -> throw new IllegalStateException("须先完成对应审核、签发及送达顺序，不能跳步");
        };
    var events = data.events(t(), p);
    for (var e : events)
      if (e.objectId().equals(id)) {
        var at = s.json.tree(e.snapshotJson()).path("action").path("occurredAt").asText();
        if (!at.isBlank() && d.occurredAt().isBefore(OffsetDateTime.parse(at)))
          throw new IllegalArgumentException("后续实际办理时间不能早于前序办理");
      }
    String signedHash = "";
    if (next.equals("signed")) {
      var snap = s.json.read(r.snapshotJson(), DocumentSnapshot.class);
      if (d.actualAmount() == null || d.actualAmount().compareTo(snap.amount()) != 0)
        throw new IllegalArgumentException("签署金额与确认结果不一致，须先有权办理变化，不得静默新增实质义务");
      signedHash = proof(p, d.signedFileVersionId());
    }
    String ph = proof(p, d.evidenceVersionId());
    if (data.state(t(), id, r.version(), r.status(), next, null) != 1)
      throw new AgencyConflictException("文书状态变化");
    event(p, id, next, Map.of("action", d, "evidenceHash", ph, "signedHash", signedHash));
    var result = data.document(t(), id);
    s.remember(k, h, result);
    return result;
  }

  @Transactional
  public Issue issue(String p, String id, IssueDraft d) {
    access(p, true);
    s.guard.permissions().require("buyer:agency:post:issue");
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须核对事项材料、责任人及处理期限");
    s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "post-issue:" + d.idempotencyKey(), h = s.begin(k, Arrays.asList(p, id, d));
    var cached = s.remembered(k);
    if (cached != null) return s.json.read(cached, Issue.class);
    s.text(d.kind(), 100, true, "事项类型");
    if (!Set.of("question", "complaint", "other").contains(d.kind()))
      throw new IllegalArgumentException("事项类型无效");
    s.text(d.title(), 500, true, "事项标题");
    s.text(d.handlingNote(), 8000, true, "实际办理说明");
    s.text(d.authorityDecision(), 4000, true, "有权决定或尚待决定说明");
    time(d.occurredAt());
    if (d.deadline() == null || d.deadline().isBefore(d.occurredAt()))
      throw new IllegalArgumentException("处理期限不得早于收到时间");
    if (s.packages.members(t(), p).stream().noneMatch(m -> m.userId().equals(d.ownerId()))
        && !Objects.equals(s.packages.find(t(), p).ownerId(), d.ownerId()))
      throw new IllegalArgumentException("须选择本项目责任人");
    if (!Set.of("open", "handling", "closed").contains(Objects.toString(d.status(), "")))
      throw new IllegalArgumentException("事项状态无效");
    String effect = Objects.toString(d.authorityEffect(), "no_decision");
    if (!Set.of("no_decision", "pause", "resume", "terminate").contains(effect))
      throw new IllegalArgumentException("有权决定执行类型无效");
    if (!effect.equals("no_decision")) {
      s.guard.permissions().require("buyer:agency:post:control");
      var control = data.control(t(), p);
      String current = control == null ? "active" : control.state();
      if (current.equals("terminated")
          || effect.equals("resume") && !current.equals("paused")
          || effect.equals("pause") && !current.equals("active"))
        throw new IllegalStateException("有权控制状态不允许该转换；终止不得自行恢复");
      String next =
          effect.equals("pause") ? "paused" : effect.equals("resume") ? "active" : "terminated";
      data.controlState(
          t(), p, next, proof(p, d.evidenceVersionId()), d.authorityDecision(), s.guard.actor());
    }
    String raw = s.json.write(Map.of("draft", d, "evidenceHash", proof(p, d.evidenceVersionId())));
    if (id == null) {
      if (!d.status().equals("open")) throw new IllegalArgumentException("新事项从待办理开始");
      id = id("issue");
      data.createIssue(new Issue(id, t(), p, 1, "open", raw, s.guard.actor(), null));
    } else {
      var old = data.issue(t(), id);
      if (old == null || !old.packageId().equals(p)) throw new PermissionDeniedException("事项不存在");
      s.expected(old.version(), d.expectedVersion());
      if (old.status().equals("closed")) throw new IllegalStateException("已关闭事项保留历史，应另行登记后续事项");
      if (data.updateIssue(t(), id, old.version(), d.status(), raw) != 1)
        throw new AgencyConflictException("事项版本变化");
    }
    event(
        p,
        id,
        "issue_" + d.status(),
        Map.of("draft", d, "evidenceHash", proof(p, d.evidenceVersionId())));
    var result = data.issue(t(), id);
    s.remember(k, h, result);
    return result;
  }
}
