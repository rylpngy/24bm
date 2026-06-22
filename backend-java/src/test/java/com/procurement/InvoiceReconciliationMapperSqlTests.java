package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class InvoiceReconciliationMapperSqlTests {
  private static final Path MAPPER_SOURCE = Path.of(
      "src/main/java/com/procurement/finance/infrastructure/InvoiceReconciliationMapper.java");

  @Test
  void reconciliationFiltersUseDynamicSqlInsteadOfNullParameterTypeChecks() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("<if test=\"stage != null\">")
        .contains("<if test=\"supplierId != null\">")
        .contains("<if test=\"orderId != null\">")
        .doesNotContain("#{stage} is null")
        .doesNotContain("#{supplierId} is null")
        .doesNotContain("#{orderId} is null");
  }
}
