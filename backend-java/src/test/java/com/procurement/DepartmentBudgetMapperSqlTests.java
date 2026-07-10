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
  void disbursedFollowsPaidMilestoneContractOrderRfqDemandDepartmentChain() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("select sum(m.amount) from contract_payment_milestones m")
        .contains("join contracts c on c.id = m.contract_id")
        .contains("join purchase_orders po on po.id = c.related_order_id")
        .contains("join rfq_demands rd on rd.rfq_id = po.rfq_id")
        .contains("join purchase_demands pd on pd.id = rd.demand_id")
        .contains("m.status = '已付'")
        .contains("pd.department_id = b.department_id")
        .contains("to_char(pd.created_at, 'YYYY') = b.period")
        .contains("as disbursed");
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
