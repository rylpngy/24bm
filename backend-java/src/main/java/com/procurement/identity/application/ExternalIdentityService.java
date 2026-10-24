package com.procurement.identity.application;

import com.procurement.identity.api.ExternalIdentityContracts.*;
import com.procurement.identity.infrastructure.ExternalIdentityMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.identity.domain.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.common.tenant.TenantContext;
import com.procurement.audit.application.AuditLogApplicationService;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExternalIdentityService {
  private final ExternalIdentityMapper mapper;
  private final BuyerUserMapper users;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final String issuer, audience, jwks;
  private final boolean enabled, strict, selfIssued;
  public ExternalIdentityService(ExternalIdentityMapper mapper, BuyerUserMapper users, PermissionService permissions,
      AuditLogApplicationService audit, @Value("${keycloak.issuer-uri:}") String issuer,
      @Value("${keycloak.audience:}") String audience, @Value("${keycloak.jwk-set-uri:}") String jwks,
      @Value("${keycloak.enabled:true}") boolean enabled, @Value("${keycloak.buyer-identity-mapping-required:false}") boolean strict,
      @Value("${procurement.security.self-issued-token-accepted:true}") boolean selfIssued) {
    this.mapper=mapper;this.users=users;this.permissions=permissions;this.audit=audit;
    this.issuer=issuer.trim();this.audience=audience.trim();this.jwks=jwks.trim();this.enabled=enabled;this.strict=strict;this.selfIssued=selfIssued;
    if(strict&&(!enabled||this.issuer.isEmpty()||this.audience.isEmpty()||this.jwks.isEmpty()))throw new IllegalStateException("严格映射模式要求配置统一身份issuer、audience及公钥服务");
  }
  private String tenant(){permissions.require("buyer:role:manage");return TenantAccessGuard.requireTenantId("identity bindings");}
  public BindingPage list(int page,int size,String keyword){
    String t=tenant();if(page<1||size<1||size>100)throw new IllegalArgumentException("页码或每页条数不合法");
    String q=keyword==null?"":keyword.trim();if(q.length()>255)throw new IllegalArgumentException("搜索内容过长");
    return new BindingPage(mapper.list(t,q,size,(long)(page-1)*size),mapper.count(t,q),page,size);
  }
  public Readiness readiness(){
    String t=tenant();List<String> pending=new ArrayList<>();
    if(!enabled||jwks.isEmpty())pending.add("配置并验证统一身份公钥服务");
    if(issuer.isEmpty())pending.add("配置可信身份源issuer后才能建立映射");
    if(audience.isEmpty())pending.add("配置并验证令牌受众audience");
    if(!strict)pending.add("核对账号映射后再显式启用严格映射模式");
    if(selfIssued)pending.add("正式环境关闭本地自签令牌入口");
    pending.add("客户身份源登录、离职同步及应急恢复仍需正式环境联调");
    return new Readiness(enabled&&!jwks.isEmpty(),!issuer.isEmpty(),!audience.isEmpty(),strict,selfIssued,issuer,mapper.count(t,""),mapper.active(t),pending);
  }
  @Transactional public Binding create(Create r){
    String t=tenant();if(!enabled||jwks.isEmpty()||issuer.isEmpty())throw new IllegalStateException("请先由运维配置可信身份源issuer与公钥服务");
    var user=users.findByTenantAndId(t,r.userId());
    if(user==null||!"active".equals(user.status()))throw new IllegalArgumentException("请选择本企业在职成员");
    if(users.listBuyerRoleIdsByTenantAndUser(t,user.id()).isEmpty())throw new IllegalArgumentException("请先为成员分配本地角色");
    String subject=r.subject().trim(),reason=r.reason().trim();
    if(subject.isEmpty()||subject.chars().anyMatch(Character::isISOControl)||reason.isEmpty())throw new IllegalArgumentException("外部账号及原因不能为空或包含控制字符");
    String id="identity-"+UUID.randomUUID();
    if(mapper.insert(id,t,user.id(),issuer,subject,Instant.now().getEpochSecond(),reason,TenantContext.userId())!=1)throw new IllegalArgumentException("该身份源账号已有映射，请核对原记录，不可重复绑定");
    audit.recordTenantAction(t,"identity.binding_created","identity_binding",id,"成员:"+user.id()+";原因:"+reason);
    return mapper.find(t,id);
  }
  @Transactional public Binding change(String id,Change r){
    String t=tenant();var old=mapper.find(t,id);if(old==null)throw new IllegalArgumentException("映射不存在");
    if(old.enabled()==r.enabled())throw new IllegalArgumentException("映射状态未变化，请刷新");
    if(old.userId().equals(TenantContext.userId())&&!r.enabled())throw new IllegalArgumentException("不能停用自己的身份映射，请由另一管理员处理");
    var user=users.findByTenantAndId(t,old.userId());
    if(r.enabled()&&(user==null||!"active".equals(user.status())||users.listBuyerRoleIdsByTenantAndUser(t,user.id()).isEmpty()))throw new IllegalArgumentException("成员已停用或无角色，不能启用映射");
    if(r.reason().isBlank())throw new IllegalArgumentException("请填写变更原因");
    // A re-enabled binding requires a newly issued token, including same-second races.
    if(mapper.change(t,id,r.enabled(),r.revision(),Instant.now().getEpochSecond()+1,r.reason().trim())!=1)throw new IllegalStateException("映射已被修改，请刷新后重试");
    audit.recordTenantAction(t,r.enabled()?"identity.binding_enabled":"identity.binding_disabled","identity_binding",id,"原因:"+r.reason().trim());return mapper.find(t,id);
  }
  public AuthenticatedPrincipal resolve(Jwt jwt){
    String source=jwt.getClaimAsString("iss"),subject=jwt.getSubject();
    var binding=source==null||subject==null?null:mapper.resolve(source,subject);
    if(binding==null){
      // Only buyer identities are managed here. Other portals still require their existing
      // signed scope plus a matching active local account, checked by AuthenticatedSessionService.
      String scope=jwt.getClaimAsString("authScope");
      if(strict&&!Set.of("PLATFORM","SUPPLIER").contains(scope==null?"":scope))throw new BadCredentialsException("Unmapped external buyer identity");
      return null;
    }
    if(!binding.enabled()||!"active".equals(binding.userStatus())||jwt.getIssuedAt()==null||jwt.getIssuedAt().getEpochSecond()<binding.validAfter())throw new BadCredentialsException("External identity disabled or token revoked");
    return new AuthenticatedPrincipal(binding.userId(),binding.name(),IdentityScope.BUYER,binding.tenantId(),null,List.of());
  }
  @Transactional public Binding remap(String id,Remap r){
    String t=tenant();var old=mapper.find(t,id);if(old==null)throw new IllegalArgumentException("映射不存在");
    if(old.userId().equals(TenantContext.userId()))throw new IllegalArgumentException("不能重新绑定自己的身份映射，请由另一管理员处理");
    var user=users.findByTenantAndId(t,r.userId());
    if(user==null||!"active".equals(user.status())||users.listBuyerRoleIdsByTenantAndUser(t,user.id()).isEmpty())throw new IllegalArgumentException("请选择本企业在职且已授权的成员");
    if(old.userId().equals(user.id())||r.reason().isBlank())throw new IllegalArgumentException("请选择不同成员并填写变更依据");
    if(mapper.remap(t,id,user.id(),r.revision(),Instant.now().getEpochSecond()+1,r.reason().trim())!=1)throw new IllegalStateException("映射已被修改，请刷新后重试");
    audit.recordTenantAction(t,"identity.binding_remapped","identity_binding",id,"原成员:"+old.userId()+";新成员:"+user.id()+";原因:"+r.reason().trim());
    return mapper.find(t,id);
  }
}
