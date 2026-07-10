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

    // 多步审核:待办队列含 pending 与 preliminary(初审通过/待复审)两个可处理阶段。
    assertThat(mapper)
        .contains("or (e.type = 'supplier'")
        .contains("coalesce(s.verified_status, 'pending') in ('pending', 'preliminary')");
  }
}
