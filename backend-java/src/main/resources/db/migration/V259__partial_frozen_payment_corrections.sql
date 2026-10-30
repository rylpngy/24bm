-- Multiple negative entries are permitted only through separately approved frozen corrections.
alter table invoice_payment_entries drop constraint invoice_payment_entries_tenant_id_reversal_of_key;
drop index frozen_correction_once;
create unique index frozen_correction_pending on frozen_payment_corrections(tenant_id,entry_id) where status='submitted';
create index payment_reversal_source on invoice_payment_entries(tenant_id,reversal_of) where reversal_of is not null;

create or replace function protect_frozen_payment_correction() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'Frozen correction history cannot be deleted'; end if;
  if not exists(select 1 from invoice_payment_entries e where e.id=new.entry_id and e.tenant_id=new.tenant_id
      and e.invoice_id=new.invoice_id and e.amount>=new.amount and e.amount>0) then
    raise exception 'Frozen correction must retain its original scoped payment';
  end if;
  if tg_op='UPDATE' and (old.status<>'submitted' or
      (to_jsonb(new)-array['status','revision','workflow_instance_id','reversal_id','completed_by','completed_at'])
        is distinct from (to_jsonb(old)-array['status','revision','workflow_instance_id','reversal_id','completed_by','completed_at'])
      or (old.workflow_instance_id is not null and new.workflow_instance_id is distinct from old.workflow_instance_id)) then
    raise exception 'Frozen correction source and completed history are immutable';
  end if;
  if new.status='approved' and not exists(select 1 from invoice_payment_entries e where e.id=new.reversal_id
      and e.tenant_id=new.tenant_id and e.invoice_id=new.invoice_id and e.reversal_of=new.entry_id and e.amount=-new.amount) then
    raise exception 'Approved correction requires its actual scoped reversal entry';
  end if;
  return new;
end $$;

create function valid_scoped_payment_reversal(t text,invoice text,entry text) returns boolean language sql stable as $$
 select exists(select 1 from invoice_payment_entries e join invoice_payment_entries original
   on original.tenant_id=e.tenant_id and original.invoice_id=e.invoice_id and original.id=e.reversal_of
   where e.tenant_id=t and e.invoice_id=invoice and e.id=entry and e.amount<0 and original.amount>0 and original.reversal_of is null
   and original.amount+coalesce((select sum(r.amount) from invoice_payment_entries r where r.tenant_id=t and r.reversal_of=original.id),0)>=0
   and ((original.amount=-e.amount and (select count(*) from invoice_payment_entries r where r.tenant_id=t and r.reversal_of=original.id)=1)
     or exists(select 1 from frozen_payment_corrections fc where fc.tenant_id=t and fc.invoice_id=invoice and fc.entry_id=original.id
       and fc.reversal_id=e.id and fc.status='approved' and fc.amount=-e.amount)))
$$;

create or replace view contract_closeout_checks as
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
              or (e.reversal_of is not null and not valid_scoped_payment_reversal(e.tenant_id,e.invoice_id,e.id))))))
      then '发票付款净流水、状态或凭据未闭合，历史数据须核对'
    else null
  end as blocking_reason
from contracts c
left join purchase_orders o on o.tenant_id=c.tenant_id and o.id=c.related_order_id
left join finance_fulfillment_checks f on f.tenant_id=c.tenant_id and f.order_id=c.related_order_id;

create function verify_partial_payment_reversal() returns trigger language plpgsql as $$
declare original invoice_payment_entries%rowtype; total numeric; approved boolean;
begin
 if new.reversal_of is null then return null; end if;
 select * into original from invoice_payment_entries where id=new.reversal_of for update;
 if original.id is null or original.amount<=0 or original.tenant_id<>new.tenant_id or original.invoice_id<>new.invoice_id then
   raise exception 'Payment reversal must retain original tenant and invoice'; end if;
 select -sum(amount) into total from invoice_payment_entries where tenant_id=new.tenant_id and reversal_of=original.id;
 if total>original.amount then raise exception 'Cumulative reversal exceeds remaining original payment'; end if;
 select exists(select 1 from frozen_payment_corrections c where c.tenant_id=new.tenant_id and c.reversal_id=new.id
   and c.entry_id=original.id and c.invoice_id=new.invoice_id and c.amount=-new.amount and c.status='approved') into approved;
 if not approved and (new.amount<>-original.amount or (select count(*) from invoice_payment_entries where tenant_id=new.tenant_id and reversal_of=original.id)<>1) then
   raise exception 'Partial or repeated reversal requires approved frozen correction'; end if;
 if exists(select 1 from frozen_payment_corrections c where c.tenant_id=new.tenant_id and c.reversal_id=new.id and c.status='approved'
   and (c.created_by=c.completed_by or c.completed_by<>new.created_by or not exists(select 1 from workflow_business_instances w
      where w.tenant_id=c.tenant_id and w.id=c.workflow_instance_id and w.business_type='frozen_payment_correction'
      and w.business_id=c.id and w.status='approved'))) then
   raise exception 'Frozen correction requires actual independent workflow approval'; end if;
 return null;
