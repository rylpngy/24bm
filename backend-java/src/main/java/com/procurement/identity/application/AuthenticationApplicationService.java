package com.procurement.identity.application;

import com.procurement.identity.api.LoginRequest;
import com.procurement.identity.api.LoginResponse;
import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.domain.IdentityScope;
import com.procurement.identity.security.JwtTokenService;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AuthenticationApplicationService {
  private final JwtTokenService jwtTokenService;

  public AuthenticationApplicationService(JwtTokenService jwtTokenService) {
    this.jwtTokenService = jwtTokenService;
  }

  public LoginResponse login(LoginRequest request) {
    AuthenticatedPrincipal principal = resolveDemoPrincipal(request);
    String token = jwtTokenService.issue(principal);

    return new LoginResponse(
        token,
        "Bearer",
        jwtTokenService.expiresInSeconds(),
        principal.userId(),
        principal.displayName(),
        principal.scope(),
        principal.tenantId(),
        principal.supplierId(),
        principal.roles());
  }

  private AuthenticatedPrincipal resolveDemoPrincipal(LoginRequest request) {
    if (!"demo123456".equals(request.password())) {
      throw new IllegalArgumentException("Invalid account or password");
    }

    if (request.scope() == IdentityScope.PLATFORM) {
      requireBlank(request.tenantId(), request.supplierId(), "PLATFORM login forbids tenantId and supplierId");
      return new AuthenticatedPrincipal("user-platform-admin", "平台运营", IdentityScope.PLATFORM, null, null, List.of("PLATFORM_ADMIN"));
    }

    if (request.scope() == IdentityScope.SUPPLIER) {
      requirePresentOnly(request.supplierId(), request.tenantId(), "SUPPLIER login requires supplierId and forbids tenantId");
      return new AuthenticatedPrincipal("user-supplier-sales", "供应商销售", IdentityScope.SUPPLIER, null, request.supplierId(), List.of("SUPPLIER_SALES"));
    }

    requirePresentOnly(request.tenantId(), request.supplierId(), "BUYER login requires tenantId and forbids supplierId");
    return new AuthenticatedPrincipal("user-buyer-owner", "采购负责人", IdentityScope.BUYER, request.tenantId(), null, List.of("BUYER_OWNER"));
  }

  private void requirePresentOnly(String requiredValue, String forbiddenValue, String message) {
    if (requiredValue == null || requiredValue.isBlank() || (forbiddenValue != null && !forbiddenValue.isBlank())) {
      throw new IllegalArgumentException(message);
    }
  }

  private void requireBlank(String firstValue, String secondValue, String message) {
    if ((firstValue != null && !firstValue.isBlank()) || (secondValue != null && !secondValue.isBlank())) {
      throw new IllegalArgumentException(message);
    }
  }
}
