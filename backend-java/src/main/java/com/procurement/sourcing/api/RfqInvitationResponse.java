package com.procurement.sourcing.api;

import java.time.OffsetDateTime;

public record RfqInvitationResponse(
    String supplierId, String inviteStatus, OffsetDateTime viewedAt, String declineReason) {
}
