alter table special_funding_changes drop constraint special_funding_change_kind;
alter table special_funding_changes drop constraint special_funding_change_object;
alter table special_funding_changes add constraint special_funding_change_kind check(kind in ('fund_limit','project_plan','project_carryover','project_reallocation'));
alter table special_funding_changes add constraint special_funding_change_object check((kind='fund_limit' and fund_id is not null and project_id is null) or (kind in ('project_plan','project_carryover','project_reallocation') and project_id is not null and fund_id is null));
create unique index special_reallocation_pending on special_funding_changes(tenant_id,project_id) where status='submitted' and kind='project_reallocation';
create table funding_reallocation_lines (
 tenant_id text not null,change_id text not null,project_id text not null,plan_id text not null,fund_id text not null,
 before_amount numeric(18,2) not null check(before_amount>=0),after_amount numeric(18,2) not null check(after_amount>=0),
 created_by text not null,created_at timestamptz not null default now(),primary key(tenant_id,change_id,fund_id),
 foreign key(tenant_id,change_id) references special_funding_changes(tenant_id,id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id),
 foreign key(tenant_id,plan_id,fund_id) references project_funding_lines(tenant_id,change_id,fund_id)
);
create index funding_reallocation_project on funding_reallocation_lines(tenant_id,project_id,plan_id,fund_id);
create trigger immutable_funding_reallocation before update or delete on funding_reallocation_lines for each row execute function protect_special_funding_history();

create or replace view project_funding_balances as
 select l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,
 (l.amount+coalesce(c.restored,0)+coalesce(r.adjustment,0))::numeric(18,2) allocated_amount,
 coalesce(a.paid,0) paid_amount,l.amount+coalesce(c.restored,0)+coalesce(r.adjustment,0)-coalesce(a.paid,0) remaining_amount
 from project_funding_plans p join project_funding_lines l on l.tenant_id=p.tenant_id and l.change_id=p.change_id
 join special_funds f on f.tenant_id=l.tenant_id and f.id=l.fund_id
 left join lateral(select sum(a.amount) paid from funding_payment_allocations a where a.tenant_id=l.tenant_id and a.project_id=l.project_id and a.change_id=l.change_id and a.fund_id=l.fund_id)a on true
 left join lateral(select sum(c.amount) restored from funding_correction_allocations c join frozen_payment_corrections fc on fc.tenant_id=c.tenant_id and fc.id=c.correction_id and fc.status='approved' where c.tenant_id=l.tenant_id and c.project_id=l.project_id and c.plan_id=l.change_id and c.target_fund_id=l.fund_id)c on true
 left join lateral(select sum(r.after_amount-r.before_amount) adjustment from funding_reallocation_lines r join special_funding_changes fc on fc.tenant_id=r.tenant_id and fc.id=r.change_id and fc.status='approved' where r.tenant_id=l.tenant_id and r.project_id=l.project_id and r.plan_id=l.change_id and r.fund_id=l.fund_id)r on true;

create function verify_funding_reallocation() returns trigger language plpgsql as $$
declare c special_funding_changes%rowtype; k text;
begin
 if tg_table_name='special_funding_changes' then k:=new.id; else k:=new.change_id; end if;
 select * into c from special_funding_changes where tenant_id=new.tenant_id and id=k;
 if c.kind<>'project_reallocation' then
   if tg_table_name='funding_reallocation_lines' then raise exception 'Reallocation lines require reallocation business type'; end if;
   return null;
 end if;
 if c.status<>'approved' then
   if exists(select 1 from funding_reallocation_lines where tenant_id=c.tenant_id and change_id=c.id) then raise exception 'Reallocation requires approved workflow'; end if;
   return null;
 end if;
 if (select count(*) from funding_reallocation_lines where tenant_id=c.tenant_id and change_id=c.id)<>jsonb_array_length(c.snapshot->'reallocation'->'lines')
   or not exists(select 1 from funding_reallocation_lines where tenant_id=c.tenant_id and change_id=c.id)
   or (select sum(after_amount-before_amount) from funding_reallocation_lines where tenant_id=c.tenant_id and change_id=c.id)<>0
   or (select sum(after_amount) from funding_reallocation_lines where tenant_id=c.tenant_id and change_id=c.id)<>c.amount then raise exception 'Reallocation must preserve all source responsibility and total'; end if;
 if exists(select 1 from funding_reallocation_lines r where r.tenant_id=c.tenant_id and r.change_id=c.id and (r.project_id<>c.project_id or r.created_by<>c.completed_by or r.plan_id is distinct from (select change_id from project_funding_plans where tenant_id=c.tenant_id and project_id=c.project_id)
   or not exists(select 1 from jsonb_array_elements(c.snapshot->'reallocation'->'lines') l where l->>'fundId'=r.fund_id and (l->>'beforeAmount')::numeric=r.before_amount and (l->>'afterAmount')::numeric=r.after_amount)))
   or exists(select 1 from project_funding_balances where tenant_id=c.tenant_id and project_id=c.project_id and remaining_amount<0)
   or exists(select 1 from special_fund_balances where tenant_id=c.tenant_id and available_amount<0) then raise exception 'Reallocation source, approver or capacity mismatch'; end if;
 return null;
end $$;
create constraint trigger funding_reallocation_complete after insert or update on special_funding_changes deferrable initially deferred for each row execute function verify_funding_reallocation();
create constraint trigger funding_reallocation_lines_complete after insert on funding_reallocation_lines deferrable initially deferred for each row execute function verify_funding_reallocation();
