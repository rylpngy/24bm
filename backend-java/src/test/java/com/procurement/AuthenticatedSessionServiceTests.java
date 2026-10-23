package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.identity.application.AuthenticatedSessionService;
import com.procurement.identity.domain.AuthenticatedPrincipal;
import com.procurement.identity.domain.AuthenticatedUser;
import com.procurement.identity.domain.IdentityScope;
import com.procurement.identity.infrastructure.AuthenticationUserMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;

class AuthenticatedSessionServiceTests {
  private final AuthenticationUserMapper users = mock(AuthenticationUserMapper.class);
  private final AuthenticatedSessionService service = new AuthenticatedSessionService(users);

  @Test
  void checksLocalAccountEvenForIdentityProviderTokens() {
    assertThatThrownBy(() -> service.validate(principal(null)))
        .isInstanceOf(BadCredentialsException.class);
  }

  @Test
  void rejectsRevokedSessionVersion() {
    activeUser(2);
    assertThatThrownBy(() -> service.validate(principal(1L)))
        .isInstanceOf(BadCredentialsException.class);
  }

  @Test
  void replacesTokenRolesWithCurrentDatabaseRoles() {
    activeUser(2);
    when(users.listSecurityRoles("user", "BUYER", "tenant", null)).thenReturn(List.of("BUYER_OWNER"));
    var refreshed = service.validate(principal(2L));
    assertThat(refreshed.roles()).containsExactly("BUYER_OWNER");
    assertThat(refreshed.displayName()).isEqualTo("Current name");
  }

  @Test
  void removedRoleCannotBeRecoveredFromTokenClaim() {
    activeUser(2);
    when(users.listSecurityRoles("user", "BUYER", "tenant", null)).thenReturn(List.of());
    assertThatThrownBy(() -> service.validate(principal(2L)))
        .isInstanceOf(BadCredentialsException.class);
  }

  private void activeUser(long version) {
    when(users.findActiveSessionUser("user", "BUYER", "tenant", null))
        .thenReturn(new AuthenticatedUser("user", "tenant", null, "Current name", null, version));
  }

  private AuthenticatedPrincipal principal(Long version) {
    return new AuthenticatedPrincipal("user", "Old name", IdentityScope.BUYER, "tenant", null,
        List.of("PLATFORM_ADMIN"), version);
  }
}
