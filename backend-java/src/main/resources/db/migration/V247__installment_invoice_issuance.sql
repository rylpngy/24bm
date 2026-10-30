alter table invoices add column submission_key varchar(100);
alter table invoices add column submission_fingerprint varchar(64);
create unique index invoice_submission_key on invoices(tenant_id,supplier_id,order_id,submission_key)
 where submission_key is not null;

create or replace view finance_invoice_closeout_checks as
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
    when exists(select 1 from invoices other where other.tenant_id=i.tenant_id and other.order_id=i.order_id
      and (other.amount is null or other.amount<=0 or other.supplier_id is distinct from i.supplier_id
        or not exists(select 1 from invoice_line_items il where il.tenant_id=other.tenant_id and il.invoice_id=other.id)
        or other.amount is distinct from (select sum(il.line_amount) from invoice_line_items il where il.tenant_id=other.tenant_id and il.invoice_id=other.id)
        or exists(select 1 from invoice_line_items il left join order_line_items ol on ol.tenant_id=il.tenant_id and ol.id=il.order_line_id and ol.order_id=other.order_id
          where il.tenant_id=other.tenant_id and il.invoice_id=other.id and (ol.id is null or il.quantity<=0 or il.unit_price is distinct from ol.unit_price or il.line_amount<>round(il.quantity*il.unit_price,2)))))
      then '同订单其他发票明细待核验'
    when exists (
      select 1 from order_line_items ol join invoice_line_items il
        on il.tenant_id=ol.tenant_id and il.order_line_id=ol.id
      join invoices other on other.tenant_id=il.tenant_id and other.id=il.invoice_id and other.order_id=ol.order_id
      where ol.tenant_id=i.tenant_id and ol.order_id=i.order_id
      group by ol.id having sum(il.quantity)>ol.quantity or sum(il.line_amount)>ol.line_amount)
      then '累计开票数量或行金额超过订单明细'
    when exists (select 1 from variance_handlings v where v.tenant_id=i.tenant_id and v.order_id=i.order_id
      and (v.status is distinct from '已处理' or nullif(btrim(v.result),'') is null)) then '存在未解决差异'
    else null
  end as blocking_reason
from invoices i
left join finance_fulfillment_checks f on f.tenant_id=i.tenant_id and f.order_id=i.order_id;

create or replace view finance_three_way_match_checks as
select m.id,m.tenant_id,m.invoice_id,i.supplier_id,i.order_id,
  checks.order_amount,
  case when f.blocking_reason is null then '已收货' else '待核验' end as receipt_status,
  i.amount as invoice_amount,
  case when checks.blocking_reason is null then 0::numeric else i.amount-checks.order_amount end as variance_amount,
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
