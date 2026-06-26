package com.procurement.notification.api;

public record UpdateNotificationSettingsRequest(
    boolean emailEnabled,
    String emailRecipient,
    boolean webhookEnabled,
    String webhookUrl) {
}
