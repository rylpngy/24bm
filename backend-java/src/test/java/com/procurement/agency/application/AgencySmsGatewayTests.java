package com.procurement.agency.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.domain.AgencySmsRecords.*;
import com.procurement.agency.infrastructure.AgencySmsMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencySmsGatewayTests {
  final ObjectMapper json = new ObjectMapper();
  final String secret = "s".repeat(48),
      encryption = Base64.getEncoder().encodeToString(new byte[32]);

  AgencySmsGateway gateway(String url) {
    return new AgencySmsGateway(url, secret, encryption, json);
  }

  Delivery delivery(String status, String ref) {
    return new Delivery(
        "d",
        "t",
        "p",
        "event",
        "user",
        1,
        status,
        ref,
        1,
        "",
        "actor",
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  @Test
  void encryptedContactIsBoundToTenantAndUser() {
    var g = gateway("http://127.0.0.1:1/sms");
    String cipher = g.encrypt("t", "u", "+8613800000000");
    assertFalse(cipher.contains("138000"));
    var c = new Contact("t", "u", cipher, "+86****0000", true, 1, "a", "test", null);
    assertEquals("+8613800000000", g.phone(c));
    assertThrows(
        IllegalStateException.class,
        () -> g.phone(new Contact("other", "u", cipher, "", true, 1, "a", "test", null)));
    assertFalse(gateway("http://remote.invalid/sms").configured());
  }

  @Test
  void signedHttpAcceptanceIsNotDeliveryAndBadSignaturesAreUnknown() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var g = gateway("http://127.0.0.1:" + server.getAddress().getPort() + "/sms");
    var statuses = new java.util.concurrent.atomic.AtomicReference<>("accepted");
    server.createContext(
        "/sms",
        e -> {
          try {
            byte[] body = e.getRequestBody().readAllBytes();
            g.verify(
                e.getRequestHeaders().getFirst("X-24BM-Timestamp"),
                e.getRequestHeaders().getFirst("X-24BM-Signature"),
                body);
            assertEquals("d", e.getRequestHeaders().getFirst("Idempotency-Key"));
            var request = json.readTree(body);
            assertEquals("+8613800000000", request.path("recipient").asText());
            byte[] response =
                json.writeValueAsBytes(
                    Map.of("clientId", "d", "providerRef", "provider-1", "status", statuses.get()));
            String ts = String.valueOf(Instant.now().getEpochSecond());
            e.getResponseHeaders().add("X-24BM-Timestamp", ts);
            e.getResponseHeaders()
                .add(
                    "X-24BM-Signature",
                    statuses.get().equals("invalid") ? "bad" : g.signature(ts, response));
            e.sendResponseHeaders(200, response.length);
            e.getResponseBody().write(response);
          } finally {
            e.close();
          }
        });
    server.start();
    try {
      var c =
          new Contact(
              "t",
              "user",
              g.encrypt("t", "user", "+8613800000000"),
              "masked",
              true,
              1,
              "a",
              "test",
              null);
      assertEquals("accepted", g.send(delivery("sending", null), c).status());
      statuses.set("rejected");
      assertEquals("failed", g.send(delivery("sending", null), c).status());
      statuses.set("invalid");
      assertEquals("unknown", g.send(delivery("sending", null), c).status());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void receiptReplayIsIdempotentAndTerminalStatesNeverReverse() {
    var data = mock(AgencySmsMapper.class);
    var service = new AgencySmsService(null, data, null, null, null);
    var receipt = new Receipt("t", "d", "provider-1", "delivered");
    when(data.lock("t", "d")).thenReturn(delivery("accepted", "provider-1"));
    service.receipt(receipt, "hash");
    verify(data).state("t", "d", "delivered", "provider-1", "已收到经签名验证的网关终态回执", 0);
    when(data.seen("t", "d", "hash")).thenReturn(1);
    service.receipt(receipt, "hash");
    verify(data, times(1)).receipt("t", "d", "hash", "delivered");
    when(data.lock("t", "d")).thenReturn(delivery("delivered", "provider-1"));
    assertThrows(
        IllegalStateException.class,
        () -> service.receipt(new Receipt("t", "d", "provider-1", "failed"), "different"));
    assertThrows(
        IllegalArgumentException.class,
        () -> service.receipt(new Receipt("t", "d", "other", "delivered"), "other"));
  }

  @Test
  void expiredOrMutatedReceiptCannotAuthorizeUpdate() {
    var g = gateway("http://127.0.0.1:1/sms");
    byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
    String ts = String.valueOf(Instant.now().minusSeconds(600).getEpochSecond());
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () -> g.verify(ts, g.signature(ts, body), body));
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () -> g.verify(null, null, body));
  }

  @Test
  void recipientLosingPlanPermissionCannotReceiveNewSms() {
    var guard = mock(AgencyGuard.class);
    var permissions = mock(com.procurement.identity.application.PermissionService.class);
    when(guard.permissions()).thenReturn(permissions);
    when(guard.tenant()).thenReturn("t");
    var data = mock(com.procurement.agency.infrastructure.AgencyExecutionMapper.class);
    var support = new AgencyExecutionSupport(guard, null, data, null, null, null, null, null, null);
    var pkg =
        json.convertValue(Map.of(), com.procurement.agency.domain.AgencyRecords.PackageRow.class);
    when(guard.requireApproved("p")).thenReturn(pkg);
    var reminder =
        json.convertValue(
            Map.of(
                "packageId",
                "p",
                "status",
                "delivered",
                "milestoneId",
                "m",
                "recipientId",
                "u",
                "milestoneVersion",
                1),
            com.procurement.agency.domain.AgencyExecutionRecords.ReminderDelivery.class);
    when(data.reminderDelivery("t", "event")).thenReturn(reminder);
    var milestone =
        json.convertValue(
            Map.of("id", "m", "version", 1, "status", "planned"),
            com.procurement.agency.domain.AgencyExecutionRecords.Milestone.class);
    when(data.milestone("t", "m")).thenReturn(milestone);
    var directory = mock(AgencyDirectory.class);
    when(directory.people())
        .thenReturn(
            List.of(new com.procurement.agency.domain.AgencyRecords.Person("u", "合成接收人", null)));
    var collaboration = mock(AgencyCollaborationService.class);
    when(collaboration.userVisible(pkg, "u")).thenReturn(true);
    when(permissions.userHas("u", "buyer:agency:plan:read")).thenReturn(true);
    var service =
        new AgencySmsService(support, mock(AgencySmsMapper.class), null, directory, collaboration);
    assertDoesNotThrow(() -> service.eligible("p", "event"));
    when(permissions.userHas("u", "buyer:agency:plan:read")).thenReturn(false);
    assertThrows(IllegalStateException.class, () -> service.eligible("p", "event"));
  }
}
