alter table order_settlement_evidence add constraint settlement_evidence_tenant_id unique(tenant_id,id);
create table funding_settlement_allocations (
 tenant_id text not null,evidence_id text not null,project_id text not null,fund_id text not null,change_id text not null,
 amount numeric(18,2) not null check(amount<>0),created_by text not null,created_at timestamptz not null default now(),
 primary key(tenant_id,evidence_id,fund_id),
 foreign key(tenant_id,evidence_id) references order_settlement_evidence(tenant_id,id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id),
 foreign key(tenant_id,change_id,fund_id) references project_funding_lines(tenant_id,change_id,fund_id)
);
create index funding_settlement_project on funding_settlement_allocations(tenant_id,project_id,change_id,fund_id);
create trigger immutable_funding_settlement before update or delete on funding_settlement_allocations for each row execute function protect_special_funding_history();
create view special_funding_cash as
 select tenant_id,entry_id,project_id,fund_id,change_id,amount,created_by,created_at from funding_payment_allocations
 union all select tenant_id,evidence_id,project_id,fund_id,change_id,amount,created_by,created_at from funding_settlement_allocations;
create or replace view project_funding_balances as
 select l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,
 (l.amount+coalesce(c.restored,0)+coalesce(r.adjustment,0))::numeric(18,2) allocated_amount,
 coalesce(a.paid,0) paid_amount,l.amount+coalesce(c.restored,0)+coalesce(r.adjustment,0)-coalesce(a.paid,0) remaining_amount
 from project_funding_plans p join project_funding_lines l on l.tenant_id=p.tenant_id and l.change_id=p.change_id
 join special_funds f on f.tenant_id=l.tenant_id and f.id=l.fund_id
 left join lateral(select sum(a.amount) paid from special_funding_cash a where a.tenant_id=l.tenant_id and a.project_id=l.project_id and a.change_id=l.change_id and a.fund_id=l.fund_id)a on true
 left join lateral(select sum(c.amount) restored from funding_correction_allocations c join frozen_payment_corrections fc on fc.tenant_id=c.tenant_id and fc.id=c.correction_id and fc.status='approved' where c.tenant_id=l.tenant_id and c.project_id=l.project_id and c.plan_id=l.change_id and c.target_fund_id=l.fund_id)c on true
 left join lateral(select sum(r.after_amount-r.before_amount) adjustment from funding_reallocation_lines r join special_funding_changes fc on fc.tenant_id=r.tenant_id and fc.id=r.change_id and fc.status='approved' where r.tenant_id=l.tenant_id and r.project_id=l.project_id and r.plan_id=l.change_id and r.fund_id=l.fund_id)r on true;
create or replace view special_fund_balances as
 select f.*,coalesce(x.reserved,0) reserved_amount,coalesce(x.paid,0) paid_amount,f.total_amount-coalesce(x.reserved,0) available_amount
 from special_funds f left join lateral (
   select sum(v.reserved) reserved,sum(v.paid) paid from (
     select case when p.status in ('closed','terminated') then b.paid_amount else b.allocated_amount end reserved,b.paid_amount paid
     from project_funding_balances b join procurement_projects p on p.tenant_id=b.tenant_id and p.id=b.project_id where b.tenant_id=f.tenant_id and b.fund_id=f.id
     union all select a.amount,a.amount from special_funding_cash a where a.tenant_id=f.tenant_id and a.fund_id=f.id and not exists(select 1 from project_funding_plans p where p.tenant_id=a.tenant_id and p.project_id=a.project_id and p.change_id=a.change_id)
   ) v
 )x on true;
create function verify_funded_settlement_cash() returns trigger language plpgsql as $$
declare e order_settlement_evidence%rowtype; s order_settlements%rowtype; k text; expected numeric;
begin
 if tg_table_name='order_settlement_evidence' then k:=new.id; else k:=new.evidence_id; end if;
 select * into e from order_settlement_evidence where tenant_id=new.tenant_id and id=k;
 select * into s from order_settlements where tenant_id=e.tenant_id and id=e.settlement_id;
 if not (s.snapshot ? 'funding') then
   if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id) then raise exception 'Unfunded settlement cannot acquire source attribution'; end if;
   return null;
 end if;
 if e.kind not in ('payment','refund') then
   if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id) then raise exception 'Noncash evidence cannot carry funding cash'; end if;
   return null;
 end if;
 expected:=case when e.kind='refund' then -e.amount else e.amount end;
 if s.status not in ('approved','settled') or e.source is null
   or not exists(select 1 from jsonb_array_elements(s.snapshot->'invoicePlan') item where item->>'source'=e.source)
   or coalesce((select sum(amount) from funding_settlement_allocations where tenant_id=e.tenant_id and evidence_id=e.id),0)<>expected then raise exception 'Funded settlement cash requires approved complete source lines'; end if;
 if exists(select 1 from funding_settlement_allocations a where a.tenant_id=e.tenant_id and a.evidence_id=e.id and (a.project_id is distinct from s.snapshot->'funding'->>'projectId' or a.change_id is distinct from s.snapshot->'funding'->>'planId' or a.change_id is distinct from (select change_id from project_funding_plans where tenant_id=a.tenant_id and project_id=a.project_id) or a.created_by<>e.created_by or (a.amount>0)<>(expected>0))) then raise exception 'Settlement funding project, version or actor mismatch'; end if;
 if exists(select 1 from project_funding_balances where tenant_id=e.tenant_id and project_id=s.snapshot->'funding'->>'projectId' and (paid_amount<0 or remaining_amount<0))
   or exists(select 1 from special_fund_balances where tenant_id=e.tenant_id and available_amount<0) then raise exception 'Settlement source capacity exceeded'; end if;
 if exists(select 1 from (
   select a.fund_id,a.amount from funding_payment_allocations a join invoice_payment_entries p on p.tenant_id=a.tenant_id and p.id=a.entry_id where a.tenant_id=e.tenant_id and p.invoice_id=e.source
   union all select a.fund_id,a.amount from funding_settlement_allocations a join order_settlement_evidence p on p.tenant_id=a.tenant_id and p.id=a.evidence_id where p.tenant_id=e.tenant_id and p.settlement_id=s.id and p.source=e.source
 )cash group by fund_id having sum(amount)<0) then raise exception 'Refund exceeds invoice source net paid'; end if;
 return null;
end $$;
create constraint trigger funded_settlement_cash_complete after insert on order_settlement_evidence deferrable initially deferred for each row execute function verify_funded_settlement_cash();
create constraint trigger funded_settlement_sources_complete after insert on funding_settlement_allocations deferrable initially deferred for each row execute function verify_funded_settlement_cash();
