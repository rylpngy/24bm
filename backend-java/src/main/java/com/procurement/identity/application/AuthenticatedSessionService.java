package com.procurement.identity.application;

import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.infrastructure.AuthenticationUserMapper;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

@Service
public class AuthenticatedSessionService {
  private final AuthenticationUserMapper users;

  public AuthenticatedSessionService(AuthenticationUserMapper users) {
    this.users = users;
  }

  public AuthenticatedPrincipal validate(AuthenticatedPrincipal principal) {
    var user = users.findActiveSessionUser(principal.userId(), principal.scope().name(),
        principal.tenantId(), principal.supplierId());
    if (user == null || (principal.sessionVersion() != null
        && principal.sessionVersion() != user.sessionVersion())) {
      throw new BadCredentialsException("Account disabled or session revoked");
    }
    var roles = users.listSecurityRoles(user.userId(), principal.scope().name(),
        user.tenantId(), user.supplierId());
    if (roles == null || roles.isEmpty()) {
      throw new BadCredentialsException("No active roles assigned to account");
    }
    return new AuthenticatedPrincipal(user.userId(), user.displayName(), principal.scope(),
        user.tenantId(), user.supplierId(), roles, principal.sessionVersion());
  }
}
