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
    assertThat(source).contains("FinanceScopeSql.BATCHES");
    String scope = Files.readString(Path.of(
        "src/main/java/com/procurement/finance/infrastructure/FinanceScopeSql.java"));
    assertThat(scope)
        .contains("from payment_requests scope_pr")
        .contains("scope_pr.order_id not in")
        .contains("ProcurementScopeSql.ORDERS")
        .contains("and not exists");
    String records = Files.readString(Path.of(
        "src/main/java/com/procurement/common/data/ProcurementScopeSql.java"));
    assertThat(records)
        .contains("from purchase_orders scope_po")
        .contains("scope_po.rfq_id in")
        .contains("rd.rfq_id = r.id")
        .contains("d.id = rd.demand_id")
        .contains("d.department_id not in")
        .contains("r.owner_id = #{scope.requesterId}")
        .contains("and not exists")
        .contains("<otherwise>and false</otherwise>");
  }

  @Test
  void paymentRequestAggregationCannotSkipBatchApproval() throws IOException {
    String source = Files.readString(MAPPER_SOURCE);

    assertThat(source)
        .contains("then '待提交审批'")
        .contains("then '付款申请审批中'")
        .contains("then '付款申请未通过'")
        .contains("payment_batches.batch_status in ('审批中', '可安排付款', '已付款归档')")
        .doesNotContain("then '可安排付款'\n          when sum(case when pr.request_status = '付款申请审批中'");
  }
}
