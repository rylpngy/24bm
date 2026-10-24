package com.procurement;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.identity.application.*;
import com.procurement.identity.infrastructure.*;
import com.procurement.audit.application.AuditLogApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class ExternalIdentityPolicyTests {
  ExternalIdentityService service(boolean strict,String issuer,String audience){return new ExternalIdentityService(mock(ExternalIdentityMapper.class),mock(BuyerUserMapper.class),mock(PermissionService.class),mock(AuditLogApplicationService.class),issuer,audience,"https://id.example.edu/jwks",true,strict,true);}
  @Test void strictModeRequiresExplicitIssuerAndAudience(){assertThatThrownBy(()->service(true,"","api")).hasMessageContaining("严格映射");assertThatThrownBy(()->service(true,"https://id.example.edu","")).hasMessageContaining("严格映射");}
  @Test void compatibilityOnlyFallsBackForUnknownSubjects(){var jwt=Jwt.withTokenValue("test").header("alg","RS256").issuer("https://id.example.edu").subject("unknown").build();assertThat(service(false,"","").resolve(jwt)).isNull();assertThatThrownBy(()->service(true,"https://id.example.edu","api").resolve(jwt)).isInstanceOf(org.springframework.security.authentication.BadCredentialsException.class);}
  @Test void httpBoundaryUsesExplicitAdministrationPermission(){assertThat(com.procurement.identity.security.PortalPermissionPolicy.required("buyer","GET","/api/v1/buyer/identity-bindings")).isEqualTo("buyer:role:manage");assertThat(com.procurement.identity.security.PortalPermissionPolicy.required("buyer","POST","/api/v1/buyer/identity-bindings/id/status")).isEqualTo("buyer:role:manage");}
}
