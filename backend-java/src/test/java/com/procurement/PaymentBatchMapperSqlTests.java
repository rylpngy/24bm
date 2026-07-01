package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PaymentBatchMapperSqlTests {
  private static final Path MAPPER_SOURCE = Path.of(
      "src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java");

  @Test
  void paymentBatchListDataScopeFollowsRequestOrderRfqDemandDepartmentChain() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("from payment_requests scope_pr")
        .contains("join purchase_orders po")
        .contains("po.id = scope_pr.order_id")
        .contains("join rfqs rfq")
        .contains("rfq.id = po.rfq_id")
        .contains("join rfq_demands rd")
        .contains("rd.rfq_id = rfq.id")
        .contains("join purchase_demands pd")
        .contains("pd.id = rd.demand_id")
        .contains("pd.department_id in")
        .contains("rfq.owner_id = #{requesterId}");
  }
}