end $$;
create constraint trigger partial_payment_reversal after insert on invoice_payment_entries
 deferrable initially deferred for each row execute function verify_partial_payment_reversal();

create or replace function verify_special_funding_payment() returns trigger language plpgsql as $$
begin
 if exists(select 1 from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
   join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id
   join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
   join project_funding_balances b on b.tenant_id=d.tenant_id and b.project_id=d.project_id
   where i.tenant_id=new.tenant_id and i.id=new.invoice_id) then
   if coalesce((select sum(amount) from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.id),0)<>new.amount then
     raise exception 'Funding source lines must equal actual payment amount'; end if;
   if exists(select 1 from funding_payment_allocations a where a.tenant_id=new.tenant_id and a.entry_id=new.id
     and not exists(select 1 from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
       join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
       where i.id=new.invoice_id and i.tenant_id=new.tenant_id and d.project_id=a.project_id)) then
     raise exception 'Funding source does not belong to the payment project'; end if;
   if exists(select 1 from project_funding_balances where tenant_id=new.tenant_id and (paid_amount<0 or remaining_amount<0))
     or exists(select 1 from special_fund_balances where tenant_id=new.tenant_id and available_amount<0) then
     raise exception 'Funding responsibility or payment exceeds approved source limit'; end if;
   if new.reversal_of is not null then
     if exists(select 1 from frozen_payment_corrections c where c.tenant_id=new.tenant_id and c.reversal_id=new.id and c.status='approved') then
       if exists(select 1 from funding_payment_allocations a where a.tenant_id=new.tenant_id and a.entry_id=new.id and
         (a.amount>=0 or not exists(select 1 from funding_payment_allocations o where o.tenant_id=a.tenant_id and o.entry_id=new.reversal_of
           and o.fund_id=a.fund_id and o.change_id=a.change_id and o.project_id=a.project_id))) or exists(
           select 1 from funding_payment_allocations o where o.tenant_id=new.tenant_id and o.entry_id=new.reversal_of and
             o.amount+coalesce((select sum(a.amount) from funding_payment_allocations a join invoice_payment_entries e on e.tenant_id=a.tenant_id and e.id=a.entry_id
              where e.tenant_id=o.tenant_id and e.reversal_of=o.entry_id and a.fund_id=o.fund_id and a.change_id=o.change_id),0)<0) then
         raise exception 'Partial funding reversal exceeds original source amount or version'; end if;
     elsif exists(select 1 from (select fund_id,amount from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.reversal_of) original
       full join (select fund_id,amount from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.id) reversal using(fund_id)
       where original.amount is null or reversal.amount is null or original.amount<>-reversal.amount) then
       raise exception 'Reversal must retain exact original funding attribution'; end if;
   end if;
 end if;
 return null;
end $$;

create or replace function verify_funding_correction_completion() returns trigger language plpgsql as $$
declare c frozen_payment_corrections%rowtype; key_id text;
begin
 if tg_table_name='frozen_payment_corrections' then key_id:=new.id; else key_id:=new.correction_id; end if;
 select * into c from frozen_payment_corrections where tenant_id=new.tenant_id and id=key_id;
 if not exists(select 1 from funding_payment_allocations a where a.tenant_id=c.tenant_id and a.entry_id=c.entry_id) then return null; end if;
 if c.status<>'approved' then
   if exists(select 1 from funding_correction_allocations a where a.tenant_id=c.tenant_id and a.correction_id=c.id) then
     raise exception 'Funding restoration requires approved correction'; end if;
   return null;
 end if;
 if coalesce((select sum(amount) from funding_correction_allocations where tenant_id=c.tenant_id and correction_id=c.id),0)<>c.amount
   or exists(select 1 from funding_correction_allocations r left join funding_payment_allocations original
     on original.tenant_id=r.tenant_id and original.entry_id=c.entry_id and original.fund_id=r.source_fund_id
     left join funding_payment_allocations reversal on reversal.tenant_id=r.tenant_id and reversal.entry_id=c.reversal_id and reversal.fund_id=r.source_fund_id
     where r.tenant_id=c.tenant_id and r.correction_id=c.id and (original.amount is null or r.amount>original.amount or
       reversal.amount is distinct from -r.amount or reversal.change_id<>original.change_id or r.entry_id<>c.entry_id or r.project_id<>c.project_id or r.created_by<>c.completed_by))
   or exists(select 1 from funding_payment_allocations reversal where reversal.tenant_id=c.tenant_id and reversal.entry_id=c.reversal_id
     and not exists(select 1 from funding_correction_allocations r where r.tenant_id=c.tenant_id and r.correction_id=c.id and r.source_fund_id=reversal.fund_id)) then
   raise exception 'Funding restoration must retain selected original source amounts and approver';
 end if;
 if exists(select 1 from project_funding_paid_basis where tenant_id=c.tenant_id and project_id=c.project_id and effective_prior_paid_amount<0)
   or exists(select 1 from special_fund_balances where tenant_id=c.tenant_id and available_amount<0) then
   raise exception 'Funding restoration exceeds approved responsibility or source capacity'; end if;
 return null;
end $$;
