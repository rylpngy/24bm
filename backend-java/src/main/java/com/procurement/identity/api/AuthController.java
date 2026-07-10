package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthenticationApplicationService authenticationApplicationService;
  private final boolean selfIssuedLoginEnabled;

  public AuthController(
      AuthenticationApplicationService authenticationApplicationService,
      @Value("${procurement.security.self-issued-login-enabled:true}") boolean selfIssuedLoginEnabled) {
    this.authenticationApplicationService = authenticationApplicationService;
    this.selfIssuedLoginEnabled = selfIssuedLoginEnabled;
  }

  // 自研 JWT 登录;生产退役时关闭(改用 Keycloak/OIDC)。令牌验签仍双签发器共存。
  @PostMapping("/login")
  public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    if (!selfIssuedLoginEnabled) {
      throw new IllegalStateException("Self-issued login is retired; sign in via Keycloak (OIDC).");
    }
    return ApiResponse.ok(authenticationApplicationService.login(request));
  }
}
