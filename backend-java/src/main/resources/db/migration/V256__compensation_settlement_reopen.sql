-- Prior compensation must have explicit cash attribution; never infer legacy splits.
create or replace function verify_settlement_predecessor() returns trigger language plpgsql as $$
declare previous text; latest text;
begin
 perform id from purchase_orders where tenant_id=new.tenant_id and id=new.order_id for update;
 previous:=new.snapshot->>'previousSettlementId';
 select id into latest from effective_order_settlements where tenant_id=new.tenant_id and order_id=new.order_id;
 if previous is distinct from latest then raise exception 'Supplemental settlement must reference the current completed settlement'; end if;
 if previous is not null then
  if exists(select 1 from order_settlements where tenant_id=new.tenant_id and id=previous and kind='draft_void') then raise exception 'Draft void cannot be reopened'; end if;
  if exists(select 1 from order_settlements s where s.tenant_id=new.tenant_id and s.order_id=new.order_id and s.status='settled' and s.compensation_amount>0 and
   (not exists(select 1 from jsonb_array_elements(coalesce(s.snapshot->'invoicePlan','[]'::jsonb)) p where p->>'source'='~compensation')
    or exists(select 1 from order_settlement_evidence e where e.tenant_id=s.tenant_id and e.settlement_id=s.id and e.kind in ('refund','payment') and e.source is null))) then raise exception 'Legacy compensation requires explicit cash attribution before reopening'; end if;
 end if;
 if (new.compensation_amount>0 or exists(select 1 from order_settlements where tenant_id=new.tenant_id and id=previous and compensation_amount>0)) and not exists(
  select 1 from jsonb_array_elements(coalesce(new.snapshot->'invoicePlan','[]'::jsonb)) p where p->>'source'='~compensation' and (p->>'target')::numeric=new.compensation_amount
  and (p->>'paid')::numeric=coalesce((select compensation_amount from order_settlements where tenant_id=new.tenant_id and id=previous),0)) then raise exception 'Compensation requires a separate allocation plan with the previous net basis'; end if;
 return new;
end $$;
