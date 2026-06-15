package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.AuthenticationApplicationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthenticationApplicationService authenticationApplicationService;

  public AuthController(AuthenticationApplicationService authenticationApplicationService) {
    this.authenticationApplicationService = authenticationApplicationService;
  }

  @PostMapping("/login")
  public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    return ApiResponse.ok(authenticationApplicationService.login(request));
  }
}
