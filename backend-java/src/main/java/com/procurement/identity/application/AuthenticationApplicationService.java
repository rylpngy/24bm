package com.procurement.identity.application;

import com.procurement.identity.api.LoginRequest;
import com.procurement.identity.api.LoginResponse;
import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.domain.AuthenticatedUser;
import com.procurement.identity.domain.IdentityScope;
import com.procurement.identity.infrastructure.AuthenticationUserMapper;
import com.procurement.identity.security.JwtTokenService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class AuthenticationApplicationService {
  private final JwtTokenService jwtTokenService;
  private final AuthenticationUserMapper authenticationUserMapper;
  private final PasswordEncoder passwordEncoder;

  public AuthenticationApplicationService(
      JwtTokenService jwtTokenService,
      AuthenticationUserMapper authenticationUserMapper,
      PasswordEncoder passwordEncoder) {
    this.jwtTokenService = jwtTokenService;
    this.authenticationUserMapper = authenticationUserMapper;
    this.passwordEncoder = passwordEncoder;
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
    if (request.scope() == IdentityScope.PLATFORM) {
      requireBlank(request.tenantId(), request.supplierId(), "PLATFORM login forbids tenantId and supplierId");
      return resolveDatabasePrincipal(request);
    }

    if (request.scope() == IdentityScope.SUPPLIER) {
      requirePresentOnly(request.supplierId(), request.tenantId(), "SUPPLIER login requires supplierId and forbids tenantId");
      return resolveDatabasePrincipal(request);
    }

    requirePresentOnly(request.tenantId(), request.supplierId(), "BUYER login requires tenantId and forbids supplierId");
    return resolveDatabasePrincipal(request);
  }

  private AuthenticatedPrincipal resolveDatabasePrincipal(LoginRequest request) {
    AuthenticatedUser user = authenticationUserMapper.findActiveUser(
        request.account(),
        request.scope().name(),
        request.tenantId(),
        request.supplierId());
    if (user == null) {
      throw new IllegalArgumentException("Invalid account or password");
    }
    if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
      throw new IllegalArgumentException("Invalid account or password");
    }
    List<String> roles = authenticationUserMapper.listSecurityRoles(
        user.userId(),
        request.scope().name(),
        user.tenantId(),
        user.supplierId());
    if (roles.isEmpty()) {
      throw new IllegalArgumentException("No active roles assigned to account");
    }
    return new AuthenticatedPrincipal(
        user.userId(),
        user.displayName(),
        request.scope(),
        user.tenantId(),
        user.supplierId(),
        roles,
        user.sessionVersion());
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
