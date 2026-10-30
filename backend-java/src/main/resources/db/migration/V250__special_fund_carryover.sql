alter table project_funding_plans add column prior_paid_amount numeric(18,2) not null default 0 check(prior_paid_amount>=0);

-- Discover the generated check-constraint names rather than relying on ordinal naming.
do $$ declare r record; begin
 for r in select conname from pg_constraint where conrelid='special_funding_changes'::regclass and contype='c'
   and pg_get_constraintdef(oid) like '%kind%' loop
   execute format('alter table special_funding_changes drop constraint %I',r.conname);
 end loop;
end $$;
alter table special_funding_changes add constraint special_funding_change_kind
 check(kind in ('fund_limit','project_plan','project_carryover'));
alter table special_funding_changes add constraint special_funding_change_object
 check((kind='fund_limit' and fund_id is not null and project_id is null)
    or (kind in ('project_plan','project_carryover') and project_id is not null and fund_id is null));

-- Current plans reserve unspent responsibility; superseded plans retain only their actual net cash.
create or replace view special_fund_balances as
 select f.*,coalesce(x.reserved,0) reserved_amount,coalesce(x.paid,0) paid_amount,
   f.total_amount-coalesce(x.reserved,0) available_amount
 from special_funds f left join lateral (
   select sum(v.reserved) reserved,sum(v.paid) paid from (
     select case when p.status in ('closed','terminated') then b.paid_amount else b.allocated_amount end reserved,
       b.paid_amount paid
     from project_funding_balances b join procurement_projects p on p.tenant_id=b.tenant_id and p.id=b.project_id
     where b.tenant_id=f.tenant_id and b.fund_id=f.id
     union all
     select a.amount,a.amount from funding_payment_allocations a
     where a.tenant_id=f.tenant_id and a.fund_id=f.id and not exists(
       select 1 from project_funding_plans p where p.tenant_id=a.tenant_id and p.project_id=a.project_id and p.change_id=a.change_id)
   ) v
 ) x on true;
create index funding_payment_project_version on funding_payment_allocations(tenant_id,project_id,change_id,fund_id);
