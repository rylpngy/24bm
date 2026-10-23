package com.procurement.supplier.infrastructure;

import com.procurement.finance.infrastructure.FinanceScopeSql;
import com.procurement.identity.domain.DataScope;
import com.procurement.supplier.api.SupplierExitItem;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface SupplierExitItemsMapper {
  String VISIBLE = "<script><![CDATA[" + SupplierExitRiskSql.CTE + "]]>, visible as ("
      + "<choose><when test=\"kind == 'uninvoiced'\">" + """
        select o.id, o.id as order_id, null::text as invoice_id, '订单 ' || o.id as label,
          o.status, o.amount, o.invoiced_amount, null::numeric as paid_amount,
          case when o.amount &gt;= 0 and o.invoiced_amount &gt;= 0
            then o.amount - o.invoiced_amount else null end as remaining_amount,
          case when o.amount &lt; 0 then '订单金额异常，需核实订单金额'
            when o.invoiced_amount &lt; 0 then '发票覆盖金额异常，需核实开票记录'
            when o.invoiced_amount = 0 then '尚无发票金额覆盖订单，需处理开票'
            else '开票金额覆盖不足，需核实订单与发票金额' end as reason,
          '采购处理岗位'::text as handler_label
        from uninvoiced o where o.id in (
        """ + FinanceScopeSql.ORDERS + ")</when><otherwise>" + """
        select i.id, i.order_id, i.id as invoice_id, '发票 ' || coalesce(nullif(i.invoice_no, ''), i.id) as label,
          i.payment_status as status, i.amount, null::numeric as invoiced_amount,
          null::numeric as paid_amount, null::numeric as remaining_amount, i.reason,
          '财务处理岗位'::text as handler_label
        from checked i where i.verification and i.supplier_id = #{supplierId} and i.id in (
        """ + FinanceScopeSql.INVOICES + ")</otherwise></choose>) ";

  @Select(VISIBLE + "select count(*) from visible</script>")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  long count(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId,
      @Param("kind") String kind, @Param("scope") DataScope scope);

  @Select(VISIBLE + "select * from visible order by id limit #{limit} offset #{offset}</script>")
  List<SupplierExitItem> list(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId,
      @Param("kind") String kind, @Param("scope") DataScope scope,
      @Param("limit") int limit, @Param("offset") long offset);
}
