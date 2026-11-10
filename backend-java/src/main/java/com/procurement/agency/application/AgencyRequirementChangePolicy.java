package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRequirementChangeRecords.*;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyRequirementChangePolicy {
  private AgencyRequirementChangePolicy() {}

  private static void text(String s, int max, String name) {
    if (s == null || s.isBlank() || s.length() > max)
      throw new IllegalArgumentException(name + "必填且不得超过" + max + "字");
  }

  public static void create(
      Create d, OffsetDateTime opening, OffsetDateTime latestSource, OffsetDateTime now) {
    if (d == null) throw new IllegalArgumentException("缺少授权变更登记");
    if (!Set.of("technical", "service", "contract").contains(Objects.toString(d.kind(), "")))
      throw new IllegalArgumentException("仅接受技术、服务或合同条款的有据调整；资格条件和评分标准须另行组织，不在此入口修改");
    if (!d.limitsReviewed() || !d.publicContentReviewed() || !d.adequateTimeReviewed())
      throw new IllegalArgumentException("须人工核对允许范围、共同内容脱敏及响应准备时间");
    text(d.locator(), 2000, "原文定位");
    text(d.beforeText(), 8000, "变更前内容");
    text(d.afterText(), 8000, "变更后内容");
    if (d.beforeText().trim().equals(d.afterText().trim()))
      throw new IllegalArgumentException("变更前后内容不得相同");
    text(d.authorityName(), 200, "外部确认人");
    text(d.authorityRole(), 500, "确认人身份");
    text(d.authorityScope(), 2000, "授权范围与来源");
    text(d.channel(), 500, "统一线下通知方式");
    text(d.reason(), 2000, "登记依据");
    if (d.authorizedAt() == null
        || d.sentAt() == null
        || d.responseDeadlineAt() == null
        || d.authorizedAt().isBefore(opening)
        || d.authorizedAt().isBefore(latestSource)
        || d.authorizedAt().isAfter(now)
        || d.sentAt().isBefore(d.authorizedAt())
        || d.sentAt().isAfter(now)
        || !d.responseDeadlineAt().isAfter(d.sentAt()))
      throw new IllegalArgumentException("授权不得早于来源沟通结束，通知不得早于授权或晚于当前时间，响应截止须晚于通知");
  }

  public static void receipt(Register d, Snapshot s, OffsetDateTime now) {
    if (d == null || !d.contentChecked()) throw new IllegalArgumentException("须逐家核对同一冻结通知内容和送达对象");
    text(d.recipient(), 500, "实际接收人及身份来源");
    text(d.note(), 2000, "送达核对说明");
    if (d.receivedAt() == null
        || d.receivedAt().isBefore(s.content().sentAt())
        || d.receivedAt().isAfter(now)
        || !d.receivedAt().isBefore(s.content().responseDeadlineAt()))
      throw new IllegalArgumentException("接收须在通知发出后、当前时间前且早于响应截止");
  }

  public static void finalWindow(
      OffsetDateTime initiated,
      OffsetDateTime cutoff,
      OffsetDateTime effective,
      OffsetDateTime requiredDeadline) {
    if (initiated.isBefore(effective) || cutoff.isBefore(requiredDeadline))
      throw new IllegalArgumentException("最后报价发起不得早于全部通知送达，截止不得早于已确认的响应准备截止");
  }
}
