package com.procurement.identity.security;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.AuthenticatedPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtTokenService jwtTokenService;
  private final KeycloakTokenService keycloakTokenService;

  public JwtAuthenticationFilter(
      JwtTokenService jwtTokenService, KeycloakTokenService keycloakTokenService) {
    this.jwtTokenService = jwtTokenService;
    this.keycloakTokenService = keycloakTokenService;
  }

  // 先用自研 JWT 验签;失败再回退 Keycloak(OIDC/JWKS)。两条签发器路径共存。
  private AuthenticatedPrincipal authenticate(String token) {
    try {
      return jwtTokenService.parse(token);
    } catch (RuntimeException selfJwtFailure) {
      if (keycloakTokenService.isEnabled()) {
        return keycloakTokenService.parse(token);
      }
      throw selfJwtFailure;
    }
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String authorization = request.getHeader("Authorization");
    if (authorization != null && authorization.startsWith("Bearer ")) {
      try {
        AuthenticatedPrincipal principal = authenticate(authorization.substring(7));
        List<SimpleGrantedAuthority> authorities = principal.roles().stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
            .toList();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, authorities));
        TenantContext.set(principal.tenantId(), principal.supplierId(), principal.userId());
        filterChain.doFilter(request, response);
      } finally {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
      }
      return;
    }

    filterChain.doFilter(request, response);
  }
}
