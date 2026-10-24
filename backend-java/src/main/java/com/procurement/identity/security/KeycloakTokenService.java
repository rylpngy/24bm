package com.procurement.identity.security;

import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.domain.IdentityScope;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

// Keycloak 令牌验签(RS256/JWKS)→ 复用 AuthenticatedPrincipal,与自研 JWT 共存。
// JwkSet 解码器懒加载:Keycloak 不在场不影响应用与现有自研 JWT 路径。
@Service
public class KeycloakTokenService {
  private final boolean enabled;
  private final String jwkSetUri;
  private final String issuer;
  private final String audience;
  private volatile JwtDecoder decoder;
  private com.procurement.identity.application.ExternalIdentityService identities;

  @Autowired(required=false)
  public void setExternalIdentities(com.procurement.identity.application.ExternalIdentityService identities) {
    this.identities = identities;
  }

  @Autowired
  public KeycloakTokenService(
      @Value("${keycloak.enabled:true}") boolean enabled,
      @Value("${keycloak.jwk-set-uri:}") String jwkSetUri,
      @Value("${keycloak.issuer-uri:}") String issuer,
      @Value("${keycloak.audience:}") String audience) {
    this.enabled = enabled;
    this.jwkSetUri = jwkSetUri;
    this.issuer = issuer == null ? "" : issuer.trim();
    this.audience = audience == null ? "" : audience.trim();
  }

  public boolean isEnabled() {
    return enabled && jwkSetUri != null && !jwkSetUri.isBlank();
  }

  private JwtDecoder decoder() {
    JwtDecoder local = decoder;
    if (local == null) {
      synchronized (this) {
        local = decoder;
        if (local == null) {
          var nimbus = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
          var validator = issuer.isBlank() ? JwtValidators.createDefault() : JwtValidators.createDefaultWithIssuer(issuer);
          if (!audience.isBlank()) {
            validator = new DelegatingOAuth2TokenValidator<>(validator,
                new JwtClaimValidator<List<String>>("aud", values -> values != null && values.contains(audience)));
          }
          nimbus.setJwtValidator(validator);
          local = nimbus;
          decoder = local;
        }
      }
    }
    return local;
  }

  // 验签并映射为 AuthenticatedPrincipal;失败抛异常由调用方回退处理。
  public AuthenticatedPrincipal parse(String token) {
    Jwt jwt = decoder().decode(token);
    if (identities != null) {
      var mapped = identities.resolve(jwt);
      if (mapped != null) return mapped;
    }
    String userId = stringClaim(jwt, "userId", jwt.getSubject());
    String displayName = stringClaim(jwt, "displayName", userId);
    String scope = stringClaim(jwt, "authScope", null);
    String tenantId = stringClaim(jwt, "tenantId", null);
    String supplierId = stringClaim(jwt, "supplierId", null);
    List<String> roles = jwt.getClaimAsStringList("roles");
    return new AuthenticatedPrincipal(
        userId,
        displayName,
        IdentityScope.valueOf(scope),
        emptyToNull(tenantId),
        emptyToNull(supplierId),
        roles == null ? List.of() : roles);
  }

  private static String stringClaim(Jwt jwt, String name, String fallback) {
    Object value = jwt.getClaim(name);
    return value == null ? fallback : value.toString();
  }

  private static String emptyToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
