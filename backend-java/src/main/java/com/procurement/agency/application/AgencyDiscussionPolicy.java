package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyDiscussionRecords.Content;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyDiscussionPolicy {
  private AgencyDiscussionPolicy() {}

  public static void method(String method) {
    if (!Set.of("竞争性谈判", "竞争性磋商").contains(Objects.toString(method, "")))
      throw new IllegalStateException("逐家谈判/磋商记录仅适用于谈判及磋商，不用于招标议价或询价多轮竞价");
  }

  public static void validate(
      Content d,
      Set<String> frozenMembers,
      OffsetDateTime openedAt,
      OffsetDateTime now,
      boolean complete) {
    if (d == null) throw new IllegalArgumentException("缺少逐家沟通内容");
    if (complete && (d.startedAt() == null || d.endedAt() == null))
      throw new IllegalArgumentException("确认前须记录真实沟通起止时间");
    for (var at : Arrays.asList(d.startedAt(), d.endedAt()))
      if (at != null && (at.isAfter(now) || at.isBefore(openedAt)))
        throw new IllegalArgumentException("沟通时点须在实际材料开启之后且不晚于当前时间");
    if (d.startedAt() != null && d.endedAt() != null && d.endedAt().isBefore(d.startedAt()))
      throw new IllegalArgumentException("沟通结束不得早于开始");
    if (d.staffUserIds() != null
        && (d.staffUserIds().size() > 30
            || new HashSet<>(d.staffUserIds()).size() != d.staffUserIds().size()
            || !frozenMembers.containsAll(d.staffUserIds())))
      throw new IllegalArgumentException("沟通参与账号须为本轮冻结人员，不能重复或冒用其他项目人员");
    if (complete && (d.staffUserIds() == null || d.staffUserIds().isEmpty()))
      throw new IllegalArgumentException("须记录实际参与的冻结工作人员");
    if (d.changeDisposition() != null
        && !d.changeDisposition().isBlank()
        && !Set.of("none", "requires_authorized_change").contains(d.changeDisposition()))
      throw new IllegalArgumentException("只记录无需求调整或待有权确认，不得在沟通记录中直接批准变更");
    text(d.supplierAttendees(), 2000, complete, "供应商实际出席人员及身份来源");
    text(d.agenda(), 2000, complete, "议题");
    text(d.discussion(), 8000, complete, "逐家沟通记录");
    text(d.supplierResponse(), 4000, complete, "供应商回应");
    text(d.conclusion(), 4000, complete, "本次结论");
    text(d.changeDisposition(), 80, complete, "需求调整标记");
    text(
        d.changeNote(),
        2000,
        complete && "requires_authorized_change".equals(d.changeDisposition()),
        "待确认调整事项");
    text(d.evidenceVersionId(), 150, complete, "脱敏过程凭证版本");
  }

  private static void text(String v, int max, boolean required, String label) {
    if (required && (v == null || v.isBlank()) || v != null && v.length() > max)
      throw new IllegalArgumentException(label + "缺失或过长");
  }

  public static void chronology(Content previous, Content next) {
    if (previous != null && next.startedAt().isBefore(previous.endedAt()))
      throw new IllegalArgumentException("后续沟通不得早于本对象前次确认沟通结束；补正须保留旧记录并按异常程序处理");
  }
}
