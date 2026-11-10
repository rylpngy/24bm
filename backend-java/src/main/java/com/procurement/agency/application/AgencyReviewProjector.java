package com.procurement.agency.application;

import com.procurement.agency.domain.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyReviewProjector {
  private final AgencyMapper mapper;
  private final AgencyJson json;
  private final AuditLogApplicationService audit;

  public AgencyReviewProjector(
      AgencyMapper mapper, AgencyJson json, AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.json = json;
    this.audit = audit;
  }

  @org.springframework.beans.factory.annotation.Autowired
  private AgencyPlanInitializer planInitializer;

  public AgencyMapper mapper() {
    return mapper;
  }

  public AgencyJson json() {
    return json;
  }

  public AuditLogApplicationService audit() {
    return audit;
  }

  public void members(String tenant, String id, Draft d) {
    mapper.endMembers(tenant, id);
    if (d.ownerId() != null) mapper.member(tenant, id, d.ownerId(), "OWNER");
    for (Member m : d.members()) mapper.member(tenant, id, m.userId(), m.role());
  }

  public void history(PackageRow p, String reason, String actor) {
    mapper.insertHistory(p.tenantId(), p.id(), p.version(), p.dataJson(), reason, actor);
  }

  @Transactional
  public void validate(WorkflowBusinessInstance instance) {
    Review review = mapper.reviewById(instance.tenantId(), instance.businessId());
    if (review == null) throw new IllegalStateException("审批记录不存在");
    PackageRow p = mapper.lock(instance.tenantId(), review.packageId());
    if (!"processing".equals(review.status())
        || !instance.id().equals(p.workflowId())
        || p.version() != review.baseVersion() + 1) throw new IllegalStateException("待审版本已变化");
  }

  @Transactional
  public void complete(
      WorkflowBusinessInstance instance, String outcome, String actor, String comment) {
    // Use the same package-before-review lock order as submit/withdraw to avoid deadlocks.
    Review source = mapper.reviewById(instance.tenantId(), instance.businessId());
    if (source == null) throw new IllegalStateException("建档审批记录不存在");
    PackageRow p = mapper.lock(instance.tenantId(), source.packageId());
    Review review = mapper.lockReview(instance.tenantId(), source.id());
    if (!"processing".equals(review.status())) {
      if (outcome.equals(review.status()) && instance.id().equals(review.workflowId())) return;
      throw new IllegalStateException("审批已结束或结果冲突");
    }
    if (!instance.id().equals(p.workflowId())
        || !instance.id().equals(review.workflowId())
        || p.version() != review.baseVersion() + 1)
      throw new IllegalStateException("审批对象或版本已变化，拒绝错批");
    if (!"withdrawn".equals(outcome) && actor.equals(review.requestedBy()))
      throw new IllegalStateException("不可审核自己提交的档案或变更");
    long version = p.version();
    String status = "archive".equals(review.kind()) ? outcome : "approved";
    if ("approved".equals(outcome) && "change".equals(review.kind())) {
      Draft proposed = json.read(review.proposedJson(), Draft.class);
      if (mapper.edit(p.tenantId(), p.id(), version, proposed, review.proposedJson()) != 1)
        throw new AgencyConflictException("变更版本冲突");
      members(p.tenantId(), p.id(), proposed);
      version++;
    }
    if (mapper.state(p.tenantId(), p.id(), version, status, null) != 1)
      throw new AgencyConflictException("审批回写冲突");
    if (mapper.completeReview(p.tenantId(), review.id(), outcome, comment) != 1)
      throw new AgencyConflictException("审批结果已变化");
    if (planInitializer != null && "archive".equals(review.kind()) && "approved".equals(outcome))
      planInitializer.ensure(mapper.find(p.tenantId(), p.id()));
    history(
        mapper.find(p.tenantId(), p.id()), "审批" + outcome + "：" + String.valueOf(comment), actor);
    audit.recordTenantAction(
        p.tenantId(), "agency." + review.kind() + "." + outcome, "agency_package", p.id(), comment);
  }
}
