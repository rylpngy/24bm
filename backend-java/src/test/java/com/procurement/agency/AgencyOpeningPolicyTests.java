package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.agency.domain.AgencyOpeningRecords.Manifest;
import com.procurement.agency.domain.AgencyOpeningRecords.Opening;
import com.procurement.agency.domain.AgencyOpeningRecords.Receipt;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.*;
import com.procurement.identity.application.PermissionService;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyOpeningPolicyTests {
  Criterion rule(String key, String stage) {
    return new Criterion(
        key,
        key,
        stage,
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

  Config config(List<String> roles, List<Criterion> rules) {
    return new Config(
        "title",
        "rev",
        "comprehensive",
        "V1",
        "basis",
        "venue",
        null,
        List.of(new com.procurement.agency.domain.AgencyEvaluationRecords.Member("u", roles)),
        rules.stream().map(r -> new RulePair(r, r, "p1", true)).toList(),
        "tie");
  }

  @Test
  void tenderMustExplicitlyContainBothReviewsBeforeIntake() {
    var cfg = config(List.of("review_member"), List.of(rule("T", "technical")));
    assertThrows(IllegalStateException.class, () -> AgencyAssessmentStages.order(cfg, "公开招标"));
    assertThrows(IllegalStateException.class, () -> AgencyAssessmentStages.order(cfg, "邀请招标"));
    assertEquals(List.of("evaluation"), AgencyAssessmentStages.order(cfg, "单一来源"));
  }

  @Test
  void stagesAreOrderedAndOneAccountCanHaveSeparatePhaseTasks() {
    var cfg =
        config(
            List.of("qualification_reviewer", "conformity_reviewer", "review_member"),
            List.of(rule("T", "technical"), rule("C", "conformity"), rule("Q", "qualification")));
    assertEquals(
        List.of("qualification", "conformity", "evaluation"),
        AgencyAssessmentStages.order(cfg, "公开招标"));
    var stages = new AgencyAssessmentStages(null, null, null);
    assertEquals(1, stages.criteria(cfg, "u", "qualification").size());
    assertEquals("C", stages.criteria(cfg, "u", "conformity").getFirst().key());
    assertEquals(3, stages.criteria(cfg, "u", "legacy").size());
  }

  private record Fixture(
      AgencyResponseAccess access,
      AgencyOpeningMapper data,
      AgencyEvaluationMapper rounds,
      AgencyGuard guard,
      AgencyJson json,
      FileRow file) {}

  Fixture fixture(List<String> roles) {
    var data = mock(AgencyOpeningMapper.class);
    var rounds = mock(AgencyEvaluationMapper.class);
    var guard = mock(AgencyGuard.class);
    var perms = mock(PermissionService.class);
    when(guard.tenant()).thenReturn("t");
    when(guard.actor()).thenReturn("u");
    when(guard.permissions()).thenReturn(perms);
    when(perms.currentUserHas(anyString())).thenReturn(true);
    var json = new AgencyJson(new ObjectMapper().findAndRegisterModules());
    var raw = json.write(Map.of("config", config(roles, List.of())));
    var row =
        new Round(
            "round",
            "t",
            "p",
            1,
            "frozen",
            "{}",
            1,
            raw,
            json.hash(json.read(raw, Map.class)),
            "u",
            null,
            null,
            "u",
            null,
            "");
    when(rounds.round("t", "round")).thenReturn(row);
    var receipt =
        new Receipt(
            "receipt",
            "t",
            "p",
            "round",
            "s",
            "item",
            "file",
            null,
            "electronic_copy",
            "source",
            "",
            "",
            "received",
            1,
            "u",
            null,
            "");
    when(data.receiptFile("t", "file")).thenReturn(receipt);
    return new Fixture(
        new AgencyResponseAccess(data, rounds, guard, json, mock(AgencyEvaluationControls.class)),
        data,
        rounds,
        guard,
        json,
        new FileRow(
            "file", "t", "p", "response.txt", "response_material", "restricted", "u", null));
  }

  void opened(Fixture f, List<String> roles) {
    var manifest =
        List.of(
            new Manifest(
                "receipt", "s", "item", "file", "v", "attachment", "response.txt", "hash", roles));
    var o =
        new Opening(
            "opening",
            "t",
            "p",
            "round",
            f.json().write(manifest),
            f.json().hash(manifest),
            "[]",
            null,
            "proof",
            "hash",
            "note",
            "u",
            null);
    when(f.data().opening("t", "round")).thenReturn(o);
  }

  @Test
  void creatorAndWildcardCannotReadBeforeOpening() {
    var f = fixture(List.of("organizer"));
    assertTrue(f.access().visible(f.file()));
    assertFalse(f.access().readable(f.file()));
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () ->
            f.access()
                .read(
                    f.file(),
                    new FileVersion(
                        "v", "t", "file", 1, "sealed", "attachment", "hash", 1L, "u", null, null)));
  }

  @Test
  void openedContentStillFollowsFrozenReaderDuties() {
    var f = fixture(List.of("qualification_reviewer"));
    opened(f, List.of("review_member"));
    assertFalse(f.access().readable(f.file()));
    opened(f, List.of("qualification_reviewer"));
    assertTrue(f.access().readable(f.file()));
  }

  @Test
  void rawFileAccessCannotBypassTheOpeningGate() {
    var f = fixture(List.of("organizer"));
    var mapper = mock(AgencyMapper.class);
    when(mapper.file("t", "file")).thenReturn(f.file());
    var v =
        new FileVersion("v", "t", "file", 1, "sealed", "attachment", "hash", 1L, "u", null, null);
    when(mapper.version("t", "v")).thenReturn(v);
    var access = new AgencyFileAccess(mapper, f.guard(), null, null, f.access(), null, null);
    assertThrows(
        com.procurement.common.tenant.PermissionDeniedException.class,
        () -> access.requireDownloadAccess("v"));
    opened(f, List.of("organizer"));
    assertDoesNotThrow(() -> access.requireDownloadAccess("v"));
  }

  @Test
  void alteredManifestAndFrozenIdentityFailClosed() {
    var f = fixture(List.of("review_member"));
    opened(f, List.of("review_member"));
    var original = f.data().opening("t", "round");
    when(f.data().opening("t", "round"))
        .thenReturn(
            new Opening(
                "opening",
                "t",
                "p",
                "round",
                original.manifestJson(),
                "tampered",
                "[]",
                null,
                "proof",
                "hash",
                "note",
                "u",
                null));
    assertFalse(f.access().readable(f.file()));
    opened(f, List.of("review_member"));
    var row = f.rounds().round("t", "round");
    when(f.rounds().round("t", "round"))
        .thenReturn(
            new Round(
                "round",
                "t",
                "p",
                1,
                "frozen",
                "{}",
                1,
                row.frozenJson(),
                "tampered",
                "u",
                null,
                null,
                "u",
                null,
                ""));
    assertFalse(f.access().readable(f.file()));
  }
}
