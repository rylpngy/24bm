package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyRequirementChangePolicy;
import com.procurement.agency.domain.AgencyRequirementChangeRecords.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyRequirementChangePolicyTests {
  final OffsetDateTime opening = OffsetDateTime.parse("2026-11-09T01:00:00Z"),
      now = opening.plusHours(3),
      end = opening.plusMinutes(20);

  Create create(
      String kind,
      OffsetDateTime auth,
      OffsetDateTime sent,
      OffsetDateTime deadline,
      boolean checked,
      String before,
      String after) {
    return new Create(
        "fp",
        kind,
        "第3条",
        before,
        after,
        "采购人代表",
        "授权代表",
        "书面授权来源",
        "proof",
        auth,
        "requirements",
        "notice",
        sent,
        "线下签收",
        deadline,
        checked,
        checked,
        checked,
        "核对外部凭证",
        "key");
  }

  Create valid() {
    return create("technical", end, end.plusMinutes(10), now.plusHours(1), true, "原要求", "新要求");
  }

  void verify(Create d) {
    AgencyRequirementChangePolicy.create(d, opening, end, now);
  }

  @Test
  void allowsOnlyExplicitTechnicalServiceOrContractChanges() {
    for (var k : List.of("technical", "service", "contract"))
      assertDoesNotThrow(() -> verify(create(k, end, end, now, true, "前", "后")));
    for (var k : List.of("qualification", "scoring", "approved", ""))
      assertThrows(
          IllegalArgumentException.class, () -> verify(create(k, end, end, now, true, "前", "后")));
  }

  @Test
  void requiresHumanScopePrivacyAndResponseTimeChecks() {
    assertThrows(
        IllegalArgumentException.class,
        () -> verify(create("technical", end, end, now, false, "前", "后")));
  }

  @Test
  void forbidsAuthorizationBeforeSourceMeetingAndFutureDates() {
    assertThrows(
        IllegalArgumentException.class,
        () -> verify(create("technical", end.minusSeconds(1), end, now, true, "前", "后")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            verify(
                create(
                    "technical",
                    now.plusSeconds(1),
                    now.plusSeconds(1),
                    now.plusHours(1),
                    true,
                    "前",
                    "后")));
  }

  @Test
  void requiresNoticeAfterAuthorizationAndARealPreparationWindow() {
    assertThrows(
        IllegalArgumentException.class,
        () -> verify(create("technical", end, end.minusSeconds(1), now, true, "前", "后")));
    assertThrows(
        IllegalArgumentException.class,
        () -> verify(create("technical", end, end, end, true, "前", "后")));
    assertDoesNotThrow(() -> verify(valid()));
  }

  @Test
  void requiresDistinctBoundedBeforeAndAfterContent() {
    for (var before : List.of("", "新要求", "x".repeat(8001)))
      assertThrows(
          IllegalArgumentException.class,
          () -> verify(create("technical", end, end, now, true, before, "新要求")));
  }

  Snapshot snapshot() {
    return new Snapshot("s", "r", "p", 1, null, List.of(), List.of(), valid(), Map.of(), "actor");
  }

  Register receipt(OffsetDateTime time, boolean checked) {
    return new Register(
        "fp", "supplier", null, time, "实际接收人", "proof", "已核对同一内容", null, checked, "key");
  }

  @Test
  void requiresActualReceiptInTheNotificationWindow() {
    for (var t : List.of(end, now.plusSeconds(1)))
      assertThrows(
          IllegalArgumentException.class,
          () -> AgencyRequirementChangePolicy.receipt(receipt(t, true), snapshot(), now));
    assertDoesNotThrow(
        () -> AgencyRequirementChangePolicy.receipt(receipt(now, true), snapshot(), now));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyRequirementChangePolicy.receipt(receipt(now, false), snapshot(), now));
  }

  @Test
  void finalInitiationMustFollowEveryReceiptAndHonorPreparationDeadline() {
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyRequirementChangePolicy.finalWindow(end, now, now, now));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyRequirementChangePolicy.finalWindow(now, now, now, now.plusHours(1)));
    assertDoesNotThrow(
        () ->
            AgencyRequirementChangePolicy.finalWindow(
                now, now.plusHours(1), now, now.plusHours(1)));
  }

  @Test
  void missingCommandIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> verify(null));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyRequirementChangePolicy.receipt(null, snapshot(), now));
  }
}
