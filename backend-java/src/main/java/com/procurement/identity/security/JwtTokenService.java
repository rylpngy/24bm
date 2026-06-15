package com.procurement.identity.security;

import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.domain.IdentityScope;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
  private final SecretKey secretKey;
  private final long expiresInSeconds;

  public JwtTokenService(
      @Value("${procurement.security.jwt-secret}") String jwtSecret,
      @Value("${procurement.security.jwt-expires-in-seconds:7200}") long expiresInSeconds) {
    this.secretKey = Keys.hmacShaKeyFor(normalizeSecret(jwtSecret).getBytes(StandardCharsets.UTF_8));
    this.expiresInSeconds = expiresInSeconds;
  }

  public String issue(AuthenticatedPrincipal principal) {
    Instant now = Instant.now();
    return Jwts.builder()
        .subject(principal.userId())
        .claim("userId", principal.userId())
        .claim("displayName", principal.displayName())
        .claim("scope", principal.scope().name())
        .claim("tenantId", principal.tenantId())
        .claim("supplierId", principal.supplierId())
        .claim("roles", principal.roles())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plusSeconds(expiresInSeconds)))
        .signWith(secretKey)
        .compact();
  }

  public AuthenticatedPrincipal parse(String token) {
    Claims claims = Jwts.parser()
        .verifyWith(secretKey)
        .build()
        .parseSignedClaims(token)
        .getPayload();

    return new AuthenticatedPrincipal(
        claims.get("userId", String.class),
        claims.get("displayName", String.class),
        IdentityScope.valueOf(claims.get("scope", String.class)),
        claims.get("tenantId", String.class),
        claims.get("supplierId", String.class),
        claims.get("roles", java.util.List.class));
  }

  public long expiresInSeconds() {
    return expiresInSeconds;
  }

  private String normalizeSecret(String secret) {
    String fallback = "local-development-secret-must-be-at-least-32-bytes";
    String normalized = secret == null || secret.isBlank() ? fallback : secret;
    return normalized.length() >= 32 ? normalized : normalized + fallback;
  }
}
