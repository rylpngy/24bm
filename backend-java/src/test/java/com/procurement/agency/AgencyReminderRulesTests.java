package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.domain.AgencyExecutionRecords.ReminderSettings;
import com.procurement.agency.domain.AgencyReminderRules;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyReminderRulesTests {
  private final OffsetDateTime due = OffsetDateTime.parse("2026-11-09T12:00:00+08:00");

  private ReminderSettings policy() {
    return new ReminderSettings(true, List.of(72, 24, 4), List.of(0, 24, 72), "manager", 24);
  }

  @Test
  void defaultPolicyMatchesExistingOneDayAndOverdueSemantics() {
    assertThat(AgencyReminderRules.levels(null, due, due.minusHours(25))).isEmpty();
    assertThat(AgencyReminderRules.levels(null, due, due.minusHours(24)))
        .containsExactly("before:24");
    assertThat(AgencyReminderRules.levels(null, due, due)).containsExactly("overdue:0");
  }

  @Test
  void delayedScanChoosesOnlyCurrentLeadTier() {
    assertThat(AgencyReminderRules.levels(policy(), due, due.minusHours(10)))
        .containsExactly("before:24");
    assertThat(AgencyReminderRules.levels(policy(), due, due.minusHours(2)))
        .containsExactly("before:4");
  }

  @Test
  void delayedOverdueDoesNotBackfillEveryMissedTier() {
    assertThat(AgencyReminderRules.levels(policy(), due, due.plusHours(80)))
        .containsExactly("overdue:72", "escalation:24");
  }

  @Test
  void escalationStartsOnlyAtConfiguredBoundary() {
    assertThat(AgencyReminderRules.levels(policy(), due, due.plusHours(23)))
        .containsExactly("overdue:0");
    assertThat(AgencyReminderRules.levels(policy(), due, due.plusHours(24)))
        .containsExactly("overdue:24", "escalation:24");
  }

  @Test
  void disabledPolicyProducesNoEvents() {
    assertThat(
            AgencyReminderRules.levels(
                new ReminderSettings(false, List.of(24), List.of(0), "manager", 0),
                due,
                due.plusDays(5)))
        .isEmpty();
  }

  @Test
  void sameInstantInAnotherTimeZoneHasSameTier() {
    assertThat(
            AgencyReminderRules.levels(
                policy(), due, due.plusHours(24).withOffsetSameInstant(ZoneOffset.UTC)))
        .isEqualTo(AgencyReminderRules.levels(policy(), due, due.plusHours(24)));
  }

  @Test
  void emptyTierListsAllowEscalationOnly() {
    assertThat(
            AgencyReminderRules.levels(
                new ReminderSettings(true, List.of(), List.of(), "manager", 2),
                due,
                due.plusHours(3)))
        .containsExactly("escalation:2");
  }

  @Test
  void duplicatedOrUnboundedRulesAreRejected() {
    for (var input :
        List.of(
            new ReminderSettings(true, List.of(24, 24), List.of(), null, 0),
            new ReminderSettings(true, List.of(0), List.of(), null, 0),
            new ReminderSettings(true, List.of(), List.of(721), null, 0),
            new ReminderSettings(true, List.of(1, 2, 3, 4, 5, 6), List.of(), null, 0),
            new ReminderSettings(true, List.of(), List.of(), null, -1)))
      assertThatThrownBy(() -> AgencyReminderRules.normalize(input))
          .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void normalizedSettingsAreOrderedAndBlankEscalationIsAbsent() {
    var p =
        AgencyReminderRules.normalize(
            new ReminderSettings(null, List.of(72, 4, 24), List.of(24, 0), " ", null));
    assertThat(p.leadHours()).containsExactly(4, 24, 72);
    assertThat(p.overdueHours()).containsExactly(0, 24);
    assertThat(p.enabled()).isTrue();
    assertThat(p.escalationUserId()).isNull();
  }

  @Test
  void deploymentRetainsLegacyDefaultEventIdentity() {
    var m =
        new com.procurement.agency.application.AgencyJson(
                new com.fasterxml.jackson.databind.ObjectMapper())
            .read(
                "{\"id\":\"m\",\"version\":1}",
                com.procurement.agency.domain.AgencyExecutionRecords.Milestone.class);
    String legacy =
        "agency-plan-alert-"
            + UUID.nameUUIDFromBytes(
                "t:m:u:1:upcoming".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    assertThat(AgencyReminderRules.eventId("t", m, 0, "u", "before:24")).isEqualTo(legacy);
    assertThat(AgencyReminderRules.eventId("t", m, 1, "u", "before:24")).isNotEqualTo(legacy);
  }
}
