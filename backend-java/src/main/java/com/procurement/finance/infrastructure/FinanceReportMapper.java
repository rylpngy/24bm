package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.FinanceOrderSummary;
import com.procurement.identity.domain.DataScope;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FinanceReportMapper {
  @Select("""
      <script>select coalesce(status, '') as status, count(*) as order_count,
      coalesce(sum(amount), 0) as amount from purchase_orders
      where tenant_id = #{tenantId} and id in (
      """ + FinanceScopeSql.ORDERS + ") group by status order by status</script>")
  List<FinanceOrderSummary> summarizeOrders(@Param("tenantId") String tenantId, @Param("scope") DataScope scope);
}
