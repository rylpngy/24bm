package com.procurement.tender.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.tender.domain.*;
import com.procurement.tender.infrastructure.*;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenderScoringRuleService {
  private final TenderMapper tenders;
  private final TenderScoringRuleMapper rules;
  private final TenderDocumentReviewMapper reviews;
  private final TenderReadAccess access;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  public TenderScoringRuleService(TenderMapper tenders,TenderScoringRuleMapper rules,TenderDocumentReviewMapper reviews,
      TenderReadAccess access,PermissionService permissions,AuditLogApplicationService audit) {
    this.tenders=tenders;this.rules=rules;this.reviews=reviews;this.access=access;this.permissions=permissions;this.audit=audit;
  }
  public record View(String evaluationMethod,int revision,TenderScoringWeights weights,List<TenderScoringRuleMapper.Rule> history) {}
  public View read(String tenderId) {
    access.require(tenderId);
    var tenantId=TenantAccessGuard.requireTenantId("tender scoring");
    var tender=tenders.findByTenantAndId(tenantId,tenderId);
    var history=rules.history(tenantId,tenderId);
    var current=history.isEmpty()?null:history.getFirst();
    return new View(tender.evaluationMethod(),current==null?0:current.revision(),current==null?TenderScoringWeights.DEFAULT:current.weights(),history);
  }
  @Transactional
  public View save(String tenderId,TenderScoringWeights weights,String reason,int expectedRevision) {
    permissions.require("buyer:tender:manage");access.require(tenderId);
    var tenantId=TenantAccessGuard.requireTenantId("tender scoring");
    var tender=tenders.lockByTenantAndId(tenantId,tenderId);
    TenderPolicy.requireDrafting(tender.status(),tenderId);
    if (!"综合评分法".equals(tender.evaluationMethod())) throw new IllegalStateException("最低评标价法按有效报价排序，无需配置综合权重");
    if (reviews.list(tenantId,tenderId).stream().anyMatch(r->r.status().equals("processing"))) throw new IllegalStateException("采购文件审查中，不能调整评分规则");
    var latest=rules.latest(tenantId,tenderId);
    int revision=latest==null?0:latest.revision();
    if (expectedRevision!=revision) throw new IllegalStateException("评分规则已更新，请刷新后重试");
    if (reason==null || reason.isBlank() || reason.length()>1000) throw new IllegalArgumentException("请填写规则编制或调整依据（不超过1000字）");
    rules.insert(tenantId,tenderId,revision+1,weights,reason.trim(),TenantAccessGuard.requireUserId("tender scoring"));
    audit.recordCurrentTenantAction("tender.scoring_rule.saved","tender",tenderId,"评分规则版本"+(revision+1)+"：技术/商务/价格="+weights.technical()+"/"+weights.commercial()+"/"+weights.price());
    return read(tenderId);
  }
}
