package com.procurement.ai.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.api.AiReviewDtos.CreatePolicy;
import com.procurement.ai.infrastructure.AiPolicyMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.identity.application.PermissionService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.procurement.common.ai.AiSupport;
import com.procurement.common.ai.AiContracts;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.*;

@Service
public class AiPolicyApplicationService {
  private final AiPolicyMapper mapper;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  public AiPolicyApplicationService(AiPolicyMapper mapper, PermissionService permissions,
      AuditLogApplicationService audit, ObjectMapper json) {
    this.mapper=mapper; this.permissions=permissions; this.audit=audit; this.json=json;
  }
  public List<Policy> list() {
    admin(); var rows=mapper.list(tenant());
    if(rows.size()>200) throw new IllegalStateException("Policy version limit exceeded; contact administrator");
    return rows.stream().map(this::decode).toList();
  }
  public Policy detail(String id) { admin(); return decode(require(id)); }
  public List<Policy> published(String type) {
    if(!AiContracts.SUBJECT_TYPES.contains(type)) throw new IllegalArgumentException("Invalid policy subject");
    var rows=mapper.publishedForSubject(tenant(),type);
    if(rows.size()>50) throw new IllegalStateException("Published policy limit exceeded");
    return rows.stream().map(this::decode).filter(p -> p.subjectTypes().contains(type)).toList();
  }
  @Transactional
  public Policy create(CreatePolicy request) {
    admin(); validate(request);
    String tenant=tenant(); lockKey(request.policyKey());
    if(mapper.countVersions(tenant)>=200) throw new AiConflictException("本企业已达到200个制度版本上限，不能新增版本");
    int latest=mapper.latest(tenant,request.policyKey());
    if(latest!=request.expectedLatestVersion()) throw new AiConflictException("Policy version changed; reload before creating a version");
    if(latest>=100) throw new IllegalArgumentException("Maximum policy versions reached");
    Content content=new Content(List.copyOf(request.subjectTypes()),List.copyOf(request.clauses()));
    String encoded=encode(content);
    if(AiSupport.utf8(encoded).length>64000) throw new IllegalArgumentException("Policy content exceeds 64KB");
    String id="ai-policy-"+UUID.randomUUID();
    mapper.insert(id,tenant,request.policyKey(),latest+1,request.title(),encoded,
        contentHash(request.policyKey(),latest+1,request.title(),encoded),TenantAccessGuard.requireUserId("AI policies"));
    audit.recordCurrentTenantAction("ai.policy.created","ai_policy",id,"Created immutable draft version " + (latest+1));
    return decode(require(id));
  }
  @Transactional public Policy publish(String id) {
    admin(); var row=require(id); lockKey(row.policyKey()); row=require(id);
    var policy=decode(row);
    if(!"draft".equals(row.status())) throw new AiConflictException("Only a draft policy version can be published");
    if(mapper.latest(tenant(),row.policyKey())!=row.version()) throw new AiConflictException("Publish the latest policy version only");
    for(String type:policy.subjectTypes()) if(mapper.countPublishedForSubject(tenant(),type,row.policyKey())>=50)
      throw new AiConflictException("该业务类型已达到50份已发布制度上限，请先停用不再适用的制度");
    mapper.retirePublished(tenant(),row.policyKey());
    if(mapper.transition(tenant(),id,"draft","published")!=1) throw new AiConflictException("Policy status changed");
    audit.recordCurrentTenantAction("ai.policy.published","ai_policy",id,"Published version " + row.version());
    return decode(require(id));
  }
  @Transactional public Policy retire(String id) {
    admin(); var row=require(id); lockKey(row.policyKey()); row=require(id); decode(row);
    if(!List.of("draft","published").contains(row.status())) throw new AiConflictException("Policy is already retired");
    if(mapper.transition(tenant(),id,row.status(),"retired")!=1) throw new AiConflictException("Policy status changed");
    audit.recordCurrentTenantAction("ai.policy.retired","ai_policy",id,"Retired version " + row.version());
    return decode(require(id));
  }
  private void admin() { permissions.require("buyer:ai:manage"); }
  private void lockKey(String key) {
    mapper.lock(tenant()+":ai-policies");
    mapper.lock(tenant()+":ai-policy:"+key);
  }
  private static String tenant() { return TenantAccessGuard.requireTenantId("AI policies"); }
  private AiPolicyMapper.PolicyRow require(String id) {
    AiSupport.bounded(id,160,"Policy ID"); var row=mapper.find(tenant(),id);
    if(row==null) throw new IllegalArgumentException("Policy not found in current tenant"); return row;
  }
  private void validate(CreatePolicy r) {
    AiSupport.bounded(r.policyKey(),80,"Policy key");
    if(!r.policyKey().matches("[a-zA-Z0-9_-]{1,80}") || r.expectedLatestVersion()<0) throw new IllegalArgumentException("Invalid policy key/version");
    AiSupport.bounded(r.title(),200,"Policy title");
    if(r.subjectTypes()==null || r.subjectTypes().isEmpty() || r.subjectTypes().size()>4
        || !AiContracts.SUBJECT_TYPES.containsAll(r.subjectTypes())
        || new HashSet<>(r.subjectTypes()).size()!=r.subjectTypes().size()) throw new IllegalArgumentException("Invalid policy subjects");
    if(r.clauses()==null || r.clauses().isEmpty() || r.clauses().size()>50) throw new IllegalArgumentException("Provide 1-50 policy clauses");
    Set<String> ids=new HashSet<>();
    for(var clause:r.clauses()) {
      if(clause==null) throw new IllegalArgumentException("Policy clause is required");
      AiSupport.bounded(clause.id(),80,"Clause ID"); AiSupport.bounded(clause.title(),200,"Clause title");
      AiSupport.bounded(clause.text(),4000,"Clause text");
      if(!clause.id().matches("[a-zA-Z0-9_-]{1,80}") || !ids.add(clause.id())) throw new IllegalArgumentException("Invalid or duplicate policy clause ID");
    }
  }
  private Policy decode(AiPolicyMapper.PolicyRow r) {
    if(!contentHash(r.policyKey(),r.version(),r.title(),r.content()).equals(r.sourceHash()))
      throw new IllegalStateException("Policy content integrity check failed");
    try {
      Content c=json.readValue(r.content(),Content.class);
      return new Policy(r.id(),r.policyKey(),r.version(),r.title(),c.subjectTypes(),c.clauses(),r.status(),r.sourceHash(),r.createdBy(),r.createdAt());
    } catch(Exception e) { throw new IllegalStateException("Cannot read policy version",e); }
  }
  private String encode(Object content) { try { return json.writeValueAsString(content); } catch(Exception e) { throw new IllegalStateException(e); } }
  private String contentHash(String key,int version,String title,String content) {
    return AiSupport.revision(Map.of("key",key,"version",version,"title",title,"content",content));
  }
  private record Content(List<String> subjectTypes,List<Clause> clauses) {}
}
