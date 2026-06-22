package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PlatformEnterpriseReviewQueryPolicyTests {

  @Test
  void supplierReviewStatusOnlyMarksSupplierEnterprisesAsPending() throws Exception {
    String mapper = Files.readString(Path.of(
        "src/main/java/com/procurement/platform/infrastructure/PlatformEnterpriseMapper.java"));

    assertThat(mapper)
        .contains("or (e.type = 'supplier'")
        .contains("coalesce(s.verified_status, 'pending') = 'pending'");
  }
}
