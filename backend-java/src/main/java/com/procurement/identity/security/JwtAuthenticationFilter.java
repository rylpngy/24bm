package com.procurement.identity.security;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.application.AuthenticatedSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  private final JwtTokenService jwtTokenService;
  private final KeycloakTokenService keycloakTokenService;
  private final AuthenticatedSessionService authenticatedSessionService;

  public JwtAuthenticationFilter(
      JwtTokenService jwtTokenService, KeycloakTokenService keycloakTokenService,
      AuthenticatedSessionService authenticatedSessionService) {
    this.jwtTokenService = jwtTokenService;
    this.keycloakTokenService = keycloakTokenService;
    this.authenticatedSessionService = authenticatedSessionService;
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
      AuthenticatedPrincipal principal;
      try {
        principal = authenticatedSessionService.validate(authenticate(authorization.substring(7)));
      } catch (DataAccessException unavailable) {
        // A transient account-store failure must not force every client to discard its session.
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Retry-After", "5");
        response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"身份校验服务暂不可用,请稍后重试\"}");
        return;
      } catch (RuntimeException invalidToken) {
        // 过期/无效令牌 → 标准 401(而非 500):前端据此走静默续签或回登录门。
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"登录已过期,请重新登录\"}");
        return;
      }
      try {
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
