package com.procurement.ai.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.api.AiReviewDtos.*;
import com.procurement.ai.infrastructure.AiReviewMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.identity.application.PermissionService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.procurement.common.tenant.TenantAccessGuard;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AiReviewApplicationService {
  private final Map<String,AiSubjectAdapter> adapters=new HashMap<>();
  private final AiReviewMapper mapper;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  private final AiModelGateway gateway;
  private final AiPolicyApplicationService policies;
  private final AiReviewPersistence persistence;
  public AiReviewApplicationService(List<AiSubjectAdapter> adapters, AiReviewMapper mapper,
      PermissionService permissions, AuditLogApplicationService audit, ObjectMapper json,
      AiModelGateway gateway, AiPolicyApplicationService policies,AiReviewPersistence persistence) {
    for(var adapter:adapters) if(this.adapters.putIfAbsent(adapter.subjectType(),adapter)!=null)
      throw new IllegalStateException("Duplicate AI subject adapter");
    this.mapper=mapper; this.permissions=permissions; this.audit=audit; this.json=json; this.gateway=gateway; this.policies=policies;
    this.persistence=persistence;
  }
  @Transactional(propagation=org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
  public Review create(CreateReview request) {
    permissions.require("buyer:ai:use"); tenant(); user();
    var subject=new Subject(request.subjectType(),request.subjectId()); var adapter=adapter(subject.subjectType());
    adapter.authorize(subject.subjectId()); var source=adapter.capture(subject.subjectId());
    AiEvidenceValidator.validate(source);
    if(request.expectedRevision()!=null && !request.expectedRevision().equals(source.sourceRevision()))
      throw new AiConflictException("Source revision changed; reload the source before reviewing");
    var snapshot=withPolicies(source,policies.published(subject.subjectType()));
    AiEvidenceValidator.validate(snapshot);
    if(AiSupport.utf8(encode(snapshot)).length>192000) throw new IllegalArgumentException("AI input exceeds 192KB");
    var model=gateway.analyze(snapshot);
    adapter.authorizeSnapshot(subject.subjectId(),snapshot);
    if(!source.sourceRevision().equals(adapter.capture(subject.subjectId()).sourceRevision()))
      throw new AiConflictException("Source changed during review; regenerate using current evidence");
    var review=new Review("ai-run-"+UUID.randomUUID(),subject.subjectType(),subject.subjectId(),source.sourceRevision(),
        OffsetDateTime.now(),model.mode(),model.model(),model.fallbackReason(),"procurement-evidence-v1",model.summary(),
        snapshot.findings(),snapshot.evidence(),snapshot.limitations(),List.of());
    String payload=encode(new CaseFile(snapshot,review));
    if(AiSupport.utf8(payload).length>256000) throw new IllegalArgumentException("AI case file exceeds 256KB");
    persistence.save(review,payload);
    return review;
  }
  public Review detail(String id) {
    permissions.require("buyer:ai:read"); return currentFeedback(read(id).review());
  }
  public List<Review> history(String type,String id,int limit) {
    permissions.require("buyer:ai:read"); new Subject(type,id);
    if(limit<1 || limit>20) throw new IllegalArgumentException("History limit must be 1-20");
    adapter(type).authorize(id);
    return mapper.history(tenant(),type,id,limit).stream().map(row -> {
      if(!type.equals(row.subjectType()) || !id.equals(row.subjectId())) throw new IllegalStateException("Invalid AI history subject");
      return currentFeedback(read(row).review());
    }).toList();
  }
  @Transactional
  public Review feedback(String id,SubmitFeedback request) {
    permissions.require("buyer:ai:use");
    AiSupport.bounded(request.findingId(),160,"Finding ID");
    if(!List.of("adopted","dismissed","needs_review").contains(request.disposition())
        || (request.comment()!=null && request.comment().length()>2000)) throw new IllegalArgumentException("Invalid feedback");
    var review=read(id).review();
    if(review.findings().stream().noneMatch(f -> f.id().equals(request.findingId()))) throw new IllegalArgumentException("Finding does not belong to this review");
    mapper.saveFeedback("ai-feedback-"+UUID.randomUUID(),tenant(),id,request.findingId(),user(),request.disposition(),request.comment());
    audit.recordCurrentTenantAction("ai.review.feedback","ai_review",id,"finding="+request.findingId()+";disposition="+request.disposition());
    return currentFeedback(review);
  }
  private CaseFile read(String id) {
    AiSupport.bounded(id,160,"Review ID"); var row=mapper.find(tenant(),id);
    if(row==null) throw new IllegalArgumentException("Review not found in current tenant"); return read(row);
  }
  private CaseFile read(AiReviewMapper.RunRow row) {
    if(!tenant().equals(row.tenantId())) throw new IllegalArgumentException("Review not found in current tenant");
    adapter(row.subjectType()).authorize(row.subjectId());
    if(row.payload()==null || AiSupport.utf8(row.payload()).length>256000
        || !AiSupport.hash(AiSupport.utf8(row.payload())).equals(row.payloadHash())) throw new IllegalStateException("AI case file integrity check failed");
    try {
      var file=json.readValue(row.payload(),CaseFile.class); var r=file.review();
      if(!row.id().equals(r.runId()) || !row.subjectType().equals(r.subjectType()) || !row.subjectId().equals(r.subjectId())
          || !file.snapshot().sourceRevision().equals(r.sourceRevision())) throw new IllegalStateException("AI case file identity mismatch");
      AiEvidenceValidator.validate(file.snapshot()); adapter(row.subjectType()).authorizeSnapshot(row.subjectId(),file.snapshot());
      return file;
    } catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Cannot read AI case file",e); }
  }
  private Review currentFeedback(Review r) {
    var feedback=mapper.feedback(tenant(),r.runId());
    return new Review(r.runId(),r.subjectType(),r.subjectId(),r.sourceRevision(),r.createdAt(),r.mode(),r.model(),r.fallbackReason(),
        r.rulesetVersion(),r.summary(),r.findings(),r.evidence(),r.limitations(),feedback==null?List.of():feedback);
  }
  private Snapshot withPolicies(Snapshot source,List<Policy> policies) {
    List<Evidence> evidence=new ArrayList<>(source.evidence()); List<String> limitations=new ArrayList<>(source.limitations());
    if(policies.isEmpty()) limitations.add("当前企业没有适用于本类业务的已发布制度，制度符合性须人工核验，不引用其他企业或学校制度。");
    else {
      for(var p:policies) for(var clause:p.clauses()) evidence.add(new Evidence("policy:"+p.id()+":"+clause.id(),"POLICY",
          "clause:"+clause.id(),p.title()+" / "+clause.title(),clause.text(),p.id(),p.sourceHash(),p.policyKey()+":"+p.version()));
      limitations.add("已发布的企业制度条款仅供人工结合事实解释；规则检查结果不代表已符合制度或法律要求。");
    }
    limitations.add("本结果仅供辅助复核，人工决定权不变；采纳反馈只留痕，不触发审批、评分、定标、签字或供应商状态变更。");
    limitations.add("可选模型仅从已提供证据中选择复核重点，不生成实质制度审查结论；本阶段未实现制度语义审查或智能评标。");
    return new Snapshot(source.sourceRevision(),evidence,source.findings(),limitations,source.accessTargets());
  }
  private AiSubjectAdapter adapter(String type) {
    var adapter=adapters.get(type); if(adapter==null) throw new IllegalArgumentException("Unsupported AI subject"); return adapter;
  }
  private String encode(Object value) {
    try { return json.writeValueAsString(value); } catch(Exception e) { throw new IllegalStateException("Cannot serialize AI case file",e); }
  }
  private static String tenant() { return TenantAccessGuard.requireTenantId("AI reviews"); }
  private static String user() { return TenantAccessGuard.requireUserId("AI reviews"); }
  public record CaseFile(Snapshot snapshot,Review review) {}
}
