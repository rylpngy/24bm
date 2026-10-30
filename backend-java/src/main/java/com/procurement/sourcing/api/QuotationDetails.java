package com.procurement.sourcing.api;

import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

public record QuotationDetails(@Size(max=40) String invoiceType, @Size(max=2000) String remark,
    @Size(max=10) List<String> attachmentIds, @Valid @Size(max=500) List<TechnicalLine> lines) {
  public record TechnicalLine(String demandItemId, @Size(max=200) String brand, @Size(max=200) String model,
      @Size(max=4000) String technicalParameters, @Size(max=4000) String technicalResponse, @Size(max=2000) String remark) {}
}
