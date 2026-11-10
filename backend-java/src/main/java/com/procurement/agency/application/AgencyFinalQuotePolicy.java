package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyFinalQuoteRecords.*;
import java.time.OffsetDateTime;
import java.util.*;

/** Checks the recorded offline process; never infers a supplier's identity or fallback price. */
public final class AgencyFinalQuotePolicy {
  private AgencyFinalQuotePolicy() {}

  public static void method(String method) {
    if (!Set.of("竞争性谈判", "竞争性磋商").contains(Objects.toString(method, "")))
      throw new IllegalStateException("仅谈判和磋商可登记最后报价，其他方式不得借此议价");
  }

  public static void window(OffsetDateTime initiated, OffsetDateTime cutoff, OffsetDateTime now) {
    if (initiated == null || cutoff == null || initiated.isAfter(now) || !cutoff.isAfter(initiated))
      throw new IllegalArgumentException("须记录真实发起时间和晚于发起时间的截止时间");
  }

  public static void afterOpening(OffsetDateTime initiated, OffsetDateTime opened) {
    if (initiated == null || opened == null || initiated.isBefore(opened))
      throw new IllegalArgumentException("最后报价发起时间不得早于本任务实际开启时间");
  }

  public static void received(Campaign c, Receive d, OffsetDateTime now) {
    if (d.receivedAt() == null
        || d.receivedAt().isBefore(c.initiatedAt())
        || d.receivedAt().isAfter(now)) throw new IllegalArgumentException("实际接收时间须在发起之后且不晚于当前时间");
    if (now.isAfter(c.cutoffAt()) && (d.lateEntryReason() == null || d.lateEntryReason().isBlank()))
      throw new IllegalArgumentException("截止后登记须提供真实接收时点及补录依据");
  }

  public static void decision(Decision d, Receipt r, Campaign campaign) {
    if (d == null
        || !Set.of("accepted", "not_submitted", "late", "excluded")
            .contains(Objects.toString(d.status(), "")))
      throw new IllegalArgumentException("须逐家确认最后报价或缺失、逾期、排除处理");
    boolean active = r != null && r.status().equals("received");
    if (d.status().equals("not_submitted")) {
      if (active || d.receiptId() != null && !d.receiptId().isBlank())
        throw new IllegalArgumentException("存在有效接收登记，不能标记未提交");
    } else if (d.status().equals("accepted") || d.status().equals("late")) {
      if (!active || !Objects.equals(d.receiptId(), r.id()))
        throw new IllegalArgumentException("须引用本对象当前接收登记");
      boolean late = r.receivedAt().isAfter(campaign.cutoffAt());
      if (d.status().equals("accepted") && late || d.status().equals("late") && !late)
        throw new IllegalArgumentException("逾期材料不能确认有效，按时材料不能标记逾期");
    } else if (!Objects.equals(d.receiptId(), r == null ? null : r.id()))
      throw new IllegalArgumentException("排除处理须引用当前接收登记；无登记时保持空值");
    if (d.reason() == null || d.reason().isBlank() || d.reason().length() > 2000)
      throw new IllegalArgumentException("须逐家填写有依据的确认或异常处理说明");
  }
}
