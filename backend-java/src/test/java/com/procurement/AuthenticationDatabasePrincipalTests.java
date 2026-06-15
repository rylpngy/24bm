package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.identity.api.LoginRequest;
import com.procurement.identity.api.LoginResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import com.procurement.identity.domain.AuthenticatedUser;
import com.procurement.identity.domain.IdentityScope;
import com.procurement.identity.infrastructure.AuthenticationUserMapper;
import com.procurement.identity.security.JwtTokenService;
import java.util.List;
import org.junit.jupiter.api.Test;

class AuthenticationDatabasePrincipalTests {

  private final JwtTokenService jwtTokenService = org.mockito.Mockito.mock(JwtTokenService.class);
  private final AuthenticationUserMapper authenticationUserMapper =
      org.mockito.Mockito.mock(AuthenticationUserMapper.class);
  private final AuthenticationApplicationService authenticationApplicationService =
      new AuthenticationApplicationService(jwtTokenService, authenticationUserMapper);

  @Test
  void buyerLoginBuildsPrincipalFromActiveTenantUserAndRoles() {
    when(authenticationUserMapper.findActiveUser(
            "owner@demo.example.com",
            "BUYER",
            "tenant-demo",
            null))
        .thenReturn(new AuthenticatedUser(
            "user-tenant-demo-owner",
            "tenant-demo",
            null,
            "首席采购管理员"));
    when(authenticationUserMapper.listSecurityRoles("user-tenant-demo-owner", "BUYER", "tenant-demo", null))
        .thenReturn(List.of("BUYER_OWNER"));
    when(jwtTokenService.issue(org.mockito.ArgumentMatchers.any())).thenReturn("jwt-token");
    when(jwtTokenService.expiresInSeconds()).thenReturn(7200L);

    LoginResponse response = authenticationApplicationService.login(new LoginRequest(
        "owner@demo.example.com",
        "demo123456",
        IdentityScope.BUYER,
        "tenant-demo",
        null));

    assertThat(response.accessToken()).isEqualTo("jwt-token");
    assertThat(response.userId()).isEqualTo("user-tenant-demo-owner");
    assertThat(response.displayName()).isEqualTo("首席采购管理员");
    assertThat(response.tenantId()).isEqualTo("tenant-demo");
    assertThat(response.supplierId()).isNull();
    assertThat(response.roles()).containsExactly("BUYER_OWNER");
  }
}
