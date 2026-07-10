package com.procurement.common.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// 无 Bearer 时的 X-Tenant-Id/X-Supplier-Id/X-User-Id 请求头兜底是旧 Node 原型的兼容路径,
// 信任客户端声明的租户身份,存在横向越权风险;默认关闭,仅在明确需要的联调场景下开启。
@Component
public class TenantContextFilter extends OncePerRequestFilter {
  private final boolean headerFallbackEnabled;

  public TenantContextFilter(
      @Value("${procurement.security.tenant-header-fallback-enabled:false}") boolean headerFallbackEnabled) {
    this.headerFallbackEnabled = headerFallbackEnabled;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String authorization = request.getHeader("Authorization");
    if (!headerFallbackEnabled || (authorization != null && authorization.startsWith("Bearer "))) {
      filterChain.doFilter(request, response);
      return;
    }

    try {
      TenantContext.set(
          request.getHeader("X-Tenant-Id"),
          request.getHeader("X-Supplier-Id"),
          request.getHeader("X-User-Id"));
      filterChain.doFilter(request, response);
    } finally {
      TenantContext.clear();
    }
  }
}
