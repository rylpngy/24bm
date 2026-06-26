package com.procurement.notification.domain;

public record TenantNotificationSettings(
    String tenantId,
    boolean emailEnabled,
    String emailRecipient,
    boolean webhookEnabled,
    String webhookUrl) {
}
