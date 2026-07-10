package com.procurement.notification.infrastructure;

import com.procurement.notification.domain.NotificationDelivery;
import com.procurement.notification.domain.TenantNotificationSettings;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface NotificationChannelMapper {

  @Select("""
      select tenant_id, email_enabled, email_recipient, webhook_enabled, webhook_url
      from tenant_notification_settings
      where tenant_id = #{tenantId}
      """)
  TenantNotificationSettings findSettings(@Param("tenantId") String tenantId);

  @Insert("""
      insert into tenant_notification_settings
        (tenant_id, email_enabled, email_recipient, webhook_enabled, webhook_url, updated_at)
      values
        (#{tenantId}, #{emailEnabled}, #{emailRecipient,jdbcType=VARCHAR}, #{webhookEnabled},
         #{webhookUrl,jdbcType=VARCHAR}, now())
      on conflict (tenant_id) do update
        set email_enabled = excluded.email_enabled,
            email_recipient = excluded.email_recipient,
            webhook_enabled = excluded.webhook_enabled,
            webhook_url = excluded.webhook_url,
            updated_at = now()
      """)
  void upsertSettings(
      @Param("tenantId") String tenantId,
      @Param("emailEnabled") boolean emailEnabled,
      @Param("emailRecipient") String emailRecipient,
      @Param("webhookEnabled") boolean webhookEnabled,
      @Param("webhookUrl") String webhookUrl);

  @Insert("""
      insert into notification_deliveries
        (id, tenant_id, channel, target, title, content, status, detail)
      values
        (#{id}, #{tenantId}, #{channel}, #{target,jdbcType=VARCHAR}, #{title}, #{content},
         #{status}, #{detail,jdbcType=VARCHAR})
      """)
  void insertDelivery(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("channel") String channel,
      @Param("target") String target,
      @Param("title") String title,
      @Param("content") String content,
      @Param("status") String status,
      @Param("detail") String detail);

  @Select("""
      select id, tenant_id, channel, target, title, content, status, detail, dispatched_at
      from notification_deliveries
      where tenant_id = #{tenantId}
      order by dispatched_at desc
      limit 30
      """)
  List<NotificationDelivery> listDeliveries(@Param("tenantId") String tenantId);
}
