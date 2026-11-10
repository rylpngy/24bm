package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyQuoteService;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class AgencyQuoteAmountTests {
  @Test
  void preservesZeroAndExactDecimalBoundary() {
    assertDoesNotThrow(() -> AgencyQuoteService.amount(new BigDecimal("0.00")));
    assertDoesNotThrow(() -> AgencyQuoteService.amount(new BigDecimal("999999999999999999.99")));
  }

  @Test
  void rejectsMissingNegativeOverprecisionAndOverflow() {
    assertThrows(IllegalArgumentException.class, () -> AgencyQuoteService.amount(null));
    for (String value : java.util.List.of("-0.01", "0.001", "1000000000000000000.00"))
      assertThrows(
          IllegalArgumentException.class, () -> AgencyQuoteService.amount(new BigDecimal(value)));
  }
}
