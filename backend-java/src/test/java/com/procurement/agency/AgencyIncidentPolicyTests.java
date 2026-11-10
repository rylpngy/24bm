package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyIncidentRecords.*;
import com.procurement.agency.infrastructure.AgencyIncidentMapper;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyIncidentPolicyTests {
  final OffsetDateTime now = OffsetDateTime.parse("2026-11-09T12:00:00Z");

  Incident incident(String status) {
    return new AgencyJson(new ObjectMapper().findAndRegisterModules())
        .read(
            "{\"id\":\"i\",\"status\":\"" + status + "\",\"occurredAt\":\"2026-11-09T11:00:00Z\"}",
            Incident.class);
  }

  Control control(String state, long version) {
    return new Control("t", "round", "pkg", state, version, "u", now);
  }

  Create create(String kind, String effect, OffsetDateTime at, boolean reviewed) {
    return new Create(
        kind,
        "title",
        at,
        "u",
        "impact",
        "description",
        "proof",
        effect,
        "conditions",
        reviewed,
        "key");
  }

  @Test
  void catalogueKeepsDifferentProcurementProblemsDistinct() {
    for (String kind :
        List.of(
            "member_absent",
            "recusal",
            "missing_file",
            "version_conflict",
            "invalid_response",
            "insufficient_subjects",
            "abnormal_price",
            "incomplete_opinion",
            "network_failure",
            "evaluation_pause",
            "procurement_failure",
            "termination",
            "legal_correction",
            "reorganization"))
      assertDoesNotThrow(() -> AgencyIncidentPolicy.create(create(kind, "pause", now, true), now));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyIncidentPolicy.create(create("auto_switch_method", "pause", now, true), now));
  }

  @Test
  void futureOccurrenceOrUnreviewedImpactDecisionIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyIncidentPolicy.create(
                create("network_failure", "observe", now.plusSeconds(1), true), now));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyIncidentPolicy.create(create("network_failure", "observe", now, false), now));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyIncidentPolicy.create(
                create("network_failure", "silent_resume", now, true), now));
  }

  @Test
  void resolutionRequiresActualChronologyAndExplicitConditions() {
    for (var at : List.of(now.minusHours(2), now.plusSeconds(1)))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              AgencyIncidentPolicy.resolution(
                  incident("open"),
                  new Resolution(1L, at, "continue_ready", "proof", true, "note", "key"),
                  now));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyIncidentPolicy.resolution(
                incident("open"),
                new Resolution(1L, now, "continue_ready", "proof", false, "note", "key"),
                now));
    assertDoesNotThrow(
        () ->
            AgencyIncidentPolicy.resolution(
                incident("open"),
                new Resolution(1L, now, "reorganize", "proof", true, "note", "key"),
                now));
  }

  @Test
  void activePauseMustBeBackedByAnUnresolvedIncident() {
    assertThrows(
        IllegalStateException.class,
        () -> AgencyIncidentPolicy.transition(control("active", 0), List.of(), "pause"));
    assertDoesNotThrow(
        () ->
            AgencyIncidentPolicy.transition(
                control("active", 1), List.of(incident("open")), "pause"));
    assertThrows(
        IllegalStateException.class,
        () ->
            AgencyIncidentPolicy.transition(
                control("paused", 1), List.of(incident("open")), "pause"));
  }

  @Test
  void closedIncidentsDoNotImplicitlyResumeAndOpenIncidentsBlockResume() {
    assertThrows(
        IllegalStateException.class,
        () ->
            AgencyIncidentPolicy.transition(
                control("paused", 1), List.of(incident("open")), "resume"));
    assertThrows(
        IllegalStateException.class,
        () ->
            AgencyIncidentPolicy.transition(
                control("active", 2), List.of(incident("resolved")), "resume"));
    assertDoesNotThrow(
        () ->
            AgencyIncidentPolicy.transition(
                control("paused", 2), List.of(incident("resolved")), "resume"));
  }

  @Test
  void terminationIsStickyAndDoesNotDeleteAnyIncident() {
    var incidents = List.of(incident("open"));
    for (String action : List.of("resume", "pause", "terminate"))
      assertThrows(
          IllegalStateException.class,
          () -> AgencyIncidentPolicy.transition(control("terminated", 3), incidents, action));
    assertEquals(1, incidents.size());
    assertDoesNotThrow(
        () -> AgencyIncidentPolicy.transition(control("paused", 2), incidents, "terminate"));
  }

  @Test
  void defaultRoundHasNoPauseAndZeroEpoch() {
    var data = mock(AgencyIncidentMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    var controls = new AgencyEvaluationControls(data, guard);
    assertEquals("active", controls.control("round").state());
    assertEquals(0L, controls.marker("round").get("version"));
    assertTrue(controls.writeBlockers("round").isEmpty());
    assertTrue(controls.reviewBlockers("round").isEmpty());
  }

  @Test
  void observingDoesNotBlockPersonalWritesButAlwaysBlocksResultCalculation() {
    var data = mock(AgencyIncidentMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    when(data.control("t", "round")).thenReturn(control("active", 1));
    when(data.incidents("t", "round")).thenReturn(List.of(incident("open")));
    var controls = new AgencyEvaluationControls(data, guard);
    assertDoesNotThrow(() -> controls.requireWritable("round"));
    assertTrue(controls.reviewBlockers("round").getFirst().contains("未处理异常"));
  }

  @Test
  void pausedAndTerminatedStatesDenyBusinessWritesWhileRetainingReadOnlyReasons() {
    var data = mock(AgencyIncidentMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    var controls = new AgencyEvaluationControls(data, guard);
    for (String state : List.of("paused", "terminated")) {
      when(data.control("t", "round")).thenReturn(control(state, 2));
      assertThrows(IllegalStateException.class, () -> controls.requireWritable("round"));
      assertFalse(controls.writeBlockers("round").isEmpty());
    }
  }

  @Test
  void resumingUsesANewEpochRatherThanRestoringOldPreviewIdentity() {
    var data = mock(AgencyIncidentMapper.class);
    var guard = mock(AgencyGuard.class);
    when(guard.tenant()).thenReturn("t");
    var controls = new AgencyEvaluationControls(data, guard);
    when(data.control("t", "round")).thenReturn(control("active", 1));
    var before = controls.marker("round");
    when(data.control("t", "round")).thenReturn(control("active", 4));
    assertNotEquals(before, controls.marker("round"));
    assertDoesNotThrow(() -> controls.requireWritable("round"));
  }
}
