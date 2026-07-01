package com.procurement.notification.domain;

public final class NotificationRecipientStatus {
  // 收件人启用态 = 账号在用态(buyer/supplier users.status 均为 'active'),
  // 历史上误用中文「启用」导致过滤恒为空、买方通知从不投递;对齐为 'active'。
  public static final String ENABLED = "active";

  private NotificationRecipientStatus() {}
}
