package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.application.AgencyOfficeTransport;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyOfficeTransportTests {
  AgencyOfficeTransport transport() {
    return new AgencyOfficeTransport(
        new ObjectMapper(),
        true,
        "http://127.0.0.1:18088",
        "http://localhost:18088",
        "http://host.docker.internal:18080",
        "independent-office-test-secret-at-least-32-bytes");
  }

  @Test
  void configurationNeedsSeparateSecretAndAllOrigins() {
    assertThat(new AgencyOfficeTransport(new ObjectMapper(), false, "", "", "", "").configured())
        .isFalse();
    assertThat(transport().configured()).isTrue();
    assertThat(
            new AgencyOfficeTransport(
                    new ObjectMapper(),
                    true,
                    "http://example.com",
                    "http://localhost:18088",
                    "http://host.docker.internal:18080",
                    "independent-office-test-secret-at-least-32-bytes")
                .configured())
        .isFalse();
  }

  @Test
  void jwtBindsPayloadAndRejectsTamperingAndExpiration() {
    var t = transport();
    String signed =
        t.sign(Map.of("key", "only-this-file", "status", 2), OffsetDateTime.now().plusMinutes(1));
    assertThat(t.verify(signed).path("key").asText()).isEqualTo("only-this-file");
    String[] parts = signed.split("\\.");
    assertThatThrownBy(
            () ->
                t.verify(
                    parts[0]
                        + "."
                        + Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString("{\"key\":\"another\"}".getBytes())
                        + "."
                        + parts[2]))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(
            () -> t.verify(t.sign(Map.of("key", "expired"), OffsetDateTime.now().minusMinutes(1))))
        .isInstanceOf(RuntimeException.class);
  }

  @Test
  void saveUrlsAreOriginAndCacheRestrictedWithoutRedirects() {
    var t = transport();
    assertThat(t.saveUri("http://127.0.0.1:18088/cache/files/key/output.docx?md5=proof").toString())
        .isEqualTo("http://localhost:18088/cache/files/key/output.docx?md5=proof");
    for (String url :
        List.of(
            "http://169.254.169.254/cache/files/a",
            "http://127.0.0.1:18080/cache/files/a",
            "http://127.0.0.1:18088/admin",
            "http://127.0.0.1:18088/cache/files/../admin",
            "http://127.0.0.1:18088/cache/files/%2e%2e/admin",
            "http://user@127.0.0.1:18088/cache/files/a",
            "http://127.0.0.1:18088/cache/files/a#ignored"))
      assertThatThrownBy(() -> t.saveUri(url)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void downloadCapabilityBindsTenantSessionAndKey() {
    var t = transport();
    assertThat(t.ticket("tenant-a", "s", "k"))
        .isNotEqualTo(t.ticket("tenant-b", "s", "k"))
        .isNotEqualTo(t.ticket("tenant-a", "s2", "k"))
        .isNotEqualTo(t.ticket("tenant-a", "s", "k2"));
  }
}
