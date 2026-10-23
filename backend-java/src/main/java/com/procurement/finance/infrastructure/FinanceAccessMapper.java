package com.procurement.finance.infrastructure;

import com.procurement.identity.domain.DataScope;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FinanceAccessMapper {
  @Select("<script>select exists(select 1 from (" + FinanceScopeSql.INVOICES
      + ") visible where visible.id = #{id})</script>")
  boolean canAccessInvoice(@Param("tenantId") String tenantId, @Param("id") String id,
      @Param("scope") DataScope scope);

  @Select("<script>select exists(select 1 from (" + FinanceScopeSql.BATCHES
      + ") visible where visible.payment_batch_no = #{batchNo})</script>")
  boolean canAccessBatch(@Param("tenantId") String tenantId, @Param("batchNo") String batchNo,
      @Param("scope") DataScope scope);
}
