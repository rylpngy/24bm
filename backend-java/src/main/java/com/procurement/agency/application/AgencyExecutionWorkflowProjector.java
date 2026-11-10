package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyExecutionWorkflowProjector {
  private final AgencyExecutionMapper data;
  private final AgencyMapper packages;
  private final AgencyDocumentBasis basis;
  private final AuditLogApplicationService audit;

  public AgencyExecutionWorkflowProjector(
      AgencyExecutionMapper data,
      AgencyMapper packages,
      AgencyDocumentBasis basis,
      AuditLogApplicationService audit) {
    this.data = data;
    this.packages = packages;
    this.basis = basis;
    this.audit = audit;
  }

  @Transactional
  public void validate(WorkflowBusinessInstance instance) {
    if (instance.businessType().equals("agency_template_publication")) {
      var v = data.templateVersionById(instance.tenantId(), instance.businessId());
      if (v == null) throw new IllegalStateException("模板版本不存在");
      var t = data.lockTemplate(instance.tenantId(), v.templateId());
      if (!"processing".equals(v.status())
          || !instance.id().equals(v.workflowId())
          || v.ordinal() != t.latestOrdinal()) throw new IllegalStateException("模板待审版本已变化");
      return;
    }
    var r = data.revision(instance.tenantId(), instance.businessId());
    if (r == null) throw new IllegalStateException("采购文件版本不存在");
    var d = data.document(instance.tenantId(), r.documentId());
    var p = packages.lock(instance.tenantId(), d.packageId());
    d = data.lockDocument(instance.tenantId(), d.id());
    if (!"approved".equals(p.status())
        || p.workflowId() != null
        || !"processing".equals(r.status())
        || !"reviewing".equals(d.status())
        || !instance.id().equals(r.workflowId())
        || !r.id().equals(d.currentRevisionId())
        || d.version() != r.inputVersion()
        || basis.stale(instance.tenantId(), p.id(), d.basisJson()))
      throw new IllegalStateException("采购文件、档案或需求基线已变化，请撤回后复核新版本");
  }

  @Transactional
  public void complete(
      WorkflowBusinessInstance instance, String outcome, String actor, String comment) {
    if (instance.businessType().equals("agency_template_publication")) {
      var v = data.templateVersionById(instance.tenantId(), instance.businessId());
      if (v == null) throw new IllegalStateException("模板版本不存在");
      var t = data.lockTemplate(instance.tenantId(), v.templateId());
      String result = outcome.equals("approved") ? "published" : outcome;
      if (!"processing".equals(v.status())) {
        if (v.status().equals(result) && instance.id().equals(v.workflowId())) return;
        throw new IllegalStateException("模板审核已结束");
      }
      if (!instance.id().equals(v.workflowId()) || v.ordinal() != t.latestOrdinal())
        throw new IllegalStateException("模板版本已变化");
      if (!outcome.equals("withdrawn") && actor.equals(v.requestedBy()))
        throw new IllegalStateException("不得自行审核模板");
      data.templateState(
          instance.tenantId(),
          v.id(),
          "processing",
          result,
          instance.id(),
          v.requestedBy(),
          comment);
      if (outcome.equals("approved")) data.publishTemplate(instance.tenantId(), t.id(), v.id());
      audit.recordTenantAction(
          instance.tenantId(), "agency.template." + result, "agency_template", t.id(), comment);
      return;
    }
    var r = data.revision(instance.tenantId(), instance.businessId());
    if (r == null) throw new IllegalStateException("文件版本不存在");
    var d = data.document(instance.tenantId(), r.documentId());
    packages.lock(instance.tenantId(), d.packageId());
    d = data.lockDocument(instance.tenantId(), d.id());
    if (!"processing".equals(r.status())) {
      if (outcome.equals(r.status()) && instance.id().equals(r.workflowId())) return;
      throw new IllegalStateException("文件审核已结束");
    }
    if (!instance.id().equals(r.workflowId())
        || !r.id().equals(d.currentRevisionId())
        || d.version() != r.inputVersion()) throw new IllegalStateException("送审版本已变化");
    if (!outcome.equals("withdrawn")) {
      validate(instance);
      if (actor.equals(r.requestedBy())) throw new IllegalStateException("不得自行审核采购文件");
    }
    if (data.revisionState(
            instance.tenantId(),
            r.id(),
            "processing",
            outcome,
            instance.id(),
            r.requestedBy(),
            comment)
        != 1) throw new IllegalStateException("审批结果回写失败");
    data.documentState(instance.tenantId(), d.id(), d.version(), outcome, r.id());
    audit.recordTenantAction(
        instance.tenantId(),
        "agency.document." + outcome,
        "agency_package",
        d.packageId(),
        comment);
  }
}
