package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.notification.application.EmailDispatcher;
import com.procurement.notification.domain.NotificationDeliveryStatus;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

// 通知投递真实化(E-2):未配置不谎报成功、失败可重试、异常如实记录。
class NotificationDeliveryStatusTests {

  private final JavaMailSender neverCalled = org.mockito.Mockito.mock(JavaMailSender.class);

  @SuppressWarnings("unchecked")
  private static org.springframework.beans.factory.ObjectProvider<JavaMailSender> provider(JavaMailSender sender) {
    org.springframework.beans.factory.ObjectProvider<JavaMailSender> p =
        org.mockito.Mockito.mock(org.springframework.beans.factory.ObjectProvider.class);
    org.mockito.Mockito.when(p.getIfAvailable()).thenReturn(sender);
    return p;
  }

  @Test
  void retryableOnlyForFailedOrNotConfigured() {
    assertThat(NotificationDeliveryStatus.retryable(NotificationDeliveryStatus.FAILED)).isTrue();
    assertThat(NotificationDeliveryStatus.retryable(NotificationDeliveryStatus.NOT_CONFIGURED)).isTrue();
    assertThat(NotificationDeliveryStatus.retryable(NotificationDeliveryStatus.SUCCESS)).isFalse();
    assertThat(NotificationDeliveryStatus.retryable(NotificationDeliveryStatus.RECORDED)).isFalse();
  }

  @Test
  void missingSmtpHostReportsNotConfiguredInsteadOfSuccess() {
    EmailDispatcher dispatcher = new EmailDispatcher(provider(neverCalled), "", "no-reply@24bid.local");
    assertThat(dispatcher.configured()).isFalse();
    EmailDispatcher.Result result = dispatcher.send("ops@example.com", "标题", "正文");
    assertThat(result.status()).isEqualTo(NotificationDeliveryStatus.NOT_CONFIGURED);
    assertThat(result.detail()).contains("未配置 SMTP");
    // 未配置时绝不触碰邮件发送器
    org.mockito.Mockito.verifyNoInteractions(neverCalled);
  }

  @Test
  void smtpFailureRecordedAsFailedWithError() {
    JavaMailSender failing = org.mockito.Mockito.mock(JavaMailSender.class);
    org.mockito.Mockito.doThrow(new MailSendException("connection refused"))
        .when(failing).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
    EmailDispatcher dispatcher = new EmailDispatcher(provider(failing), "smtp.example.com", "no-reply@24bid.local");
    EmailDispatcher.Result result = dispatcher.send("ops@example.com", "标题", "正文");
    assertThat(result.status()).isEqualTo(NotificationDeliveryStatus.FAILED);
    assertThat(result.error()).contains("MailSendException");
  }

  @Test
  void configuredSmtpSendsAndReportsSuccess() {
    JavaMailSender ok = org.mockito.Mockito.mock(JavaMailSender.class);
    EmailDispatcher dispatcher = new EmailDispatcher(provider(ok), "smtp.example.com", "no-reply@24bid.local");
    EmailDispatcher.Result result = dispatcher.send("ops@example.com", "标题", "正文");
    assertThat(result.status()).isEqualTo(NotificationDeliveryStatus.SUCCESS);
    org.mockito.Mockito.verify(ok).send(org.mockito.ArgumentMatchers.any(SimpleMailMessage.class));
  }
}
