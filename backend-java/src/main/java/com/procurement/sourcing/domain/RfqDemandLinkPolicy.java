package com.procurement.sourcing.domain;

public final class RfqDemandLinkPolicy {
  private RfqDemandLinkPolicy() {}

  public static void requireUnlinkedDemand(int existingRfqLinkCount, String demandId) {
    if (existingRfqLinkCount > 0) {
      throw new IllegalStateException("Purchase demand already linked to an RFQ: " + demandId);
    }
  }
}
