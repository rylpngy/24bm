-- Live, tenant-scoped evidence projections. Missing historical evidence is a blocker, not zero.
-- V222 owns the immutable receipt review table; before it exists, no review is assumed.
create function finance_receipt_review_approved(p_tenant text, p_receipt text)
returns boolean language plpgsql stable as $$
declare approved boolean;
begin
  if to_regclass('public.receipt_disposition_reviews') is null then return false; end if;
  execute 'select exists(select 1 from public.receipt_disposition_reviews
    where tenant_id=$1 and receipt_id=$2 and decision=''让步接收''
      and nullif(btrim(reason),'''') is not null and nullif(btrim(evidence_no),'''') is not null
      and nullif(btrim(reviewed_by),'''') is not null and reviewed_at is not null)'
    into approved using p_tenant,p_receipt;
  return approved;
end;
$$;

create view finance_receipt_acceptance as
select r.*,
  ((r.disposition='让步接收' and nullif(btrim(r.disposition_note),'') is not null)
    or finance_receipt_review_approved(r.tenant_id,r.id)) is true as disposition_approved
from receipts r;

create view finance_fulfillment_checks as
with line_checks as (
  select o.tenant_id, o.id as order_id,
    count(l.id) as line_count,
    sum(l.line_amount) as line_amount,
    bool_or(l.quantity is null or l.quantity <= 0 or l.unit_price is null or l.unit_price < 0
      or l.line_amount is null or l.line_amount <> round(l.quantity * l.unit_price, 2)) as invalid_order_line,
    bool_or(q.received is null or q.accepted is null or q.accepted <> l.quantity
      or q.received < q.qualified) as quantity_mismatch
  from purchase_orders o
  left join order_line_items l on l.tenant_id=o.tenant_id and l.order_id=o.id
  left join lateral (
    select sum(rl.received_quantity) as received, sum(rl.qualified_quantity) as qualified,
      sum(case when r.disposition_approved then rl.received_quantity else rl.qualified_quantity end) as accepted
    from receipt_line_items rl join finance_receipt_acceptance r on r.tenant_id=rl.tenant_id and r.id=rl.receipt_id
    where rl.tenant_id=l.tenant_id and rl.order_line_id=l.id and r.order_id=o.id
  ) q on true
  group by o.tenant_id,o.id
), receipt_checks as (
  select r.tenant_id,r.order_id,count(*) as receipt_count,
    max(r.received_at) filter (where r.qualified_quantity < r.received_quantity) as last_defect_at,
    bool_or(r.qualified_quantity < r.received_quantity and not r.disposition_approved) as has_defect,
    bool_or(r.received_at is null or r.received_quantity is null or r.qualified_quantity is null
      or r.received_quantity <= 0 or r.qualified_quantity < 0 or r.qualified_quantity > r.received_quantity
      or q.line_count=0 or q.invalid_line or q.received is distinct from r.received_quantity
      or q.qualified is distinct from r.qualified_quantity) as invalid_receipt
  from finance_receipt_acceptance r
  left join lateral (
    select count(*) as line_count,sum(rl.received_quantity) as received,sum(rl.qualified_quantity) as qualified,
      bool_or(l.id is null or rl.received_quantity is null or rl.qualified_quantity is null
        or rl.received_quantity < 0 or rl.qualified_quantity < 0 or rl.qualified_quantity > rl.received_quantity)
        or count(*) <> count(distinct rl.order_line_id) as invalid_line
    from receipt_line_items rl
    left join order_line_items l on l.tenant_id=rl.tenant_id and l.id=rl.order_line_id and l.order_id=r.order_id
    where rl.tenant_id=r.tenant_id and rl.receipt_id=r.id
  ) q on true
  group by r.tenant_id,r.order_id
)
select o.tenant_id,o.id as order_id,o.supplier_id,o.amount as order_amount,
  r.has_defect,r.last_defect_at,
  case
    when o.status is null or o.status not in ('已收货','已完成') then '订单尚未足额完成收货验收'
    when o.amount is null or o.amount <= 0 or l.line_count=0 or l.invalid_order_line
      or l.line_amount is distinct from o.amount then '订单行数量或金额待核对'
    when r.receipt_count is null or r.invalid_receipt then '验收证据缺失或头行数量及处置不一致'
    when r.has_defect then '退换货或不合格处置尚未依法复核'
    when l.quantity_mismatch then '累计收货或合格数量与订单行不一致'
    else null
  end as blocking_reason
from purchase_orders o
join line_checks l on l.tenant_id=o.tenant_id and l.order_id=o.id
left join receipt_checks r on r.tenant_id=o.tenant_id and r.order_id=o.id;

create view finance_invoice_closeout_checks as
select i.tenant_id,i.id as invoice_id,i.order_id,i.supplier_id,i.amount as invoice_amount,
  f.order_amount,
  case
    when f.order_id is null then '订单证据缺失'
    when i.supplier_id is distinct from f.supplier_id then '发票与订单供应商不一致'
    when f.blocking_reason is not null then f.blocking_reason
    when i.amount is null or i.amount <= 0 or i.amount > f.order_amount
      or (select sum(x.amount) from invoices x where x.tenant_id=i.tenant_id and x.order_id=i.order_id) > f.order_amount
      then '开票金额与订单不一致'
    when not exists (select 1 from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id)
      or (select sum(il.line_amount) from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id) is distinct from i.amount
      or exists (
        select 1 from invoice_line_items il
        left join order_line_items ol on ol.tenant_id=il.tenant_id and ol.id=il.order_line_id and ol.order_id=i.order_id
        where il.tenant_id=i.tenant_id and il.invoice_id=i.id
          and (ol.id is null or il.quantity is null or il.quantity <= 0 or il.quantity > ol.quantity
            or il.unit_price is distinct from ol.unit_price or il.line_amount is null
            or il.line_amount <> round(il.quantity * il.unit_price,2)))
      or exists (select 1 from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id
        group by il.order_line_id having count(*) > 1)
      then '发票行数量或金额证据待核对'
    when exists (select 1 from variance_handlings v where v.tenant_id=i.tenant_id and v.order_id=i.order_id
      and (v.status is distinct from '已处理' or nullif(btrim(v.result),'') is null)) then '存在未解决差异'
    else null
  end as blocking_reason
from invoices i
left join finance_fulfillment_checks f on f.tenant_id=i.tenant_id and f.order_id=i.order_id;

create view contract_closeout_checks as
select c.tenant_id,c.id as contract_id,
  case
    when c.status is distinct from '已生效' then '合同尚未生效'
    when o.id is null or c.supplier_id is distinct from o.supplier_id
      or c.amount is null or c.amount <= 0 or c.amount is distinct from o.amount then '合同与订单金额或供应商不一致'
    when f.blocking_reason is not null then f.blocking_reason
    when not exists (select 1 from invoices i where i.tenant_id=c.tenant_id and i.order_id=c.related_order_id)
      or (select sum(i.amount) from invoices i where i.tenant_id=c.tenant_id and i.order_id=c.related_order_id) is distinct from c.amount
      then '开票合计未覆盖合同与订单金额'
    when exists (
      select 1 from order_line_items ol where ol.tenant_id=c.tenant_id and ol.order_id=c.related_order_id
        and (select sum(il.quantity) from invoice_line_items il
          join invoices i on i.tenant_id=il.tenant_id and i.id=il.invoice_id
          where il.tenant_id=ol.tenant_id and il.order_line_id=ol.id and i.order_id=c.related_order_id) is distinct from ol.quantity)
      then '累计开票数量与订单不一致'
    when exists (
      select 1 from invoices i
      left join finance_invoice_closeout_checks checks on checks.tenant_id=i.tenant_id and checks.invoice_id=i.id
      where i.tenant_id=c.tenant_id and i.order_id=c.related_order_id
        and (checks.blocking_reason is not null or i.payment_status is distinct from '已付款'
          or (select sum(e.amount) from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id) is distinct from i.amount
          or not exists (select 1 from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id)
          or exists (select 1 from invoice_payment_entries e where e.tenant_id=i.tenant_id and e.invoice_id=i.id
            and (e.amount is null or e.amount=0 or nullif(btrim(e.evidence_no),'') is null
              or nullif(btrim(e.idempotency_key),'') is null
              or (e.reversal_of is null and e.amount < 0)
              or (e.reversal_of is not null and (e.amount >= 0 or not exists (
                select 1 from invoice_payment_entries original where original.tenant_id=e.tenant_id
                  and original.invoice_id=e.invoice_id and original.id=e.reversal_of
                  and original.reversal_of is null and original.amount=-e.amount)))))))
      then '发票付款净流水、状态或凭据未闭合，历史数据须核对'
    else null
  end as blocking_reason
from contracts c
left join purchase_orders o on o.tenant_id=c.tenant_id and o.id=c.related_order_id
left join finance_fulfillment_checks f on f.tenant_id=c.tenant_id and f.order_id=c.related_order_id;

create view finance_three_way_match_checks as
select m.id,m.tenant_id,m.invoice_id,i.supplier_id,i.order_id,
  checks.order_amount,
  case when f.blocking_reason is null then '已收货' else '待核验' end as receipt_status,
  i.amount as invoice_amount,i.amount-checks.order_amount as variance_amount,
  case when checks.blocking_reason is null then '三单匹配通过'
       when checks.blocking_reason like '%金额%' then '金额差异' else '履约待核验' end as match_status,
  coalesce(checks.blocking_reason,'订单、收货、发票一致') as blocking_reason,
  case when checks.blocking_reason is not null then '需处理差异'
       when i.payment_status='已付款' then '已付款归档'
       when i.payment_status='部分付款' then '部分付款跟进' else '可申请付款' end as payment_readiness,
  m.created_at,m.updated_at
from three_way_matches m
join invoices i on i.tenant_id=m.tenant_id and i.id=m.invoice_id
join finance_invoice_closeout_checks checks on checks.tenant_id=i.tenant_id and checks.invoice_id=i.id
left join finance_fulfillment_checks f on f.tenant_id=i.tenant_id and f.order_id=i.order_id;
