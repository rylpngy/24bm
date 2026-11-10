package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyPostRecords.Document;
import com.procurement.agency.infrastructure.AgencyPostMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyPostProjector {
  final AgencyAssessmentContext c;
  final AgencyPostMapper data;
  final AgencyEvaluationEvidence evidence;

  public AgencyPostProjector(
      AgencyAssessmentContext c, AgencyPostMapper data, AgencyEvaluationEvidence evidence) {
    this.c = c;
    this.data = data;
    this.evidence = evidence;
  }

  Document valid(WorkflowBusinessInstance i) {
    var d = data.document(i.tenantId(), i.businessId());
    if (d == null) throw new IllegalStateException("标后文书不存在");
    c.s.packages.lock(i.tenantId(), d.packageId());
    var snap = c.s.json.tree(i.businessSnapshot());
    if (!d.status().equals("reviewing")
        || !i.id().equals(d.workflowId())
        || d.version() != snap.path("version").asLong()
        || !d.id().equals(snap.path("documentId").asText())
        || !d.frozenHash().equals(snap.path("snapshotHash").asText())
        || !d.fileVersionId().equals(snap.path("fileVersionId").asText())
        || !d.fileHash().equals(snap.path("fileHash").asText())
        || !c.s.json.hash(c.s.json.read(d.snapshotJson(), Map.class)).equals(d.frozenHash()))
      throw new IllegalStateException("标后审核冻结范围不一致");
    return d;
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i, boolean approved) {
    var d = valid(i);
    c.s.guard.permissions().require("buyer:agency:post:approve");
    c.s.guard.require(d.packageId(), false);
    if (d.createdBy().equals(c.s.guard.actor())) throw new PermissionDeniedException("不得自行审批标后文书");
    if (approved) {
      c.s.guard.requireApproved(d.packageId());
      var control = data.control(i.tenantId(), d.packageId());
      if (control != null && !control.state().equals("active"))
        throw new IllegalStateException("标后业务已暂停或终止，不能审批通过");
      var history = data.results(i.tenantId(), d.packageId());
      if (history.isEmpty() || !history.getFirst().id().equals(d.resultId()))
        throw new IllegalStateException("确认结果已变化");
      var result = history.getFirst();
      if (result.kind().equals("award")
          && !evidence.stamp(i.tenantId(), result.sessionId()).equals(result.sourceFingerprint()))
        throw new IllegalStateException("评审依据已变化，不能通过旧文书");
      if (!c.s.source(d.fileVersionId(), d.packageId()).hash().equals(d.fileHash()))
        throw new IllegalStateException("标后文书字节不一致");
    }
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, String status, String actor, String note) {
    var old = data.document(i.tenantId(), i.businessId());
    if (old != null && old.status().equals(status) && old.workflowId() == null) return;
    var d = valid(i);
    if (status.equals("generated")) {
      if (!i.initiatorId().equals(actor)) throw new PermissionDeniedException("仅发起人可撤回");
    } else validate(i, status.equals("approved"));
    if (data.state(i.tenantId(), d.id(), d.version(), "reviewing", status, null) != 1)
      throw new IllegalStateException("标后审批回写冲突");
    c.s.event(
        d.packageId(),
        "post_document_" + status,
        d.id(),
        null,
        Map.of("workflowId", i.id(), "hash", d.frozenHash()),
        Objects.toString(note, ""));
  }
}
