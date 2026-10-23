package com.procurement.supplier.infrastructure;

/** Global clearance classification; detail visibility must be applied only after these checks. */
public final class SupplierExitRiskSql {
  private SupplierExitRiskSql() {}

  public static final String CTE = """
      with scoped_orders as (
        select * from purchase_orders where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      ), scoped_invoices as (
        select * from invoices where tenant_id = #{tenantId} and
          (supplier_id = #{supplierId} or order_id in (select id from scoped_orders))
      ), scoped_contracts as (
        select * from contracts where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      ), milestone_balances as (
        select m.*, coalesce((select sum(a.amount) from contract_payment_allocations a
          where a.tenant_id = #{tenantId} and a.milestone_id = m.id), 0) as paid
        from contract_payment_milestones m join scoped_contracts c on c.id = m.contract_id
        where m.tenant_id = #{tenantId}
      ), schedules as (
        select contract_id, sum(amount) as amount, sum(paid) as paid,
          bool_or(amount is null or paid < 0 or paid > amount or status is distinct from
            case when paid = 0 then '待付' when paid = amount then '已付' else '部分已付' end) as invalid
        from milestone_balances group by contract_id
      ), balances as (
        select i.*, coalesce((select sum(e.amount) from invoice_payment_entries e
          where e.tenant_id = #{tenantId} and e.invoice_id = i.id), 0) as paid
        from scoped_invoices i
      ), explained as (
        select i.*, concat_ws('；',
          case when i.paid < 0 or i.paid > i.amount or i.payment_status is distinct from
            case when i.paid = 0 then '待付款' when i.paid = i.amount then '已付款' else '部分付款' end
            then '付款状态与实际金额流水不一致，需核实历史付款记录' end,
          case when i.supplier_id <> #{supplierId} or not exists (select 1 from scoped_orders o
            where o.id = i.order_id and o.amount = i.amount)
            then '订单与发票的供应商或金额不一致，或订单不属于当前企业供应商' end,
          case when (select count(*) from scoped_invoices other where other.order_id = i.order_id) <> 1
            then '同一订单存在多张发票，需核实重复开票' end,
          case when c.id is not null and c.amount is distinct from i.amount
            then '合同金额与发票金额不一致' end,
          case when coalesce(s.invalid, false)
            then '付款节点状态与分摊流水不一致，需核实节点金额' end,
          case when s.contract_id is not null and s.paid <> i.paid
            then '付款节点分摊合计与发票实际付款不一致' end,
          case when s.contract_id is not null and s.amount <> i.amount
            then '付款节点计划合计与发票金额不一致' end) as reason
        from balances i left join scoped_contracts c on c.related_order_id = i.order_id
        left join schedules s on s.contract_id = c.id
      ), checked as (
        select explained.*, reason <> '' as verification from explained
      ), order_coverage as (
        select o.*, coalesce((select sum(i.amount) from scoped_invoices i where i.order_id = o.id), 0) as invoiced_amount
        from scoped_orders o
      ), uninvoiced as (
        select * from order_coverage where amount < 0 or invoiced_amount < amount
      )
      """;
}
