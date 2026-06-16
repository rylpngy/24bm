package com.procurement.sourcing.domain;

public final class RfqQuoteSubmissionPolicy {
  private RfqQuoteSubmissionPolicy() {}

  public static void requireNoSubmittedQuote(int submittedQuoteCount, String rfqId) {
    if (submittedQuoteCount > 0) {
      throw new IllegalStateException("Supplier has already submitted a quote: " + rfqId);
    }
  }
}
