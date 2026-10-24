package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.procurement.identity.security.*;
import com.procurement.identity.application.AuthenticatedSessionService;
import com.procurement.identity.domain.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ProductionTokenBoundaryTests {
  @Test void productionRejectsSelfIssuedTokensWithoutTryingLocalDecoder() throws Exception {
    var local = mock(JwtTokenService.class); var external = mock(KeycloakTokenService.class);
    var sessions = mock(AuthenticatedSessionService.class);
    var filter = new JwtAuthenticationFilter(local, external, sessions, false);
    var request = new MockHttpServletRequest(); request.addHeader("Authorization", "Bearer old-local-token");
    var response = new MockHttpServletResponse(); var called = new AtomicBoolean();
    filter.doFilter(request, response, (req, res) -> called.set(true));
    assertThat(response.getStatus()).isEqualTo(401); assertThat(called.get()).isFalse();
    verifyNoInteractions(local, sessions);
  }

  @Test void externalTokenStillRequiresCurrentActiveAccount() throws Exception {
    var local = mock(JwtTokenService.class); var external = mock(KeycloakTokenService.class);
    var sessions = mock(AuthenticatedSessionService.class);
    var principal = new AuthenticatedPrincipal("user", "User", IdentityScope.BUYER, "tenant", null, List.of("BUYER_OWNER"));
    when(external.isEnabled()).thenReturn(true); when(external.parse("signed-token")).thenReturn(principal);
    when(sessions.validate(principal)).thenThrow(new org.springframework.security.authentication.BadCredentialsException("Disabled"));
    var request = new MockHttpServletRequest(); request.addHeader("Authorization", "Bearer signed-token");
    var response = new MockHttpServletResponse();
    new JwtAuthenticationFilter(local, external, sessions, false).doFilter(request, response, (req, res) -> { throw new AssertionError("Disabled account reached business handler"); });
    assertThat(response.getStatus()).isEqualTo(401); verifyNoInteractions(local);
  }
}
