package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.identity.api.AuthController;
import com.procurement.identity.api.LoginRequest;
import com.procurement.identity.api.LoginResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import com.procurement.identity.domain.IdentityScope;
import java.util.List;
import org.junit.jupiter.api.Test;

// P4b：自研 JWT 退役开关。生产以 Keycloak 为唯一签发方时关闭 /auth/login;
// 默认开启仅为 CI/测试确定性(令牌验签仍双签发器共存)。
class SelfIssuedLoginRetirementTests {

  private final AuthenticationApplicationService service =
      mock(AuthenticationApplicationService.class);

  private LoginRequest sampleRequest() {
    return new LoginRequest(
        "buyer.owner@example.com", "demo123456", IdentityScope.BUYER, "tenant-acme", null);
  }

  @Test
  void rejectsSelfIssuedLoginWhenRetired() {
    AuthController controller = new AuthController(service, false);
    assertThatThrownBy(() -> controller.login(sampleRequest()))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Keycloak");
  }

  @Test
  void allowsSelfIssuedLoginWhenEnabledForCi() {
    LoginResponse response =
        new LoginResponse(
            "token",
            "Bearer",
            7200L,
            "user-1",
            "采购负责人",
            IdentityScope.BUYER,
            "tenant-acme",
            null,
            List.of("buyer-owner"));
    when(service.login(org.mockito.ArgumentMatchers.any())).thenReturn(response);

    AuthController controller = new AuthController(service, true);
    assertThat(controller.login(sampleRequest()).data()).isEqualTo(response);
  }
}
