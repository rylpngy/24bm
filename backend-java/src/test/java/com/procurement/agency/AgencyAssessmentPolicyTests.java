package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyAssessmentPolicy;
import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyAssessmentPolicyTests {
  Criterion score() {
    return new Criterion(
        "T",
        "技术",
        "technical",
        "供应商",
        "score",
        BigDecimal.ZERO,
        BigDecimal.TEN,
        new BigDecimal("100"),
        "weighted_normalized",
        true,
        2,
        "HALF_UP");
  }

  Criterion pass() {
    return new Criterion(
        "Q",
        "资格",
        "qualification",
        "供应商",
        "pass_fail",
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        "none",
        true,
        2,
        "HALF_UP");
  }

  Entry entry(String supplier, String score) {
    return new Entry(
        supplier, "T", score == null ? null : new BigDecimal(score), null, "材料第1页", "本人独立意见");
  }

  List<Subject> subjects() {
    return List.of(new Subject("a", "甲"), new Subject("b", "乙"));
  }

  @Test
  void personalDraftMayBePartialButSubmitRequiresEveryAssignedCell() {
    AgencyAssessmentPolicy.validate(subjects(), List.of(score()), List.of(entry("a", null)), false);
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(), List.of(score()), List.of(entry("a", "8")), true));
    AgencyAssessmentPolicy.validate(
        subjects(), List.of(score()), List.of(entry("a", "8"), entry("b", "0")), true);
  }

  @Test
  void rejectOtherRolesUnknownSubjectsAndDuplicates() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(),
                List.of(score()),
                List.of(new Entry("a", "Q", null, "pass", "e", "o")),
                false));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(), List.of(score()), List.of(entry("foreign", "8")), false));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(), List.of(score()), List.of(entry("a", "8"), entry("a", "8")), false));
  }

  @Test
  void decimalLimitsAndEvidenceAreCheckedBeforeSubmission() {
    for (String n : List.of("-0.01", "10.000001", "0.1234567"))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              AgencyAssessmentPolicy.validate(
                  subjects(), List.of(score()), List.of(entry("a", n)), false));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                List.of(subjects().getFirst()),
                List.of(score()),
                List.of(new Entry("a", "T", BigDecimal.ONE, null, "", "opinion")),
                true));
  }

  @Test
  void passFailCannotCarryScoresOrUnrecognisedConclusions() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(),
                List.of(pass()),
                List.of(new Entry("a", "Q", BigDecimal.ONE, "pass", "e", "o")),
                false));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.validate(
                subjects(),
                List.of(pass()),
                List.of(new Entry("a", "Q", null, "qualified", "e", "o")),
                false));
  }

  @Test
  void correctionKeepsEveryUnauthorisedCellUnchanged() {
    var original = List.of(entry("a", "8"), entry("b", "9"));
    AgencyAssessmentPolicy.correctionScope(
        original, List.of(entry("a", "7"), entry("b", "9.0")), List.of(new Cell("a", "T")));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.correctionScope(
                original, List.of(entry("a", "7"), entry("b", "8")), List.of(new Cell("a", "T"))));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyAssessmentPolicy.correctionScope(
                original, List.of(entry("a", "7")), List.of(new Cell("a", "T"))));
  }

  @Test
  void loginIdentityHasOnlyItsFrozenDutiesEvenForAdministrativeUsers() {
    var a = score();
    var b = pass();
    var config =
        new Config(
            "title",
            "rev",
            "comprehensive",
            "V1",
            "basis",
            "venue",
            null,
            List.of(
                new Member("admin", List.of("organizer", "leader")),
                new Member("reviewer", List.of("review_member")),
                new Member("qualifier", List.of("qualification_reviewer"))),
            List.of(new RulePair(a, a, "p1", true), new RulePair(b, b, "p2", true)),
            "tie");
    assertTrue(AgencyAssessmentPolicy.assigned(config, "admin").isEmpty());
    assertEquals(List.of(a), AgencyAssessmentPolicy.assigned(config, "reviewer"));
    assertEquals(List.of(b), AgencyAssessmentPolicy.assigned(config, "qualifier"));
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () -> AgencyAssessmentPolicy.assigned(config, "other"));
  }
}
