package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

public record RfqInvitation(
    String supplierId, String inviteStatus, OffsetDateTime viewedAt, String declineReason) {
}
