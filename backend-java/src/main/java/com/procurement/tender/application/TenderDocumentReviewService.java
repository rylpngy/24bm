package com.procurement.tender.application;

import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderPolicy;
import com.procurement.tender.infrastructure.TenderMapper;
import com.procurement.tender.infrastructure.TenderDocumentReviewMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenderDocumentReviewService {
  private com.procurement.tender.infrastructure.TenderScoringRuleMapper scoringRules;
  @org.springframework.beans.factory.annotation.Autowired
  void setScoringRules(com.procurement.tender.infrastructure.TenderScoringRuleMapper rules) { this.scoringRules=rules; }
  public static final String TYPE = "tender_document_review";
  private final TenderMapper tenders;
  private final TenderDocumentReviewMapper reviews;
  private final AttachmentMapper attachments;
  private final TenderReadAccess access;
  private final PermissionService permissions;
  private final UnifiedWorkflowApplicationService workflows;
  private final AuditLogApplicationService audit;

  public TenderDocumentReviewService(TenderMapper tenders, TenderDocumentReviewMapper reviews,
      AttachmentMapper attachments, TenderReadAccess access, PermissionService permissions,
      UnifiedWorkflowApplicationService workflows, AuditLogApplicationService audit) {
    this.tenders=tenders; this.reviews=reviews; this.attachments=attachments; this.access=access;
    this.permissions=permissions; this.workflows=workflows; this.audit=audit;
  }

  public List<TenderDocumentReviewMapper.Review> history(String tenderId) {
    access.require(tenderId);
    return reviews.list(TenantAccessGuard.requireTenantId("tender review"),tenderId);
  }
  @io.swagger.v3.oas.annotations.media.Schema(name = "TenderDocumentReviewState")
  public record State(List<TenderDocumentReviewMapper.Review> reviews, boolean currentApproved) {}
  public State state(String tenderId) {
    var history=history(tenderId);
    var tender=tenders.findByTenantAndId(TenantAccessGuard.requireTenantId("tender review"),tenderId);
    return new State(history,!history.isEmpty() && history.getFirst().status().equals("approved")
        && history.getFirst().fingerprint().equals(fingerprint(tender)));
  }

  public void requireNotProcessing(String tenantId, String tenderId) {
    if(reviews.list(tenantId,tenderId).stream().anyMatch(r->r.status().equals("processing")))
      throw new IllegalStateException("采购文件审查中，不能修改文件或附件");
  }

  public void requireApproved(Tender tender) {
    var history=reviews.list(tender.tenantId(),tender.id());
    if(history.isEmpty() || !history.getFirst().status().equals("approved")
        || !history.getFirst().fingerprint().equals(fingerprint(tender)))
      throw new IllegalStateException("当前采购文件尚未审查通过，或文件已变更，请重新提交采购文件审查");
  }

  @Transactional
  public List<TenderDocumentReviewMapper.Review> submit(String tenderId, Map<String,Object> formData) {
    permissions.require("buyer:tender:manage"); access.require(tenderId);
    String tenantId=TenantAccessGuard.requireTenantId("tender review");
    Tender tender=tenders.lockByTenantAndId(tenantId,tenderId);
    TenderPolicy.requireDrafting(tender.status(),tenderId);
    if(tender.documentHtml()==null || tender.documentHtml().isBlank()) throw new IllegalArgumentException("请先编制采购文件正文");
    requireNotProcessing(tenantId,tenderId);
    String id="tdr-"+UUID.randomUUID();
    reviews.insert(id,tenantId,tenderId,fingerprint(tender),TenantAccessGuard.requireUserId("tender review"));
    workflows.start(new WorkflowStartCommand(TYPE,id,null,tender.budget(),formData==null?Map.of():formData,
        Map.of("title",tender.title(),"tenderId",tenderId,"tenderNo",tender.tenderNo(),"documentHtml",tender.documentHtml(),"fingerprint",fingerprint(tender),
          "attachmentIds",attachments.listActiveByTenantAndOwner(tenantId,"tender",tenderId).stream().map(a->a.id()).toList(),
          "scoringRule",scoringSnapshot(tender))));
    audit.recordTenantAction("tender.document_review.submitted","tender",tenderId);
    return reviews.list(tenantId,tenderId);
  }

  String fingerprint(Tender tender) {
    StringBuilder content=new StringBuilder(tender.toString());
    var rule=scoringSnapshot(tender);
    for(var key:List.of("revision","technicalWeight","commercialWeight","priceWeight")) content.append('|').append(key).append('=').append(rule.get(key));
    attachments.listActiveByTenantAndOwner(tender.tenantId(),"tender",tender.id()).stream()
      .sorted(Comparator.comparing(a->a.id())).forEach(a->content.append('|').append(a).append('|').append(attachments.fingerprint(tender.tenantId(),a.id())));
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content.toString().getBytes(StandardCharsets.UTF_8))); }
    catch(java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
  }
  private Map<String,Object> scoringSnapshot(Tender tender) {
    var rule=scoringRules==null?null:scoringRules.latest(tender.tenantId(),tender.id());
    var weights=rule==null?com.procurement.tender.domain.TenderScoringWeights.DEFAULT:rule.weights();
    return Map.of("revision",rule==null?0:rule.revision(),"technicalWeight",weights.technical().setScale(2),
        "commercialWeight",weights.commercial().setScale(2),"priceWeight",weights.price().setScale(2));
  }
}
