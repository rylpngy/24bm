package com.procurement.supplier.application;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.supplier.qualification-reminders.enabled", havingValue = "true")
public class QualificationReminderScheduler {
  private final QualificationNotificationService notifications;

  public QualificationReminderScheduler(QualificationNotificationService notifications) {
    this.notifications = notifications;
  }

  @Scheduled(cron = "${app.supplier.qualification-reminders.cron:0 0 9 * * *}", zone = "Asia/Shanghai")
  public void remind() {
    notifications.remindExpiry(LocalDate.now(ZoneId.of("Asia/Shanghai")));
  }
}
