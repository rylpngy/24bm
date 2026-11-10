package com.procurement.notification.application;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
@Service
public class NotificationDeliveryQuery {
 private final NotificationMapper mapper;
 public NotificationDeliveryQuery(NotificationMapper mapper){this.mapper=mapper;}
 public record Receipt(OffsetDateTime storedAt,OffsetDateTime readAt) {}
 public Receipt receipt(String recipient,String id){var n=mapper.findByTenantRecipientAndId(TenantAccessGuard.requireTenantId("notification delivery"),recipient,id);return n==null?null:new Receipt(n.createdAt(),n.readAt());}
}
