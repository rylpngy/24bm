package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyAssessmentRecords.Session;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.domain.AgencyFinalQuoteRecords.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.identity.application.PermissionService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyFinalQuotePolicyTests {
  final AgencyJson json = new AgencyJson(new ObjectMapper().findAndRegisterModules());
  final OffsetDateTime start = OffsetDateTime.parse("2026-11-09T08:00:00Z"),
      cutoff = start.plusHours(1),
      now = cutoff.plusHours(1);

  Campaign campaign() {
    return json.read(
        json.write(
            Map.of(
                "id",
                "c",
                "sessionId",
                "s",
                "status",
                "collecting",
                "initiatedAt",
                start,
                "cutoffAt",
                cutoff)),
        Campaign.class);
  }

  Receive receive(OffsetDateTime at, String reason) {
    return new Receive(
        "a",
        "final.txt",
        new BigDecimal("150.00"),
        "CNY",
        at,
        "electronic_copy",
        "source",
        reason,
        "key");
  }

  Receipt receipt(OffsetDateTime at) {
    return new Receipt(
        "r",
        "t",
        "c",
        "a",
        "f",
        new BigDecimal("150.00"),
        "CNY",
        at,
        "electronic_copy",
        "source",
        "basis",
        "received",
        null,
        "u",
        now);
  }

  @Test
  void onlyNegotiationAndConsultationSupportFinalQuotes() {
    for (String m : List.of("竞争性谈判", "竞争性磋商"))
      assertDoesNotThrow(() -> AgencyFinalQuotePolicy.method(m));
    for (String m : List.of("公开招标", "邀请招标", "询价", "单一来源", ""))
      assertThrows(IllegalStateException.class, () -> AgencyFinalQuotePolicy.method(m));
  }

  @Test
  void offlineWindowMustBeRealAndCannotHaveReverseDeadline() {
    assertDoesNotThrow(() -> AgencyFinalQuotePolicy.window(start, cutoff, now));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyFinalQuotePolicy.window(now.plusSeconds(1), now.plusSeconds(2), now));
    assertThrows(
        IllegalArgumentException.class, () -> AgencyFinalQuotePolicy.window(start, start, now));
  }

  @Test
  void finalInitiationMustFollowActualInitialOpening() {
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyFinalQuotePolicy.afterOpening(start, start.plusSeconds(1)));
    assertDoesNotThrow(() -> AgencyFinalQuotePolicy.afterOpening(start, start));
    assertDoesNotThrow(() -> AgencyFinalQuotePolicy.afterOpening(start, start.minusSeconds(1)));
  }

  @Test
  void receiptMustFallAfterInitiationAndNotInTheFuture() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.received(
                campaign(), receive(start.minusSeconds(1), "basis"), now));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.received(campaign(), receive(now.plusSeconds(1), "basis"), now));
    assertDoesNotThrow(
        () -> AgencyFinalQuotePolicy.received(campaign(), receive(cutoff, "basis"), now));
  }

  @Test
  void afterDeadlineRegistrationAlwaysNeedsAnExplanation() {
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyFinalQuotePolicy.received(campaign(), receive(cutoff, ""), now));
    assertDoesNotThrow(
        () ->
            AgencyFinalQuotePolicy.received(
                campaign(), receive(cutoff.plusSeconds(1), "late receipt documented"), now));
  }

  @Test
  void missingFinalNeverUsesAnInitialPriceAndActiveReceiptCannotBeCalledMissing() {
    assertDoesNotThrow(
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", null, "not_submitted", "未提交的处理依据"), null, campaign()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", null, "not_submitted", "basis"), receipt(cutoff), campaign()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", null, "accepted", "basis"), null, campaign()));
  }

  @Test
  void deadlineIsInclusiveButLateMaterialCannotBecomeAccepted() {
    assertDoesNotThrow(
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", "r", "accepted", "basis"), receipt(cutoff), campaign()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", "r", "accepted", "basis"),
                receipt(cutoff.plusSeconds(1)),
                campaign()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", "r", "late", "basis"), receipt(cutoff), campaign()));
    assertDoesNotThrow(
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", "r", "late", "basis"),
                receipt(cutoff.plusSeconds(1)),
                campaign()));
  }

  @Test
  void exclusionRequiresAnExactReceiptAndRecordedBasis() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", "foreign", "excluded", "basis"), receipt(cutoff), campaign()));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", null, "excluded", ""), null, campaign()));
    assertDoesNotThrow(
        () ->
            AgencyFinalQuotePolicy.decision(
                new Decision("a", null, "excluded", "有权处理依据"), null, campaign()));
  }

  @Test
  void wildcardFilePermissionsDoNotExposeFinalMaterialsToOrdinaryReviewers() {
    var data = mock(AgencyFinalQuoteMapper.class);
    var sessions = mock(AgencyAssessmentMapper.class);
    var rounds = mock(AgencyEvaluationMapper.class);
    var guard = mock(AgencyGuard.class);
    var permissions = mock(PermissionService.class);
    when(guard.tenant()).thenReturn("t");
    when(guard.actor()).thenReturn("u");
    when(guard.permissions()).thenReturn(permissions);
    when(permissions.currentUserHas(anyString())).thenReturn(true);
    when(data.receiptFile("t", "f")).thenReturn(receipt(cutoff));
    when(data.find("t", "c")).thenReturn(campaign());
    when(sessions.session("t", "s"))
        .thenReturn(
            json.read(
                "{\"id\":\"s\",\"roundId\":\"round\",\"roundHash\":\"HASH\"}", Session.class));
    var cfg =
        new Config(
            "title",
            "rev",
            "comprehensive",
            "v1",
            "basis",
            "venue",
            null,
            List.of(
                new com.procurement.agency.domain.AgencyEvaluationRecords.Member(
                    "u", List.of("review_member"))),
            List.of(),
            "");
    var raw = json.write(Map.of("config", cfg));
    String hash = json.hash(json.read(raw, Map.class));
    when(sessions.session("t", "s"))
        .thenReturn(
            json.read(
                "{\"id\":\"s\",\"roundId\":\"round\",\"roundHash\":\"" + hash + "\"}",
                Session.class));
    when(rounds.round("t", "round"))
        .thenReturn(
            new Round(
                "round", "t", "p", 1, "frozen", "{}", 1, raw, hash, "u", null, null, null, null,
                null));
    var access =
        new AgencyFinalQuoteAccess(
            data,
            sessions,
            rounds,
            guard,
            json,
            mock(AgencyEvaluationControls.class),
            mock(com.procurement.agency.infrastructure.AgencyFinalResponseMapper.class));
    var file =
        new FileRow("f", "t", "p", "final.txt", "final_quote_material", "restricted", "u", null);
    assertFalse(access.visible(file));
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () -> access.read(file, null));
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class, () -> access.write(file));
  }
}
