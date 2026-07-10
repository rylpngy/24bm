package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.TenantContextFilter;
import com.procurement.identity.security.JwtTokenService;
import jakarta.servlet.FilterChain;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

// 安全收敛守卫:演示 JWT 密钥快速失败 + 租户请求头兜底默认退役。
class SecurityHardeningConfigTests {

  @Test
  void demoJwtSecretFailsFastWhenDisallowed() {
    assertThatThrownBy(() -> new JwtTokenService(JwtTokenService.DEMO_SECRET, 7200, false))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("demo placeholder");
    assertThatThrownBy(() -> new JwtTokenService("", 7200, false))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void injectedJwtSecretAcceptedWhenDemoDisallowed() {
    assertThatCode(() -> new JwtTokenService("injected-production-secret-at-least-32-bytes", 7200, false))
        .doesNotThrowAnyException();
  }

  @Test
  void demoJwtSecretStillWorksForLocalProfiles() {
    assertThatCode(() -> new JwtTokenService(JwtTokenService.DEMO_SECRET, 7200, true))
        .doesNotThrowAnyException();
  }

  @Test
  void tenantHeaderFallbackIsIgnoredByDefault() throws Exception {
    TenantContextFilter filter = new TenantContextFilter(false);
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader("X-Tenant-Id", "tenant-attacker");
    AtomicReference<String> seenTenant = new AtomicReference<>("unset");
    FilterChain chain = (req, res) -> seenTenant.set(TenantContext.tenantId());

    filter.doFilter(request, new MockHttpServletResponse(), chain);

    assertThat(seenTenant.get()).isNull();
  }

  @Test
  void tenantHeaderFallbackStillWorksWhenExplicitlyEnabled() throws Exception {
    TenantContextFilter filter = new TenantContextFilter(true);
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader("X-Tenant-Id", "tenant-acme");
    AtomicReference<String> seenTenant = new AtomicReference<>();
    FilterChain chain = (req, res) -> seenTenant.set(TenantContext.tenantId());

    filter.doFilter(request, new MockHttpServletResponse(), chain);

    assertThat(seenTenant.get()).isEqualTo("tenant-acme");
    assertThat(TenantContext.tenantId()).isNull();
  }
}
