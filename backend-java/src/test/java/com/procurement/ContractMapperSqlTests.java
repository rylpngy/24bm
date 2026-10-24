package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.common.data.ProcurementScopeSql;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.domain.DataScope;
import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

class ContractMapperSqlTests {
  @Test
  void contractListWritesAndAttachmentsReuseWholeOrderVisibility() throws Exception {
    var methods = new java.lang.reflect.Method[] {
        ContractMapper.class.getMethod("canAccessContractInScope", String.class, String.class, DataScope.class),
        ContractMapper.class.getMethod("canAccessOrderInScope", String.class, String.class, DataScope.class),
        ContractMapper.class.getMethod("listVisible", String.class, String.class, String.class, String.class, DataScope.class)
    };
    for (var method : methods) {
      assertThat(String.join(" ", method.getAnnotation(Select.class).value()))
          .as(method.getName()).contains(ProcurementScopeSql.RFQS).contains("po.tenant_id=#{tenantId}");
    }
  }

  @Test void emptyOrConflictingLegacyScopesNeverBecomeUnrestricted() {
    assertThat(ContractMapper.recordScope(java.util.List.of(), null).blocksAll()).isTrue();
    assertThat(ContractMapper.recordScope(java.util.List.of("A"), "owner").blocksAll()).isTrue();
  }
}
