package com.procurement.notification.api;

public record NotificationSettingsResponse(
    boolean emailEnabled,
    String emailRecipient,
    boolean webhookEnabled,
    String webhookUrl) {
}
