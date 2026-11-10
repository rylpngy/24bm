package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyExecutionService {
  private final AgencyExecutionSupport s;
  private final AgencyDocumentService documents;
  private final AgencyDemandService demands;
  private final AgencyPublicationService publications;
  private final AgencyCollaborationService collaboration;
  private final AgencyPlanInitializer plans;
  private final AgencyOfficeTransport office;
  private final com.procurement.common.ai.AiModelGateway ai;

  public AgencyExecutionService(
      AgencyExecutionSupport s,
      AgencyDocumentService documents,
      AgencyDemandService demands,
      AgencyPublicationService publications,
      AgencyCollaborationService collaboration,
      AgencyPlanInitializer plans,
      AgencyOfficeTransport office, com.procurement.common.ai.AiModelGateway ai) {
    this.s = s;
    this.documents = documents;
    this.demands = demands;
    this.publications = publications;
    this.collaboration = collaboration;
    this.plans = plans;
    this.office = office;this.ai=ai;
  }

  @Transactional
  public ExecutionView workspace(String pkg) {
    var p = s.read(pkg, "buyer:agency:read");
    plans.ensure(p);
    boolean doc = s.guard.permissions().currentUserHas("buyer:agency:document:read");
    return new ExecutionView(
        s.guard.permissions().currentUserHas("buyer:agency:demand:read")
            ? demands.list(pkg)
            : List.of(),
        doc ? documents.views(pkg) : List.of(),
        doc ? s.data.rule(s.guard.tenant(), pkg) : null,
        doc
            ? publications.readiness(pkg)
            : new Readiness(false, List.of("无采购文件查看权限"), null, null, true),
        doc ? s.data.publications(s.guard.tenant(), pkg) : List.of(),
        s.guard.permissions().currentUserHas("buyer:agency:participation:read")
            ? s.data.participations(s.guard.tenant(), pkg)
            : List.of(),
        s.guard.permissions().currentUserHas("buyer:agency:plan:read")
            ? s.data.milestones(s.guard.tenant(), pkg)
            : List.of(),
        s.guard.permissions().currentUserHas("buyer:agency:preparation:read")
            ? collaboration.preparation(pkg)
            : null,
        s.data.jobs(s.guard.tenant(), pkg).stream()
            .filter(
                j ->
                    s.guard.actor().equals(j.createdBy())
                        || s.guard
                            .permissions()
                            .currentUserHas(
                                !j.kind().equals("extract")
                                    ? "buyer:agency:document:read"
                                    : "buyer:agency:demand:read"))
            .toList(),
        ai.configured(),
        office.configured());
  }

  public Job job(String id) {
    var j = s.data.job(s.guard.tenant(), id);
    if (j == null) throw new IllegalArgumentException("任务不存在");
    s.read(
        j.packageId(),
        !j.kind().equals("extract") ? "buyer:agency:document:read" : "buyer:agency:demand:read");
    return j;
  }

  @Transactional
  public Job retry(String id) {
    var j = job(id);
    if (j.kind().equals("preview")) {
      s.guard.requireApproved(j.packageId());
      s.guard.permissions().require("buyer:agency:document:preview");
      s.guard.permissions().require("buyer:agency:file:manage");
    } else
      s.write(
          j.packageId(),
          !j.kind().equals("extract")
              ? "buyer:agency:document:manage"
              : "buyer:agency:demand:manage");
    if (!s.guard.actor().equals(j.createdBy())) throw new IllegalArgumentException("仅任务创建人可重试");
    if (j.kind().equals("compose")) {
      var d = s.data.document(s.guard.tenant(), j.documentId());
      if (d.version() != j.inputVersion()) throw new IllegalStateException("旧任务输入已过期，请重新生成任务");
    }
    if (s.data.retryJob(s.guard.tenant(), id) != 1) throw new IllegalStateException("仅失败任务可重试");
    return s.data.job(s.guard.tenant(), id);
  }
}
