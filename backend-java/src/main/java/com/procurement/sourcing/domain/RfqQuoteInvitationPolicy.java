package com.procurement.sourcing.domain;

public final class RfqQuoteInvitationPolicy {
  private RfqQuoteInvitationPolicy() {}

  public static void requireInvitedSupplier(int inviteCount, String rfqId) {
    if (inviteCount == 0) {
      throw new IllegalStateException("Supplier is not invited to RFQ: " + rfqId);
    }
  }
}
