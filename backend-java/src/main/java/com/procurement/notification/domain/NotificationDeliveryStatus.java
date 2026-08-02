package com.procurement.notification.domain;

/**
 * 投递状态(E-2):对外如实反映真实结果,不以「已发送」掩盖未配置或失败。
 * - 成功:通道确认接收(邮件已交付 SMTP / Webhook 返回 2xx);
 * - 失败:通道报错,可重试;
 * - 未配置:渠道已启用但缺少必要配置(如无 SMTP 主机),需管理员补齐;
 * - 已记录:站内信入库即达。
 */
public final class NotificationDeliveryStatus {

  public static final String SUCCESS = "成功";
  public static final String FAILED = "失败";
  public static final String NOT_CONFIGURED = "未配置";
  public static final String RECORDED = "已记录";

  private NotificationDeliveryStatus() {}

  public static boolean retryable(String status) {
    return FAILED.equals(status) || NOT_CONFIGURED.equals(status);
  }
}
