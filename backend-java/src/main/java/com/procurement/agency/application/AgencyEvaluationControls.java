package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyIncidentRecords.*;
import com.procurement.agency.infrastructure.AgencyIncidentMapper;
import java.util.*;
import org.springframework.stereotype.Component;

/**
 * Shared enforcement; callers keep their ordinary project locks, permissions and baseline checks.
 */
@Component
public class AgencyEvaluationControls {
  private final AgencyIncidentMapper data;
  private final AgencyGuard guard;

  public AgencyEvaluationControls(AgencyIncidentMapper data, AgencyGuard guard) {
    this.data = data;
    this.guard = guard;
  }

  public Control control(String round) {
    var c = data.control(guard.tenant(), round);
    return c == null ? new Control(guard.tenant(), round, null, "active", 0, null, null) : c;
  }

  public List<String> writeBlockers(String round) {
    return switch (control(round).state()) {
      case "paused" -> List.of("本轮评审已暂停，仅可读取历史及按权限处理异常");
      case "terminated" -> List.of("本轮评审已停止，只读保留；不能恢复本轮");
      default -> List.of();
    };
  }

  public void requireWritable(String round) {
    var reasons = writeBlockers(round);
    if (!reasons.isEmpty()) throw new IllegalStateException(String.join("；", reasons));
  }

  public List<String> reviewBlockers(String round) {
    List<String> out = new ArrayList<>(writeBlockers(round));
    if (data.incidents(guard.tenant(), round).stream().anyMatch(i -> i.status().equals("open")))
      out.add("本轮存在未处理异常，不能确认价格计算或汇总");
    return out;
  }

  public Map<String, Object> marker(String round) {
    var c = control(round);
    return Map.of("state", c.state(), "version", c.version());
  }
}
