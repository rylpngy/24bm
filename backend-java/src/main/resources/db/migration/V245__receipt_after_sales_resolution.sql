create table receipt_after_sales_resolutions (
 id text primary key, tenant_id text not null, receipt_id text not null references receipts(id),
 receipt_line_id text not null references receipt_line_items(id), after_sales_id text not null references mall_after_sales(id),
 quantity numeric(14,2) not null check(quantity>0), kind text not null check(kind in ('退货','换货')),
 physical_event_id text not null references mall_after_sales_physical_events(id), physical_sha256 text not null,
 reason text not null, reviewed_by text not null, reviewed_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,after_sales_id)
);
create index idx_receipt_resolution_line on receipt_after_sales_resolutions(tenant_id,receipt_line_id);
create trigger receipt_resolution_immutable before update or delete on receipt_after_sales_resolutions for each row execute function protect_physical_after_sales_evidence();

create view receipt_after_sales_line_clearance as
select l.tenant_id,l.id as receipt_line_id,l.receipt_id,l.order_line_id,r.order_id,
 l.received_quantity,l.qualified_quantity,
 coalesce(x.returned,0)::numeric returned_quantity,coalesce(x.exchanged,0)::numeric exchanged_quantity,
 greatest(l.received_quantity-l.qualified_quantity-coalesce(x.returned,0)-coalesce(x.exchanged,0),0)::numeric unresolved_quantity,
 coalesce((l.received_quantity>=l.qualified_quantity and l.qualified_quantity>=0 and coalesce(x.invalid,false)=false
 and coalesce(x.returned,0)+coalesce(x.exchanged,0)<=l.received_quantity-l.qualified_quantity),false) as valid
from receipt_line_items l join receipts r on r.tenant_id=l.tenant_id and r.id=l.receipt_id
left join lateral (
 select sum(q.quantity) filter(where q.kind='退货') returned,sum(q.quantity) filter(where q.kind='换货') exchanged,
 bool_or(not coalesce(p.verified,false) or a.order_id<>r.order_id or a.order_line_id<>l.order_line_id or q.quantity<>a.quantity
   or q.kind<>a.type or q.receipt_id<>r.id or e.sha256<>q.physical_sha256
   or e.kind<>case when q.kind='退货' then 'return_receipt' else 'inspection_pass' end) invalid
 from receipt_after_sales_resolutions q join mall_after_sales a on a.tenant_id=q.tenant_id and a.id=q.after_sales_id
 left join mall_after_sales_physical_checks p on p.tenant_id=a.tenant_id and p.id=a.id
 join mall_after_sales_physical_events e on e.tenant_id=q.tenant_id and e.id=q.physical_event_id and e.after_sales_id=a.id
 where q.tenant_id=l.tenant_id and q.receipt_line_id=l.id
) x on true;

