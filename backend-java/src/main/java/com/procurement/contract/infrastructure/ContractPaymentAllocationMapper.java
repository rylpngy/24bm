package com.procurement.contract.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ContractPaymentAllocationMapper {
  record OrderBasis(BigDecimal amount,BigDecimal previousPaid,boolean verified) {}
  @Select("""
      select o.amount,
        coalesce((select sum(e.amount) from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id
          where i.tenant_id=o.tenant_id and i.order_id=o.id and (#{entry,jdbcType=VARCHAR}::text is null or e.id<>#{entry,jdbcType=VARCHAR})),0) previous_paid,
        not exists(select 1 from invoices i cross join lateral(select
          coalesce(sum(e.amount) filter(where #{entry,jdbcType=VARCHAR}::text is null or e.id<>#{entry,jdbcType=VARCHAR}),0) paid,
          coalesce(sum(e.amount),0) current_paid,coalesce(bool_or(e.id=#{entry,jdbcType=VARCHAR}),false) current_invoice
          from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id) x
          where i.tenant_id=o.tenant_id and i.order_id=o.id and (x.paid<0 or x.paid>i.amount or x.current_paid<0 or x.current_paid>i.amount
            or (i.payment_status is distinct from case when x.paid=0 then '待付款' when x.paid=i.amount then '已付款' else '部分付款' end
              and not(x.current_invoice and i.payment_status is not distinct from case when x.current_paid=0 then '待付款' when x.current_paid=i.amount then '已付款' else '部分付款' end)))) verified
      from purchase_orders o where o.tenant_id=#{tenant} and o.id=#{order}
      """)
  OrderBasis orderBasis(@Param("tenant")String tenant,@Param("order")String order,@Param("entry")String entry);
  record Allocation(String milestoneId, BigDecimal amount) {}

  @Select("select coalesce(sum(amount),0) from contract_payment_allocations where tenant_id=#{tenant} and milestone_id=#{milestone}")
  BigDecimal paid(@Param("tenant") String tenant, @Param("milestone") String milestone);

  @Select("select milestone_id,amount from contract_payment_allocations where tenant_id=#{tenant} and entry_id=#{entry} order by milestone_id")
  List<Allocation> byEntry(@Param("tenant") String tenant, @Param("entry") String entry);

  @Insert("insert into contract_payment_allocations(id,tenant_id,entry_id,milestone_id,amount) values(#{id},#{tenant},#{entry},#{milestone},#{amount})")
  void insert(@Param("id") String id, @Param("tenant") String tenant, @Param("entry") String entry,
      @Param("milestone") String milestone, @Param("amount") BigDecimal amount);
}
