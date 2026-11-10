package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.time.*;
import java.util.*;

/**
 * Deterministic bounded reminder tiers. Late scans send the current tier, not every missed tier.
 */
public final class AgencyReminderRules {
  private AgencyReminderRules() {}

  public static ReminderSettings normalize(ReminderSettings value) {
    if (value == null) return new ReminderSettings(true, List.of(24), List.of(0), null, 24);
    var lead = tiers(value.leadHours() == null ? List.of(24) : value.leadHours(), 1);
    var overdue = tiers(value.overdueHours() == null ? List.of(0) : value.overdueHours(), 0);
    int escalation = value.escalationAfterHours() == null ? 24 : value.escalationAfterHours();
    if (escalation < 0 || escalation > 720) throw new IllegalArgumentException("升级提醒须在逾期0至720小时之间");
    String recipient =
        value.escalationUserId() == null || value.escalationUserId().isBlank()
            ? null
            : value.escalationUserId().strip();
    return new ReminderSettings(
        value.enabled() == null || value.enabled(), lead, overdue, recipient, escalation);
  }

  private static List<Integer> tiers(List<Integer> values, int min) {
    if (values.size() > 5
        || values.stream().anyMatch(v -> v == null || v < min || v > 720)
        || new HashSet<>(values).size() != values.size())
      throw new IllegalArgumentException("每类最多5个不重复提醒级别，临近1至720小时、逾期0至720小时");
    return values.stream().sorted().toList();
  }

  public static List<String> levels(
      ReminderSettings input, OffsetDateTime due, OffsetDateTime now) {
    var p = normalize(input);
    if (!p.enabled() || due == null) return List.of();
    List<String> out = new ArrayList<>();
    long seconds = Duration.between(due.toInstant(), now.toInstant()).getSeconds();
    if (seconds < 0) {
      p.leadHours().stream()
          .filter(h -> -seconds <= h * 3600L)
          .findFirst()
          .ifPresent(h -> out.add("before:" + h));
    } else {
      p.overdueHours().stream()
          .filter(h -> seconds >= h * 3600L)
          .max(Integer::compareTo)
          .ifPresent(h -> out.add("overdue:" + h));
      if (p.escalationUserId() != null && seconds >= p.escalationAfterHours() * 3600L)
        out.add("escalation:" + p.escalationAfterHours());
    }
    return out;
  }

  public static OffsetDateTime due(Milestone p) {
    return p.legalDeadline() != null && (p.dueAt() == null || p.legalDeadline().isBefore(p.dueAt()))
        ? p.legalDeadline()
        : p.dueAt();
  }

  public static String eventId(
      String tenant, Milestone m, long policyVersion, String recipient, String level) {
    String identity =
        tenant
            + ":"
            + m.id()
            + ":"
            + recipient
            + ":"
            + m.version()
            + ":"
            + policyVersion
            + ":"
            + level;
    // Preserve default pre-upgrade notification IDs, so deploying the new receipt table does not
    // resend them.
    if (policyVersion == 0 && (level.equals("before:24") || level.equals("overdue:0")))
      identity =
          tenant
              + ":"
              + m.id()
              + ":"
              + recipient
              + ":"
              + m.version()
              + ":"
              + (level.startsWith("before") ? "upcoming" : "overdue");
    return "agency-plan-alert-"
        + UUID.nameUUIDFromBytes(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
