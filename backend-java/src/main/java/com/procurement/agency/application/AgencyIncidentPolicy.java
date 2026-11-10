package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyIncidentRecords.*;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyIncidentPolicy {
  private AgencyIncidentPolicy() {}

  public static final Set<String> KINDS =
      Set.of(
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
          "reorganization",
          "other");

  public static void create(Create d, OffsetDateTime now) {
    if (d == null
        || !d.reviewed()
        || !KINDS.contains(Objects.toString(d.kind(), ""))
        || !Set.of("observe", "pause").contains(Objects.toString(d.effect(), "")))
      throw new IllegalArgumentException("须核对异常类型、影响及明确的登记/暂停决定");
    if (d.occurredAt() == null || d.occurredAt().isAfter(now))
      throw new IllegalArgumentException("须记录不晚于当前时间的真实发生时间");
  }

  public static void resolution(Incident i, Resolution d, OffsetDateTime now) {
    if (d == null
        || !d.conditionsChecked()
        || !Set.of("continue_ready", "reorganize", "end_round")
            .contains(Objects.toString(d.outcome(), "")))
      throw new IllegalArgumentException("须核对恢复条件并明确继续条件已满足、另行组织或停止本轮的处理结果");
    if (d.handledAt() == null
        || d.handledAt().isBefore(i.occurredAt())
        || d.handledAt().isAfter(now)) throw new IllegalArgumentException("实际处理时间须在异常发生之后且不晚于当前时间");
  }

  public static void transition(Control c, List<Incident> incidents, String action) {
    if (!Set.of("pause", "resume", "terminate").contains(Objects.toString(action, "")))
      throw new IllegalArgumentException("不支持的轮次控制操作");
    if (c.state().equals("terminated")) throw new IllegalStateException("本轮已停止，不能恢复或覆盖停止记录");
    if (action.equals("pause")
        && (!c.state().equals("active")
            || incidents.stream().noneMatch(i -> i.status().equals("open"))))
      throw new IllegalStateException("仅有未处理异常的进行中轮次可单独暂停");
    if (action.equals("resume")
        && (!c.state().equals("paused")
            || incidents.stream().anyMatch(i -> i.status().equals("open"))))
      throw new IllegalStateException("只有已暂停且全部异常已处理的轮次可申请恢复");
  }
}
