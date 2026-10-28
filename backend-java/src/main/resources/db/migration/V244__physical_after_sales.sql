create table mall_after_sales_physical_events (
 id text primary key, tenant_id text not null, after_sales_id text not null references mall_after_sales(id),
 request_key text not null, kind text not null check(kind in ('return_dispatch','return_receipt','replacement_dispatch','inspection_pass','inspection_fail')),
 quantity numeric(14,2) not null check(quantity>0), reference_no text not null, note text not null,
 file_name text not null, file_bytes bytea not null check(octet_length(file_bytes) between 1 and 2097152),
 sha256 text not null, actor_id text not null, actor_role text not null check(actor_role in ('buyer','supplier')),
 created_at timestamptz not null default clock_timestamp(), unique(tenant_id,after_sales_id,request_key)
);
create index idx_after_sales_physical_case on mall_after_sales_physical_events(tenant_id,after_sales_id,created_at,id);

create view mall_after_sales_physical_checks as
select a.tenant_id,a.id,a.order_id,a.order_line_id,a.type,a.quantity,
 coalesce((select e.kind from mall_after_sales_physical_events e where e.tenant_id=a.tenant_id and e.after_sales_id=a.id order by e.created_at desc,e.id desc limit 1),'') as last_event,
 a.status='已完成' and (select e.kind from mall_after_sales_physical_events e where e.tenant_id=a.tenant_id and e.after_sales_id=a.id order by e.created_at desc,e.id desc limit 1)=case when a.type='退货' then 'return_receipt' else 'inspection_pass' end as verified
from mall_after_sales a where a.type in ('退货','换货');

create or replace view mall_after_sales_finance_checks as
select a.tenant_id,a.order_id,
 case when bool_or(a.status not in ('已完成','已拒绝','已撤回')) then '售后未决，暂停付款及归档'
 when bool_or(a.type in ('退货','换货') and a.status='已完成' and not coalesce(p.verified,false)) then '历史退换货缺少实物核验凭证，须先补充核验'
 when bool_or(a.type='退货' and a.status='已完成') and not exists(select 1 from order_settlements s where s.tenant_id=a.tenant_id and s.order_id=a.order_id and s.status='settled') then '退货实物已核验，退款及发票清算待完成'
 end::text as blocking_reason
from mall_after_sales a left join mall_after_sales_physical_checks p on p.tenant_id=a.tenant_id and p.id=a.id group by a.tenant_id,a.order_id;

create function protect_physical_after_sales_evidence() returns trigger language plpgsql as $$
begin raise exception 'Physical after-sales evidence is immutable'; end; $$;
create trigger physical_after_sales_evidence_immutable before update or delete on mall_after_sales_physical_events for each row execute function protect_physical_after_sales_evidence();
