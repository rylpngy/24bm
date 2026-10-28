package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.mall.domain.PhysicalAfterSalesPolicy;
import org.junit.jupiter.api.Test;

class PhysicalAfterSalesPolicyTests {
  @Test
  void rolesAndSequentialEvidenceCannotBeBypassed() {
    assertThat(PhysicalAfterSalesPolicy.actions("退货", "待处理", "", false)).isEmpty();
    assertThat(PhysicalAfterSalesPolicy.actions("退货", "处理中", "", false))
        .containsExactly("return_dispatch");
    assertThat(PhysicalAfterSalesPolicy.actions("退货", "处理中", "", true)).isEmpty();
    assertThat(PhysicalAfterSalesPolicy.actions("换货", "处理中", "return_dispatch", true))
        .containsExactly("return_receipt");
    assertThat(PhysicalAfterSalesPolicy.actions("换货", "处理中", "replacement_dispatch", false))
        .containsExactly("inspection_pass", "inspection_fail");
    assertThat(PhysicalAfterSalesPolicy.ready("换货", "return_receipt")).isFalse();
    assertThat(PhysicalAfterSalesPolicy.ready("退货", "return_receipt")).isTrue();
    assertThat(PhysicalAfterSalesPolicy.ready("换货", "inspection_pass")).isTrue();
  }

  @Test
  void failedReplacementMustReturnAgainAndHistoricalCompletionDoesNotFabricateProof() {
    assertThat(PhysicalAfterSalesPolicy.actions("换货", "处理中", "inspection_fail", false))
        .containsExactly("return_dispatch");
    assertThat(PhysicalAfterSalesPolicy.actions("换货", "处理中", "inspection_fail", true)).isEmpty();
    assertThat(PhysicalAfterSalesPolicy.ready("换货", "")).isFalse();
    assertThat(PhysicalAfterSalesPolicy.actions("退货", "已完成", "", false))
        .containsExactly("return_dispatch");
    for (String status : java.util.List.of("已拒绝", "已撤回", "待买方确认"))
      assertThat(PhysicalAfterSalesPolicy.actions("退货", status, "", false)).isEmpty();
  }
}
