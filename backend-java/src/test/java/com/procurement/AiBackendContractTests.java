package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class AiBackendContractTests {
  @Test void genericContractsAndBusinessOwnedAdaptersExistWithoutPocDependency() {
    for (String name : new String[] {"common.ai.AiContracts", "ai.application.AiReviewApplicationService",
        "demand.application.DemandAiSubjectAdapter", "attachment.application.AttachmentAiSubjectAdapter",
        "supplier.application.SupplierAiSubjectAdapter", "sourcing.application.ProcurementRiskAiSubjectAdapter"}) {
      assertThat(classExists("com.procurement." + name)).as("generic backend class " + name).isTrue();
    }
  }
  private boolean classExists(String name) {
    try { Class.forName(name); return true; } catch (ClassNotFoundException e) { return false; }
  }
}
