package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DepartmentBudgetMapperSqlTests {
  private static final Path MAPPER_SOURCE = Path.of(
      "src/main/java/com/procurement/buyer/infrastructure/DepartmentBudgetMapper.java");

  @Test
  void disbursedUsesOnlySignedPaymentLedgerAndBudgetAllocation() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("from invoice_payment_entries pe")
        .contains("sum(pe.amount)")
        .contains("pending_allocation_amount")
        .contains("as disbursed")
        .doesNotContain("contract_payment_milestones");
  }

  @Test
  void committedAndPendingAggregateByDemandStatusWithinPeriod() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("pd.status = '已通过'")
        .contains("pd.status = '审批中'")
        .contains("as committed")
        .contains("as pending");
  }
}