-- Keep the V220 head/line integrity and amount checks; only add verified exchange acceptance.
create or replace view finance_fulfillment_checks as
with line_checks as (
 select o.tenant_id,o.id order_id,count(l.id) line_count,sum(l.line_amount) line_amount,
 bool_or(l.quantity is null or l.quantity<=0 or l.unit_price is null or l.unit_price<0 or l.line_amount is null or l.line_amount<>round(l.quantity*l.unit_price,2)) invalid_order_line,
 bool_or(q.received is null or q.accepted is null or q.accepted<>l.quantity or q.received<q.qualified) quantity_mismatch
 from purchase_orders o left join order_line_items l on l.tenant_id=o.tenant_id and l.order_id=o.id
 left join lateral (
  select sum(rl.received_quantity) received,sum(rl.qualified_quantity) qualified,
  sum(case when r.disposition_approved then rl.received_quantity else rl.qualified_quantity+coalesce(c.exchanged_quantity,0) end) accepted
  from receipt_line_items rl join finance_receipt_acceptance r on r.tenant_id=rl.tenant_id and r.id=rl.receipt_id
  left join receipt_after_sales_line_clearance c on c.tenant_id=rl.tenant_id and c.receipt_line_id=rl.id
  where rl.tenant_id=l.tenant_id and rl.order_line_id=l.id and r.order_id=o.id
 )q on true group by o.tenant_id,o.id
), receipt_checks as (
 select r.tenant_id,r.order_id,count(*) receipt_count,
 max(r.received_at) filter(where r.qualified_quantity<r.received_quantity) last_defect_at,
 bool_or(r.qualified_quantity<r.received_quantity and not r.disposition_approved and (coalesce(q.unresolved,1)>0 or coalesce(q.invalid_clearance,true))) has_defect,
 bool_or(r.received_at is null or r.received_quantity is null or r.qualified_quantity is null or r.received_quantity<=0 or r.qualified_quantity<0 or r.qualified_quantity>r.received_quantity
 or q.line_count=0 or q.invalid_line or q.received is distinct from r.received_quantity or q.qualified is distinct from r.qualified_quantity or q.invalid_clearance) invalid_receipt
 from finance_receipt_acceptance r left join lateral (
 select count(*) line_count,sum(rl.received_quantity) received,sum(rl.qualified_quantity) qualified,sum(c.unresolved_quantity) unresolved,
 bool_or(c.valid is distinct from true) invalid_clearance,
 bool_or(l.id is null or rl.received_quantity is null or rl.qualified_quantity is null or rl.received_quantity<0 or rl.qualified_quantity<0 or rl.qualified_quantity>rl.received_quantity) or count(*)<>count(distinct rl.order_line_id) invalid_line
 from receipt_line_items rl left join order_line_items l on l.tenant_id=rl.tenant_id and l.id=rl.order_line_id and l.order_id=r.order_id
 left join receipt_after_sales_line_clearance c on c.tenant_id=rl.tenant_id and c.receipt_line_id=rl.id
 where rl.tenant_id=r.tenant_id and rl.receipt_id=r.id
 )q on true group by r.tenant_id,r.order_id
)
select o.tenant_id,o.id order_id,o.supplier_id,o.amount order_amount,r.has_defect,r.last_defect_at,
coalesce(af.blocking_reason,case
 when o.status is null or o.status not in ('已收货','已完成') then '订单尚未足额完成收货验收'
 when o.amount is null or o.amount<=0 or l.line_count=0 or l.invalid_order_line or l.line_amount is distinct from o.amount then '订单行数量或金额待核对'
 when r.receipt_count is null or r.invalid_receipt then '验收证据缺失或头行数量及处置不一致'
 when r.has_defect then '退换货或不合格处置尚未依法复核'
 when l.quantity_mismatch then '累计收货或合格数量与订单行不一致'
 else null end)::text blocking_reason
from purchase_orders o join line_checks l on l.tenant_id=o.tenant_id and l.order_id=o.id
left join receipt_checks r on r.tenant_id=o.tenant_id and r.order_id=o.id
left join mall_after_sales_finance_checks af on af.tenant_id=o.tenant_id and af.order_id=o.id;

-- A completed physical case does not clear the original negative receipt by itself.
do $$
declare definition text;
begin
 definition:=regexp_replace(pg_get_viewdef('mall_after_sales_finance_checks'::regclass,true),';\s*$','');
 execute format($view$
 create or replace view mall_after_sales_finance_checks as
 with pending as (
 select c.tenant_id,c.order_id,bool_or(not c.valid or c.unresolved_quantity>0) as unresolved
 from receipt_after_sales_line_clearance c join finance_receipt_acceptance r on r.tenant_id=c.tenant_id and r.id=c.receipt_id
 where not r.disposition_approved group by c.tenant_id,c.order_id
 )
 select coalesce(b.tenant_id,p.tenant_id) tenant_id,coalesce(b.order_id,p.order_id) order_id,
 coalesce(b.blocking_reason,case when p.unresolved then '不合格验收质量责任尚未核销，暂停付款及归档' end)::text blocking_reason
 from (%s)b full join pending p on p.tenant_id=b.tenant_id and p.order_id=b.order_id
 $view$,definition);
end;$$;
