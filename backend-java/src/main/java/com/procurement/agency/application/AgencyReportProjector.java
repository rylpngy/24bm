package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecommendationRecords.*;
import com.procurement.agency.infrastructure.AgencyRecommendationMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyReportProjector {
  private final AgencyAssessmentContext c;
  private final AgencyRecommendationMapper data;
  private final AgencyEvaluationEvidence evidence;

  public AgencyReportProjector(
      AgencyAssessmentContext c,
      AgencyRecommendationMapper data,
      AgencyEvaluationEvidence evidence) {
    this.c = c;
    this.data = data;
    this.evidence = evidence;
  }

  private Submission valid(WorkflowBusinessInstance i) {
    var sub = data.submission(i.tenantId(), i.businessId());
    if (sub == null) throw new IllegalStateException("报告审核记录不存在");
    var r = data.report(i.tenantId(), sub.reportId());
    if (r == null) throw new IllegalStateException("报告不存在");
    c.s.packages.lock(i.tenantId(), r.packageId());
    var snap = c.s.json.tree(sub.snapshotJson());
    var wf = c.s.json.tree(i.businessSnapshot());
    var rec = data.recommendation(i.tenantId(), r.recommendationId());
    if (!sub.status().equals("processing")
        || !i.id().equals(sub.workflowId())
        || !r.status().equals("reviewing")
        || r.version() != sub.reportVersion()
        || rec == null
        || !c.s.json.hash(c.s.json.read(sub.snapshotJson(), Map.class)).equals(sub.frozenHash())
        || !wf.path("snapshotHash").asText().equals(sub.frozenHash())
        || !wf.path("submissionId").asText().equals(sub.id())
        || !snap.path("reportId").asText().equals(r.id())
        || snap.path("reportVersion").asLong() != r.version()
        || !snap.path("recommendationHash").asText().equals(rec.frozenHash())
        || !snap.path("narrative").equals(c.s.json.tree(r.narrativeJson()))
        || !snap.path("fileVersionId").asText().equals(r.artifactVersionId())
        || !snap.path("fileHash").asText().equals(r.artifactHash()))
      throw new IllegalStateException("报告审核冻结范围不一致");
    return sub;
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i, boolean approved) {
    var sub = valid(i);
    if (c.s.guard.actor().equals(sub.createdBy())
        || data.contributors(i.tenantId(), sub.reportId()).contains(c.s.guard.actor()))
      throw new PermissionDeniedException("不得自行审核报告");
    c.s.guard.permissions().require("buyer:agency:report:approve");
    c.s.guard.permissions().require("buyer:agency:report:read");
    c.s.guard.permissions().require("buyer:agency:report:confidential");
    var r = data.report(i.tenantId(), sub.reportId());
    if (!c.s
        .json
        .tree(sub.snapshotJson())
        .path("contributorsHash")
        .asText()
        .equals(c.s.json.hash(data.contributors(i.tenantId(), sub.reportId()))))
      throw new IllegalStateException("报告参与编制人员范围变化，须重新核对独立审核");
    c.s.guard.require(r.packageId(), false);
    if (approved) {
      c.s.guard.requireApproved(r.packageId());
      var session = c.data.session(i.tenantId(), r.sessionId());
      if (c.evaluations.roundForAssessment(r.packageId(), session.roundId()).frozenBasisStale()
          || !c.controls.reviewBlockers(session.roundId()).isEmpty()
          || !evidence.stamp(i.tenantId(), r.sessionId()).equals(sub.sourceFingerprint()))
        throw new IllegalStateException("评审依据已变化或存在未处理事项，不能审核通过旧报告");
      var v = c.s.source(r.artifactVersionId(), r.packageId());
      if (!v.hash().equals(r.artifactHash())) throw new IllegalStateException("报告字节不一致");
    }
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, String status, String actor, String note) {
    var existing = data.submission(i.tenantId(), i.businessId());
    if (existing != null
        && existing.status().equals(status)
        && i.id().equals(existing.workflowId())) return;
    var sub = valid(i);
    if (!status.equals("withdrawn")) validate(i, status.equals("approved"));
    else if (!actor.equals(sub.createdBy())) throw new PermissionDeniedException("仅提交人可撤回");
    var r = data.report(i.tenantId(), sub.reportId());
    if (data.complete(i.tenantId(), sub.id(), i.id(), status, Objects.toString(note, "")) != 1
        || data.state(
                i.tenantId(),
                r.id(),
                r.version(),
                "reviewing",
                status.equals("withdrawn") ? "draft" : status)
            != 1) throw new IllegalStateException("报告审核回写冲突");
    c.s.event(
        r.packageId(),
        "report_" + status,
        r.id(),
        null,
        Map.of("submission", sub.id(), "hash", sub.frozenHash()),
        "报告内部审核，不替代签署与采购人结果确认");
  }
}
