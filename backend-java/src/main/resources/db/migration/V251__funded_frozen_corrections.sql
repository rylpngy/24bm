alter table frozen_payment_corrections add constraint frozen_correction_tenant_id unique(tenant_id,id);
create table funding_correction_allocations (
 tenant_id text not null,correction_id text not null,project_id text not null,entry_id text not null,
 source_fund_id text not null,target_fund_id text not null,plan_id text not null,
 amount numeric(18,2) not null check(amount>0),created_by text not null,created_at timestamptz not null default now(),
 primary key(tenant_id,correction_id,source_fund_id),
 foreign key(tenant_id,correction_id) references frozen_payment_corrections(tenant_id,id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id),
 foreign key(tenant_id,entry_id,source_fund_id) references funding_payment_allocations(tenant_id,entry_id,fund_id),
 foreign key(tenant_id,plan_id,target_fund_id) references project_funding_lines(tenant_id,change_id,fund_id)
);
create index funding_correction_project_plan on funding_correction_allocations(tenant_id,project_id,plan_id,target_fund_id);
create trigger immutable_funding_correction before update or delete on funding_correction_allocations
 for each row execute function protect_special_funding_history();

create or replace view project_funding_balances as
 select l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,
 (l.amount+coalesce(c.restored,0))::numeric(18,2) allocated_amount,
 coalesce(a.paid,0) paid_amount,l.amount+coalesce(c.restored,0)-coalesce(a.paid,0) remaining_amount
 from project_funding_plans p join project_funding_lines l on l.tenant_id=p.tenant_id and l.change_id=p.change_id
 join special_funds f on f.tenant_id=l.tenant_id and f.id=l.fund_id
 left join lateral(select sum(a.amount) paid from funding_payment_allocations a where a.tenant_id=l.tenant_id
   and a.project_id=l.project_id and a.change_id=l.change_id and a.fund_id=l.fund_id) a on true
 left join lateral(select sum(c.amount) restored from funding_correction_allocations c join frozen_payment_corrections fc
   on fc.tenant_id=c.tenant_id and fc.id=c.correction_id and fc.status='approved'
   where c.tenant_id=l.tenant_id and c.project_id=l.project_id and c.plan_id=l.change_id and c.target_fund_id=l.fund_id)c on true;

create view project_funding_paid_basis as
 select p.*,p.prior_paid_amount-coalesce(c.restored,0) effective_prior_paid_amount
 from project_funding_plans p left join lateral(
   select sum(c.amount) restored from funding_correction_allocations c join frozen_payment_corrections fc
    on fc.tenant_id=c.tenant_id and fc.id=c.correction_id and fc.status='approved'
   where c.tenant_id=p.tenant_id and c.project_id=p.project_id and c.plan_id=p.change_id)c on true;

create function verify_funding_correction_completion() returns trigger language plpgsql as $$
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
 if exists(select 1 from funding_payment_allocations a left join funding_correction_allocations r
   on r.tenant_id=a.tenant_id and r.correction_id=c.id and r.source_fund_id=a.fund_id
   where a.tenant_id=c.tenant_id and a.entry_id=c.entry_id and (r.amount is distinct from a.amount or r.entry_id<>c.entry_id or r.project_id<>c.project_id or r.created_by<>c.completed_by))
   or coalesce((select sum(amount) from funding_correction_allocations where tenant_id=c.tenant_id and correction_id=c.id),0)<>c.amount then
   raise exception 'Funding restoration must retain every exact original source amount and approver';
 end if;
 if exists(select 1 from funding_payment_allocations original left join funding_payment_allocations reversal
   on reversal.tenant_id=original.tenant_id and reversal.entry_id=c.reversal_id and reversal.fund_id=original.fund_id
   where original.tenant_id=c.tenant_id and original.entry_id=c.entry_id and (reversal.amount is distinct from -original.amount or reversal.change_id<>original.change_id)) then
   raise exception 'Funding reversal must preserve original source version';
 end if;
 if exists(select 1 from project_funding_paid_basis where tenant_id=c.tenant_id and project_id=c.project_id and effective_prior_paid_amount<0)
   or exists(select 1 from special_fund_balances where tenant_id=c.tenant_id and available_amount<0) then
   raise exception 'Funding restoration exceeds approved responsibility or source capacity';
 end if;
 return null;
end $$;
create constraint trigger funded_correction_complete after insert or update on frozen_payment_corrections
 deferrable initially deferred for each row execute function verify_funding_correction_completion();
create constraint trigger funded_restoration_complete after insert on funding_correction_allocations
 deferrable initially deferred for each row execute function verify_funding_correction_completion();
