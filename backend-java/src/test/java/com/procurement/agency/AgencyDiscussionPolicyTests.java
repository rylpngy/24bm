package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyDiscussionPolicy;
import com.procurement.agency.domain.AgencyDiscussionRecords.Content;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyDiscussionPolicyTests {
  final OffsetDateTime opened = OffsetDateTime.parse("2026-11-09T08:00:00Z"),
      now = opened.plusHours(2);

  Content content(
      OffsetDateTime start, OffsetDateTime end, List<String> staff, String change, String note) {
    return new Content(
        start, end, staff, "线下代表及授权来源", "议题", "私有逐家过程", "供应商回应", "结论", change, note, "proof");
  }

  @Test
  void onlyNegotiationAndConsultationAreAllowed() {
    for (String method : List.of("竞争性谈判", "竞争性磋商"))
      assertDoesNotThrow(() -> AgencyDiscussionPolicy.method(method));
    for (String method : List.of("公开招标", "邀请招标", "询价", "单一来源", ""))
      assertThrows(IllegalStateException.class, () -> AgencyDiscussionPolicy.method(method));
  }

  @Test
  void partialDraftIsPreservedButCannotBeConfirmed() {
    var draft =
        new Content(null, null, List.of(), null, null, "未完成草稿", null, null, null, null, null);
    assertDoesNotThrow(
        () -> AgencyDiscussionPolicy.validate(draft, Set.of("u"), opened, now, false));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyDiscussionPolicy.validate(draft, Set.of("u"), opened, now, true));
  }

  @Test
  void realTimesMustBeAfterOpeningAndNotInTheFuture() {
    for (var start : List.of(opened.minusSeconds(1), now.plusSeconds(1)))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              AgencyDiscussionPolicy.validate(
                  content(start, now, List.of("u"), "none", ""), Set.of("u"), opened, now, true));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.validate(
                content(now, opened, List.of("u"), "none", ""), Set.of("u"), opened, now, true));
  }

  @Test
  void supplierSpecificSuccessiveMeetingsAreChronological() {
    var first = content(opened, opened.plusMinutes(20), List.of("u"), "none", "");
    var second = content(opened.plusMinutes(20), opened.plusMinutes(30), List.of("u"), "none", "");
    assertDoesNotThrow(() -> AgencyDiscussionPolicy.chronology(first, second));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.chronology(
                first,
                content(opened.plusMinutes(19), opened.plusMinutes(30), List.of("u"), "none", "")));
  }

  @Test
  void staffMustBeUniqueFrozenAccountsAndAtLeastOneForConfirmation() {
    for (var staff : List.of(List.<String>of(), List.of("u", "u"), List.of("foreign")))
      assertThrows(
          IllegalArgumentException.class,
          () ->
              AgencyDiscussionPolicy.validate(
                  content(opened, now, staff, "none", ""), Set.of("u"), opened, now, true));
  }

  @Test
  void changedRequirementsNeedARecordedPendingDecisionNotAnInlineApproval() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.validate(
                content(opened, now, List.of("u"), "approved", "already agreed"),
                Set.of("u"),
                opened,
                now,
                true));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.validate(
                content(opened, now, List.of("u"), "requires_authorized_change", ""),
                Set.of("u"),
                opened,
                now,
                true));
    assertDoesNotThrow(
        () ->
            AgencyDiscussionPolicy.validate(
                content(opened, now, List.of("u"), "requires_authorized_change", "待有权确认及同步通知"),
                Set.of("u"),
                opened,
                now,
                true));
  }

  @Test
  void notesAndEvidenceAreMandatoryAtConfirmation() {
    var c = content(opened, now, List.of("u"), "none", "");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.validate(
                new Content(
                    c.startedAt(),
                    c.endedAt(),
                    c.staffUserIds(),
                    c.supplierAttendees(),
                    c.agenda(),
                    c.discussion(),
                    "",
                    c.conclusion(),
                    c.changeDisposition(),
                    c.changeNote(),
                    c.evidenceVersionId()),
                Set.of("u"),
                opened,
                now,
                true));
  }

  @Test
  void longSensitiveNotesAreBoundedEvenForDrafts() {
    var c = content(opened, now, List.of("u"), "none", "");
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDiscussionPolicy.validate(
                new Content(
                    c.startedAt(),
                    c.endedAt(),
                    c.staffUserIds(),
                    c.supplierAttendees(),
                    c.agenda(),
                    "x".repeat(8001),
                    c.supplierResponse(),
                    c.conclusion(),
                    c.changeDisposition(),
                    c.changeNote(),
                    c.evidenceVersionId()),
                Set.of("u"),
                opened,
                now,
                false));
  }
}
