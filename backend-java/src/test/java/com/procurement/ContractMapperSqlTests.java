package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ContractMapperSqlTests {
  private static final Path MAPPER_SOURCE = Path.of(
      "src/main/java/com/procurement/contract/infrastructure/ContractMapper.java");

  @Test
  void contractListDataScopeFollowsOrderRfqDemandDepartmentChain() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("from purchase_orders po")
        .contains("join rfqs rfq on rfq.tenant_id = po.tenant_id and rfq.id = po.rfq_id")
        .contains("join rfq_demands rd on rd.tenant_id = rfq.tenant_id and rd.rfq_id = rfq.id")
        .contains("join purchase_demands pd on pd.tenant_id = rd.tenant_id and pd.id = rd.demand_id")
        .contains("pd.department_id in")
        .contains("rfq.owner_id = #{requesterId}");
  }
}
