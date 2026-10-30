package com.procurement.contract.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.procurement.contract.api.ContractReviewContracts.*;
import com.procurement.contract.infrastructure.ContractReviewMapper;
import com.procurement.contract.infrastructure.ContractReviewMapper.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.audit.application.AuditLogApplicationService;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContractReviewRulesService {
  private final ContractReviewMapper mapper;
  private final ContractReviewCodec codec;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  public ContractReviewRulesService(ContractReviewMapper mapper,ContractReviewCodec codec,PermissionService permissions,AuditLogApplicationService audit){
    this.mapper=mapper;this.codec=codec;this.permissions=permissions;this.audit=audit;
  }
  public List<RuleSet> sets(){permissions.require("buyer:contract:read");return mapper.ruleSets(tenant()).stream().map(this::view).toList();}
  public List<RuleVersion> versions(){permissions.require("buyer:contract:read");return mapper.ruleVersions(tenant()).stream().map(this::view).toList();}
  public RuleVersion requireVersion(String id){var row=mapper.ruleVersion(tenant(),id);if(row==null)throw new IllegalArgumentException("请选择本企业已发布的规则版本");return view(row);}
  @Transactional public RuleSet save(String id,SaveRules request){
    permissions.require("buyer:contract:manage");validate(request.rules());
    var old=id==null?null:mapper.lockRules(tenant(),id);
    if(id!=null&&old==null)throw new IllegalArgumentException("规则集不存在");
    if(request.expectedRevision()!=(old==null?0:old.revision()))throw new IllegalStateException("规则草稿已变化，请刷新后重试");
    var row=new RulesRow(old==null?"crs-"+UUID.randomUUID():id,tenant(),request.name().trim(),codec.write(request.rules()),
        old==null?1:old.revision(),old==null?user():old.createdBy(),old==null?OffsetDateTime.now():old.createdAt());
    if(old==null)mapper.insertRules(row);else mapper.updateRules(row);
    audit.recordCurrentTenantAction("CONTRACT_REVIEW_RULES_SAVED","contract_review_rule_set",row.id(),"保存规则草稿");
    return view(mapper.lockRules(tenant(),row.id()));
  }
  @Transactional public RuleVersion publish(String id,int expectedRevision){
    permissions.require("buyer:contract:manage");var row=mapper.lockRules(tenant(),id);
    if(row==null)throw new IllegalArgumentException("规则集不存在");
    if(row.revision()!=expectedRevision)throw new IllegalStateException("规则草稿已变化，请刷新后发布");
    validate(view(row).rules());
    var published=new RulesVersionRow("crv-"+UUID.randomUUID(),tenant(),id,mapper.nextRuleVersion(tenant(),id),row.name(),row.draftJson(),user(),OffsetDateTime.now());
    mapper.insertRuleVersion(published);audit.recordCurrentTenantAction("CONTRACT_REVIEW_RULES_PUBLISHED","contract_review_rule_set",id,"发布不可变版本V"+published.version());
    return view(published);
  }
  public static void validate(List<Rule> rules){
    if(rules==null||rules.isEmpty()||rules.size()>30)throw new IllegalArgumentException("规则数量须为1至30条");
    Set<String> ids=new HashSet<>();
    for(var rule:rules){
      if(rule==null||!ids.add(rule.id()))throw new IllegalArgumentException("规则编号不能为空或重复");
      if(!Set.of("KEYWORD","MISSING","SEMANTIC").contains(rule.type())||!Set.of("BUYER","SELLER","BOTH").contains(rule.perspective())
          ||!Set.of("HIGH","MEDIUM","LOW").contains(rule.severity())||!Set.of("ANY","ALL").contains(rule.matchMode()))throw new IllegalArgumentException("规则类型、视角、风险等级或匹配方式无效");
      if(!"SEMANTIC".equals(rule.type())&&(rule.keywords()==null||rule.keywords().isEmpty()))throw new IllegalArgumentException("逻辑规则必须配置关键词");
    }
  }
  private RuleSet view(RulesRow row){return new RuleSet(row.id(),row.name(),row.revision(),codec.read(row.draftJson(),new TypeReference<List<Rule>>(){}));}
  private RuleVersion view(RulesVersionRow row){return new RuleVersion(row.id(),row.setId(),row.version(),row.name(),codec.read(row.rulesJson(),new TypeReference<List<Rule>>(){}),row.createdBy(),row.createdAt());}
  private static String tenant(){return TenantAccessGuard.requireTenantId("contract review rules");}
  private static String user(){return TenantAccessGuard.requireUserId("contract review rules");}
}
