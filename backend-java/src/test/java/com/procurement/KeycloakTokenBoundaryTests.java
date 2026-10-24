package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.identity.security.KeycloakTokenService;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.junit.jupiter.api.Test;

class KeycloakTokenBoundaryTests {
  @Test void validatesActualSignatureIssuerAudienceAndExpiry() throws Exception {
    RSAKey key = new RSAKeyGenerator(2048).keyID("test-key").generate();
    RSAKey other = new RSAKeyGenerator(2048).keyID("other-key").generate();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/jwks", exchange -> {
      byte[] bytes = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, bytes.length);
      try (var body = exchange.getResponseBody()) { body.write(bytes); }
    });
    server.start();
    try {
      String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/jwks";
      var service = new KeycloakTokenService(true, url, "https://id.example.edu/realms/company", "24bid-api");
      assertThat(service.parse(token(key, "https://id.example.edu/realms/company", "24bid-api", 300)).userId()).isEqualTo("user-1");
      for (String invalid : List.of(
          token(key, "https://other.example.edu", "24bid-api", 300),
          token(key, "https://id.example.edu/realms/company", "other-api", 300),
          token(key, "https://id.example.edu/realms/company", "24bid-api", -300),
          token(other, "https://id.example.edu/realms/company", "24bid-api", 300))) {
        assertThatThrownBy(() -> service.parse(invalid)).isInstanceOf(RuntimeException.class);
      }
    } finally { server.stop(0); }
  }

  private String token(RSAKey key, String issuer, String audience, long remainingSeconds) throws Exception {
    var claims = new JWTClaimsSet.Builder().issuer(issuer).subject("user-1").audience(audience)
        .expirationTime(Date.from(Instant.now().plusSeconds(remainingSeconds)))
        .issueTime(Date.from(Instant.now().minusSeconds(600)))
        .claim("authScope", "BUYER").claim("tenantId", "tenant-1").claim("roles", List.of("BUYER_OWNER")).build();
    var jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
    jwt.sign(new RSASSASigner(key)); return jwt.serialize();
  }
}
