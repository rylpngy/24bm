package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyConflictException;
import com.procurement.agency.domain.AgencyRecommendationRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.attachment.application.AttachmentArtifactWriter;
import com.procurement.workflow.application.*;
import java.io.*;
import java.util.*;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyReportService {
  private final AgencyRecommendationService recommendations;
  private final AgencyRecommendationMapper data;
  private final AgencyAssessmentContext c;
  private final AgencyEvaluationEvidence evidence;
  private final UnifiedWorkflowApplicationService workflows;
  private final AttachmentArtifactWriter writer;
  private final AgencyFiles files;
  private final AgencyFinalResponseMapper finalResponses;
  private final AgencyMethodProcedureService procedures;

  public AgencyReportService(
      AgencyRecommendationService recommendations,
      AgencyRecommendationMapper data,
      AgencyAssessmentContext c,
      AgencyEvaluationEvidence evidence,
      UnifiedWorkflowApplicationService workflows,
      AttachmentArtifactWriter writer,
      AgencyFiles files,
      AgencyFinalResponseMapper finalResponses,
      AgencyMethodProcedureService procedures) {
    this.recommendations = recommendations;
    this.data = data;
    this.c = c;
    this.evidence = evidence;
    this.workflows = workflows;
    this.writer = writer;
    this.files = files;
    this.finalResponses = finalResponses;
    this.procedures = procedures;
  }

  private String tenant() {
    return c.s.guard.tenant();
  }

  private void access(String pkg, String session, boolean write) {
    var a = c.access(pkg, session, write);
    c.organizer(a.config());
    c.s.guard.permissions().require("buyer:agency:report:read");
    c.s.guard.permissions().require("buyer:agency:report:confidential");
    if (write) c.s.guard.permissions().require("buyer:agency:report:manage");
  }

  private Report require(String pkg, String session, String id) {
    var r = data.report(tenant(), id);
    if (r == null || !r.sessionId().equals(session) || !r.packageId().equals(pkg))
      throw new IllegalArgumentException("报告不属于当前项目及任务");
    return r;
  }

  private void draft(Report r) {
    if (!Set.of("draft", "rejected").contains(r.status()))
      throw new IllegalStateException("报告已进入审核或已通过，须保留历史另建版本，不能覆盖");
  }

  private void narrative(Narrative n) {
    if (n == null) throw new IllegalArgumentException("缺少报告叙述");
    c.s.text(n.reviewProcess(), 8000, true, "实际评审过程");
    c.s.text(n.reasoning(), 8000, true, "推荐理由");
    c.s.text(n.exceptionHandling(), 8000, true, "异常或无异常的核对说明");
    c.s.text(n.conclusion(), 8000, true, "报告结论叙述（不替代采购人确认）");
  }

  @Transactional
  public Report create(String pkg, String session, Draft d) {
    access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少报告草稿");
    narrative(d.narrative());
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "report-create:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(session, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Report.class);
    recommendations.require(pkg, session, d.recommendationId(), true);
    if (data.reports(tenant(), session).size() >= 100)
      throw new IllegalStateException("报告版本技术上限100，历史不得删除");
    var r =
        new Report(
            "agency-report-" + UUID.randomUUID(),
            tenant(),
            pkg,
            session,
            d.recommendationId(),
            "draft",
            1,
            c.s.json.write(d.narrative()),
            null,
            null,
            null,
            c.s.guard.actor(),
            null);
    data.createReport(r);
    data.contributor(tenant(), r.id(), c.s.guard.actor());
    c.s.remember(k, h, r);
    return data.report(tenant(), r.id());
  }

  @Transactional
  public Report save(String pkg, String session, String id, Draft d) {
    access(pkg, session, true);
    if (d == null) throw new IllegalArgumentException("缺少叙述修改");
    narrative(d.narrative());
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "report-save:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(id, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Report.class);
    var r = require(pkg, session, id);
    draft(r);
    c.s.expected(r.version(), d.expectedVersion());
    if (d.recommendationId() != null && !r.recommendationId().equals(d.recommendationId()))
      throw new IllegalArgumentException("不能通过叙述编辑替换计算或推荐依据，应建立新报告");
    if (data.saveReport(tenant(), id, r.version(), c.s.json.write(d.narrative())) != 1)
      throw new AgencyConflictException("报告已变化");
    data.contributor(tenant(), id, c.s.guard.actor());
    var saved = data.report(tenant(), id);
    c.s.event(
        pkg,
        "report_narrative_saved",
        id,
        null,
        Map.of("version", saved.version(), "narrativeHash", c.s.json.hash(d.narrative())),
        "叙述编辑保留审计，不替换推荐或计算来源");
    c.s.remember(k, h, saved);
    return saved;
  }

  private void command(Report r, Command d) {
    if (d == null || !d.reviewed()) throw new IllegalArgumentException("须人工核对源版本、报告内容及影响范围");
    c.s.expected(r.version(), d.expectedVersion());
    if (!Objects.equals(evidence.stamp(tenant(), r.sessionId()), d.expectedFingerprint()))
      throw new AgencyConflictException("评审依据已变化，须重新核对报告");
    c.s.text(d.reason(), 2000, true, "办理依据");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
  }

  @Transactional
  public Artifact generate(String pkg, String session, String id, Command d) {
    access(pkg, session, true);
    var r = require(pkg, session, id);
    draft(r);
    command(r, d);
    var recommendation = recommendations.require(pkg, session, r.recommendationId(), true);
    String k = "report-generate:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(id, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Artifact.class);
    if (r.artifactBasisVersion() != null && r.artifactBasisVersion() == r.version()) {
      var existing =
          data.artifacts(tenant(), session).stream()
              .filter(
                  a ->
                      a.reportId().equals(id)
                          && a.reportVersion() == r.version()
                          && a.fileVersionId().equals(r.artifactVersionId()))
              .findFirst();
      if (existing.isPresent()) {
        c.s.remember(k, h, existing.get());
        return existing.get();
      }
    }
    data.contributor(tenant(), id, c.s.guard.actor());
    byte[] bytes = render(r, recommendation);
    String file = "agency-file-" + UUID.randomUUID(),
        version = "agency-fv-" + UUID.randomUUID(),
        artifact = "agency-report-artifact-" + UUID.randomUUID(),
        name = "评审报告-" + id + "-V" + r.version() + ".docx";
    c.s.packages.createFile(
        tenant(), file, pkg, name, "evaluation_report", "restricted", c.s.guard.actor());
    c.s.packages.createVersion(tenant(), version, file, 1, c.s.guard.actor(), "受控评审报告生成");
    data.createArtifact(
        new Artifact(
            artifact,
            tenant(),
            id,
            r.version(),
            version,
            "",
            recommendation.sourceFingerprint(),
            c.s.guard.actor(),
            null));
    var stored =
        writer.write(
            "agency_file_version",
            version,
            name,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            bytes);
    if (c.s.packages.seal(tenant(), version, stored.attachmentId(), stored.hash(), stored.size())
            != 1
        || data.artifactHash(tenant(), artifact, stored.hash()) != 1
        || data.artifact(tenant(), id, r.version(), version, stored.hash()) != 1)
      throw new IllegalStateException("报告生成封存失败");
    var saved =
        data.artifacts(tenant(), session).stream()
            .filter(a -> a.id().equals(artifact))
            .findFirst()
            .orElseThrow();
    c.s.event(
        pkg,
        "report_generated",
        id,
        null,
        Map.of("artifact", artifact, "hash", stored.hash(), "version", r.version()),
        "生成不等同已审核、已签署或结果已确认");
    c.s.remember(k, h, saved);
    return saved;
  }

  private void para(XWPFDocument doc, String text, boolean bold) {
    var p = doc.createParagraph();
    var run = p.createRun();
    run.setFontFamily("宋体");
    run.setFontSize(bold ? 14 : 11);
    run.setBold(bold);
    String value = Objects.toString(text, "");
    for (var line : value.split("\\R", -1)) {
      run.setText(line);
      run.addBreak();
    }
  }

  private byte[] render(Report report, Recommendation rec) {
    var snap = c.s.json.read(rec.snapshotJson(), Snapshot.class);
    var n = c.s.json.read(report.narrativeJson(), Narrative.class);
    var pkg = c.s.packages.find(tenant(), report.packageId());
    var session = c.data.session(tenant(), report.sessionId());
    var round = c.rounds.round(tenant(), session.roundId());
    var cfg =
        c.s.json.read(
            c.s.json.tree(round.frozenJson()).path("config").toString(),
            com.procurement.agency.domain.AgencyEvaluationRecords.Config.class);
    long chars = n.toString().length();
    try (var doc = new XWPFDocument();
        var out = new ByteArrayOutputStream()) {
      String title =
          snap.method().equals("单一来源")
              ? "单一来源专业协商报告"
              : Set.of("公开招标", "邀请招标").contains(snap.method()) ? "评标报告" : snap.method() + "评审报告";
      para(doc, title, true);
      para(
          doc,
          pkg.title()
              + "\n编号："
              + pkg.number()
              + "\n采购方式："
              + snap.method()
              + "\n轮次："
              + session.roundId(),
          false);
      para(doc, "本报告的内部审批和签署状态以系统记录及真实签署件为准；生成不表示结果已经采购人确认。", false);
      para(doc, "一、实际过程与规则依据", true);
      para(
          doc,
          n.reviewProcess()
              + "\n规则原文位置："
              + snap.inputs().locator()
              + "\n推荐规则："
              + snap.inputs().configuredRule().ruleText(),
          false);
      para(doc, "二、冻结人员与职责", true);
      var roster = c.s.json.tree(round.frozenJson()).path("basis").path("members");
      for (var m : roster)
        para(doc, m.path("name").asText() + " · " + roleNames(m.path("roles")), false);
      para(doc, "三、计算或专业协商来源及人工推荐", true);
      for (var row : snap.comparisons())
        para(
            doc,
            row.supplierName()
                + "；比较指标："
                + (row.metric() == null ? "不进行竞争比较" : row.metric().toPlainString())
                + "；响应／协商金额："
                + row.responseAmount().toPlainString()
                + " "
                + row.currency()
                + "；来源："
                + row.sourceId(),
            false);
      para(doc, "政策评审价只用于评审比较，响应金额独立列示。", false);
      for (int i = 0; i < snap.candidates().size(); i++)
        para(doc, "人工推荐候选" + (i + 1) + "：" + snap.candidates().get(i).supplierName(), false);
      para(
          doc,
          n.reasoning()
              + "\n同分／同价有权处理："
              + Objects.toString(snap.tieReason(), "无")
              + "\n推荐依据SHA256："
              + rec.frozenHash(),
          false);
      if (!snap.method().equals("单一来源")) {
        para(doc, "四、成员独立意见及原始引用", true);
        boolean finalPlan =
            finalResponses.plan(tenant(), session.id()) != null
                && finalResponses.plan(tenant(), session.id()).mode().equals("active");
        for (var member : cfg.members()) {
          for (var sheet : c.data.sheets(tenant(), session.id(), member.userId()))
            if (sheet.status().equals("submitted")
                && (!finalPlan || !sheet.stageKey().equals("evaluation"))) {
              var line =
                  "本人记录："
                      + memberName(round.frozenJson(), sheet.userId())
                      + " / "
                      + sheet.id()
                      + " / SHA256 "
                      + sheet.contentHash()
                      + "\n"
                      + entryText(sheet.entriesJson(), session.subjectsJson(), cfg);
              chars += line.length();
              if (chars > 1_000_000)
                throw new IllegalStateException("意见超过单份报告生成容量，须按有权程序分册归档，不截断原意见");
              para(doc, line, false);
            }
          if (finalPlan) {
            var sheet = finalResponses.mine(tenant(), session.id(), member.userId());
            if (sheet != null && sheet.status().equals("submitted")) {
              var line =
                  "最终响应本人记录："
                      + memberName(round.frozenJson(), sheet.userId())
                      + " / "
                      + sheet.id()
                      + " / SHA256 "
                      + sheet.frozenHash()
                      + "\n"
                      + entryText(sheet.entriesJson(), session.subjectsJson(), cfg);
              chars += line.length();
              if (chars > 1_000_000) throw new IllegalStateException("意见超过单份报告生成容量，须分册组织，不截断原意见");
              para(doc, line, false);
            }
          }
        }
      } else {
        var professional = proceduresSnapshot(session.roundId());
        para(doc, "四、专业协商、价格合理性及质量保障", true);
        para(doc, professional, false);
      }
      para(doc, "五、异常处理及报告结论", true);
      para(doc, n.exceptionHandling() + "\n" + n.conclusion() + "\n本报告保留推荐结果，采购人有权确认另行办理。", false);
      doc.write(out);
      return out.toByteArray();
    } catch (IOException ex) {
      throw new IllegalStateException("报告生成失败", ex);
    }
  }

  private String roleNames(com.fasterxml.jackson.databind.JsonNode roles) {
    var names =
        Map.of(
            "organizer",
            "组织人员",
            "leader",
            "组长",
            "review_member",
            "评审成员",
            "purchaser_rep",
            "采购人代表",
            "qualification_reviewer",
            "资格审查人员",
            "conformity_reviewer",
            "符合性审查人员");
    var out = new ArrayList<String>();
    for (var r : roles) out.add(names.getOrDefault(r.asText(), "其他已冻结职责"));
    return String.join("、", out);
  }

  private String memberName(String raw, String user) {
    for (var m : c.s.json.tree(raw).path("basis").path("members"))
      if (m.path("userId").asText().equals(user)) return m.path("name").asText();
    return "冻结成员";
  }

  private String entryText(
      String entries,
      String subjects,
      com.procurement.agency.domain.AgencyEvaluationRecords.Config cfg) {
    var out = new StringBuilder();
    for (var e : c.s.json.tree(entries)) {
      String supplier = "响应对象", criterion = e.path("criterionKey").asText();
      for (var sub : c.s.json.tree(subjects))
        if (sub.path("participationId").asText().equals(e.path("participationId").asText()))
          supplier = sub.path("supplierName").asText();
      for (var r : cfg.rules())
        if (r.configuredRule().key().equals(criterion)) criterion = r.configuredRule().title();
      String conclusion =
          switch (e.path("conclusion").asText()) {
            case "pass" -> "通过";
            case "fail" -> "不通过";
            case "pending" -> "待明确";
            default -> e.path("conclusion").asText();
          };
      out.append(supplier)
          .append(" / ")
          .append(criterion)
          .append("；结论：")
          .append(conclusion)
          .append("；得分：")
          .append(e.path("score").isNull() ? "不适用" : e.path("score").asText())
          .append("；原文依据：")
          .append(e.path("evidence").asText())
          .append("；独立意见：")
          .append(e.path("opinion").asText())
          .append("\n");
    }
    return out.toString();
  }

  private String proceduresSnapshot(String round) {
    var r = procedures.latest(round, "single_negotiation");
    if (r == null) throw new IllegalStateException("专业协商依据缺失");
    var n =
        c.s.json.read(
            c.s.json.tree(r.snapshotJson()).path("content").toString(),
            com.procurement.agency.domain.AgencyMethodRecords.Negotiation.class);
    return "实际人员："
        + n.staffUserIds().stream()
            .map(user -> memberName(c.rounds.round(tenant(), round).frozenJson(), user))
            .toList()
        + "\n价格合理性："
        + n.priceReasonability()
        + "\n质量保障："
        + n.qualityAssurance()
        + "\n线下确认："
        + n.supplierConfirmationNote()
        + "\n协商依据SHA256："
        + r.frozenHash();
  }

  @Transactional
  public Submission submit(String pkg, String session, String id, Command d) {
    access(pkg, session, true);
    var r = require(pkg, session, id);
    if (d == null) throw new IllegalArgumentException("缺少提交参数");
    c.s.text(d.idempotencyKey(), 100, true, "幂等键");
    String k = "report-submit:" + d.idempotencyKey(), h = c.s.begin(k, Arrays.asList(id, d));
    var cached = c.s.remembered(k);
    if (cached != null) return c.s.json.read(cached, Submission.class);
    draft(r);
    command(r, d);
    var rec = recommendations.require(pkg, session, r.recommendationId(), true);
    if (r.artifactVersionId() == null
        || r.artifactBasisVersion() == null
        || r.artifactBasisVersion() != r.version())
      throw new IllegalStateException("须先按当前叙述和依据重新生成封存报告，不能提审旧生成稿");
    var v = c.s.source(r.artifactVersionId(), pkg);
    if (!v.hash().equals(r.artifactHash())) throw new IllegalStateException("报告实际字节指纹不一致");
    data.contributor(tenant(), id, c.s.guard.actor());
    Map<String, Object> snap = new TreeMap<>();
    snap.put("contributorsHash", c.s.json.hash(data.contributors(tenant(), id)));
    snap.put("reportId", id);
    snap.put("reportVersion", r.version() + 1);
    snap.put("recommendationId", rec.id());
    snap.put("recommendationHash", rec.frozenHash());
    snap.put("sourceFingerprint", rec.sourceFingerprint());
    snap.put("narrative", c.s.json.read(r.narrativeJson(), Map.class));
    snap.put("fileVersionId", r.artifactVersionId());
    snap.put("fileHash", r.artifactHash());
    snap.put("reason", d.reason());
    String raw = c.s.json.write(snap), sub = "agency-report-submission-" + UUID.randomUUID();
    data.createSubmission(
        new Submission(
            sub,
            tenant(),
            id,
            r.version() + 1,
            rec.sourceFingerprint(),
            raw,
            c.s.json.hash(c.s.json.read(raw, Map.class)),
            "processing",
            null,
            "",
            c.s.guard.actor(),
            null));
    var wf =
        workflows.start(
            new WorkflowStartCommand(
                "agency_evaluation_report",
                sub,
                c.s.packages.find(tenant(), pkg).departmentId(),
                null,
                d.formData() == null ? Map.of() : d.formData(),
                Map.of(
                    "packageId",
                    pkg,
                    "reportId",
                    id,
                    "submissionId",
                    sub,
                    "snapshotHash",
                    c.s.json.hash(c.s.json.read(raw, Map.class)),
                    "fileVersionId",
                    r.artifactVersionId(),
                    "fileHash",
                    r.artifactHash())));
    if (data.bind(tenant(), sub, wf.workflowInstanceId()) != 1
        || data.state(tenant(), id, r.version(), r.status(), "reviewing") != 1)
      throw new IllegalStateException("报告提审绑定失败");
    var saved = data.submission(tenant(), sub);
    c.s.remember(k, h, saved);
    return saved;
  }

  @Transactional
  public void withdraw(String pkg, String session, String submissionId, String reason) {
    access(pkg, session, false);
    var sub = data.submission(tenant(), submissionId);
    if (sub == null || !sub.createdBy().equals(c.s.guard.actor()))
      throw new com.procurement.common.tenant.PermissionDeniedException("仅提交人可撤回报告审核");
    var r = require(pkg, session, sub.reportId());
    workflows.withdrawAgencyExecution(sub.workflowId(), reason);
  }
}
