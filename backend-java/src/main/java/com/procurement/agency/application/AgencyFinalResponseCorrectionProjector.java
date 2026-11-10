package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.Correction;
import com.procurement.agency.infrastructure.AgencyFinalResponseMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyFinalResponseCorrectionProjector {
  private final AgencyAssessmentContext c;
  private final AgencyFinalResponseMapper data;
  private final com.procurement.agency.infrastructure.AgencyFinalQuoteMapper finals;

  public AgencyFinalResponseCorrectionProjector(
      AgencyAssessmentContext c,
      AgencyFinalResponseMapper data,
      com.procurement.agency.infrastructure.AgencyFinalQuoteMapper finals) {
    this.c = c;
    this.data = data;
    this.finals = finals;
  }

  public boolean handles(WorkflowBusinessInstance i) {
    return data.correction(i.tenantId(), i.businessId()) != null;
  }

  private Correction valid(WorkflowBusinessInstance i) {
    var r = data.correction(i.tenantId(), i.businessId());
    if (r == null) throw new IllegalStateException("最终响应更正申请不存在");
    var session = c.data.session(i.tenantId(), r.sessionId());
    if (session == null) throw new IllegalStateException("任务不存在");
    c.s.packages.lock(i.tenantId(), session.packageId());
    var sheet = data.byId(i.tenantId(), r.sheetId());
    var current = data.mine(i.tenantId(), r.sessionId(), r.userId());
    var snap = c.s.json.tree(i.businessSnapshot());
    if (!r.status().equals("processing")
        || !i.id().equals(r.workflowId())
        || sheet == null
        || !sheet.id().equals(current.id())
        || !sheet.status().equals("submitted")
        || sheet.version() != r.sheetVersion()
        || !Objects.equals(sheet.frozenHash(), r.sheetHash())
        || !snap.path("reviewKind").asText().equals("final_response")
        || !snap.path("sheetHash").asText().equals(r.sheetHash())
        || !snap.path("requestId").asText().equals(r.id())
        || !snap.path("reviewerId").asText().equals(r.userId())
        || !snap.path("reason").asText().equals(r.reason())
        || !snap.path("evidenceHash").asText().equals(r.evidenceHash())
        || !snap.path("cells").equals(c.s.json.tree(r.cellsJson())))
      throw new IllegalStateException("最终响应更正与原提交版本或审批冻结范围不一致");
    var plan = data.plan(i.tenantId(), r.sessionId());
    if (plan == null
        || !plan.mode().equals("active")
        || !c.s
            .json
            .tree(plan.snapshotJson())
            .path("campaignHash")
            .asText()
            .equals(c.s.json.hash(finals.campaign(i.tenantId(), r.sessionId())))
        || !c.s.json.hash(c.s.json.read(plan.snapshotJson(), Map.class)).equals(plan.frozenHash())
        || !c.s.json.hash(c.s.json.read(sheet.snapshotJson(), Map.class)).equals(sheet.frozenHash())
        || !c.s.json.tree(sheet.snapshotJson()).path("planHash").asText().equals(plan.frozenHash())
        || !c.s
            .json
            .tree(sheet.snapshotJson())
            .path("entries")
            .equals(c.s.json.tree(sheet.entriesJson())))
      throw new IllegalStateException("最终响应冻结指纹不一致");
    return r;
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i) {
    var r = valid(i);
    if (c.s.guard.actor().equals(r.userId())) throw new PermissionDeniedException("不得自行审批最终响应更正");
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:approve");
    var session = c.data.session(i.tenantId(), r.sessionId());
    var a = c.access(session.packageId(), session.id(), true);
    c.organizer(a.config());
    if (!c.s.source(r.evidenceVersionId(), session.packageId()).hash().equals(r.evidenceHash()))
      throw new IllegalStateException("更正凭证字节不一致");
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, String status, String actor, String note) {
    var r = data.correction(i.tenantId(), i.businessId());
    if (r != null && r.status().equals(status) && i.id().equals(r.workflowId())) return;
    r = valid(i);
    if (!status.equals("withdrawn")) validate(i);
    if (data.completeCorrection(i.tenantId(), r.id(), i.id(), status, note == null ? "" : note)
        != 1) throw new IllegalStateException("最终响应更正回写失败");
    if (status.equals("approved")) {
      var old = data.byId(i.tenantId(), r.sheetId());
      data.revision(
          "agency-final-response-" + UUID.randomUUID(),
          i.tenantId(),
          r.sessionId(),
          r.userId(),
          old.ordinal() + 1,
          old.id(),
          r.id(),
          old.entriesJson());
    }
    var session = c.data.session(i.tenantId(), r.sessionId());
    c.s.event(
        session.packageId(),
        "final_response_correction_" + status,
        r.id(),
        null,
        Map.of("sheetHash", r.sheetHash(), "workflowId", i.id(), "actor", actor),
        "最终响应限定更正；不公开原意见、不自动恢复计算");
  }
}
