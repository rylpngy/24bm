-- Business handling evidence is not a bank refund or a financial reconciliation.
create table mall_after_sales_events (
  id text primary key,
  after_sales_id text not null references mall_after_sales(id),
  actor_id text,
  actor_role text not null check (actor_role in ('buyer','supplier')),
  from_status text,
  to_status text not null,
  note text,
  evidence_no text,
  created_at timestamptz not null default clock_timestamp()
);
create index idx_mall_after_sales_events_case on mall_after_sales_events(after_sales_id,created_at);
create index idx_mall_after_sales_line on mall_after_sales(tenant_id,order_line_id);

create view mall_after_sales_finance_checks as
select tenant_id,order_id,
  case when bool_or(status not in ('已完成','已拒绝','已撤回'))
    then '售后未决，暂停付款及归档'
    when bool_or(type='退货' and status='已完成')
    then '退货业务已完成，财务差异待核对，非银行退款凭证'
  end::text as blocking_reason
from mall_after_sales group by tenant_id,order_id;

-- Snapshot the existing SELECT, preserving its columns, OID and all dependent views.
-- This keeps every pre-existing acceptance check without rewriting V220 or its dependents.
do $$
declare existing_definition text;
begin
  existing_definition := regexp_replace(pg_get_viewdef('finance_fulfillment_checks'::regclass,true), ';\s*$', '');
  execute format($view$
    create or replace view finance_fulfillment_checks as
    select base.tenant_id,base.order_id,base.supplier_id,base.order_amount,
      base.has_defect,base.last_defect_at,
      coalesce(af.blocking_reason,base.blocking_reason)::text as blocking_reason
    from (%s) base
    left join mall_after_sales_finance_checks af
      on af.tenant_id=base.tenant_id and af.order_id=base.order_id
  $view$, existing_definition);
end;
$$;
