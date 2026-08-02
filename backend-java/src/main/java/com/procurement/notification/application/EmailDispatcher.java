package com.procurement.notification.application;

import com.procurement.notification.domain.NotificationDeliveryStatus;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * 邮件投递(E-2):真实经 SMTP 发送。
 * 未配置 spring.mail.host 时 Spring 不会创建 JavaMailSender,此处以可选注入承接,
 * 并**如实返回「未配置」而非谎报已发送**。
 */
@Component
public class EmailDispatcher {

  private final ObjectProvider<JavaMailSender> mailSenderProvider;
  private final String mailHost;
  private final String from;

  public EmailDispatcher(
      ObjectProvider<JavaMailSender> mailSenderProvider,
      @Value("${spring.mail.host:}") String mailHost,
      @Value("${app.notification.mail-from:no-reply@24bid.local}") String from) {
    this.mailSenderProvider = mailSenderProvider;
    this.mailHost = mailHost;
    this.from = from;
  }

  public boolean configured() {
    return mailHost != null && !mailHost.isBlank() && mailSenderProvider.getIfAvailable() != null;
  }

  /** 返回投递结果:状态 + 明细(失败时含错误)。 */
  public Result send(String recipient, String title, String content) {
    JavaMailSender sender = mailSenderProvider.getIfAvailable();
    if (mailHost == null || mailHost.isBlank() || sender == null) {
      return new Result(
          NotificationDeliveryStatus.NOT_CONFIGURED,
          "未配置 SMTP(spring.mail.host),邮件未发出",
          null);
    }
    try {
      SimpleMailMessage message = new SimpleMailMessage();
      message.setFrom(from);
      message.setTo(recipient);
      message.setSubject(title);
      message.setText(content);
      sender.send(message);
      return new Result(NotificationDeliveryStatus.SUCCESS, "已投递至 " + mailHost, null);
    } catch (Exception exception) {
      String error = exception.getClass().getSimpleName()
          + (exception.getMessage() == null ? "" : ": " + exception.getMessage());
      return new Result(NotificationDeliveryStatus.FAILED, "SMTP 投递失败", error);
    }
  }

  public record Result(String status, String detail, String error) {}
}
