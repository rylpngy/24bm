create table special_funds (
 id text primary key,tenant_id text not null references tenants(id),department_id text not null,period varchar(4) not null check(period~'^20[0-9]{2}$'),
 code varchar(50) not null,name varchar(200) not null,total_amount numeric(18,2) not null default 0 check(total_amount>=0),
 revision integer not null default 1,status text not null default 'draft' check(status in ('draft','approved')),
 created_by text not null,created_at timestamptz not null default now(),unique(tenant_id,id),unique(tenant_id,period,code),
 foreign key(department_id) references departments(id)
);
create table special_funding_changes (
 id text primary key,tenant_id text not null,kind text not null check(kind in ('fund_limit','project_plan')),fund_id text,project_id text,
 department_id text not null,period varchar(4) not null,based_revision integer not null,amount numeric(18,2) not null check(amount>=0),
 request_key varchar(100) not null,proposal jsonb not null,snapshot jsonb not null,reason varchar(1000) not null,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected','withdrawn')),revision integer not null default 1,
 workflow_instance_id text,created_by text not null,created_at timestamptz not null default now(),completed_by text,completed_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,request_key),
 check((kind='fund_limit' and fund_id is not null and project_id is null) or (kind='project_plan' and project_id is not null and fund_id is null)),
 foreign key(tenant_id,fund_id) references special_funds(tenant_id,id),foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id)
);
create unique index special_fund_pending on special_funding_changes(tenant_id,fund_id) where status='submitted' and kind='fund_limit';
create unique index special_project_funding_pending on special_funding_changes(tenant_id,project_id) where status='submitted' and kind='project_plan';
create index special_funding_changes_page on special_funding_changes(tenant_id,department_id,created_at desc,id);
create table project_funding_lines (
 tenant_id text not null,change_id text not null,project_id text not null,fund_id text not null,amount numeric(18,2) not null check(amount>0),
 primary key(tenant_id,change_id,fund_id),foreign key(tenant_id,change_id) references special_funding_changes(tenant_id,id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id),foreign key(tenant_id,fund_id) references special_funds(tenant_id,id)
);
create table project_funding_plans (
 tenant_id text not null,project_id text not null,change_id text not null,primary key(tenant_id,project_id),
 foreign key(tenant_id,project_id) references procurement_projects(tenant_id,id),foreign key(tenant_id,change_id) references special_funding_changes(tenant_id,id)
);
create table funding_payment_allocations (
 tenant_id text not null,entry_id text not null references invoice_payment_entries(id),project_id text not null,fund_id text not null,
 change_id text not null,amount numeric(18,2) not null check(amount<>0),created_by text not null,created_at timestamptz not null default now(),
 primary key(tenant_id,entry_id,fund_id),foreign key(tenant_id,change_id,fund_id) references project_funding_lines(tenant_id,change_id,fund_id)
);
create view project_funding_balances as
 select l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,l.amount allocated_amount,
   coalesce(sum(a.amount),0) paid_amount,l.amount-coalesce(sum(a.amount),0) remaining_amount
 from project_funding_plans p join project_funding_lines l on l.tenant_id=p.tenant_id and l.change_id=p.change_id
 join special_funds f on f.tenant_id=l.tenant_id and f.id=l.fund_id
 left join funding_payment_allocations a on a.tenant_id=l.tenant_id and a.project_id=l.project_id and a.fund_id=l.fund_id and a.change_id=l.change_id
 group by l.tenant_id,l.project_id,l.change_id,l.fund_id,f.code,f.name,l.amount;
create view special_fund_balances as
 select f.*,coalesce(x.reserved,0) reserved_amount,coalesce(x.paid,0) paid_amount,
   f.total_amount-coalesce(x.reserved,0) available_amount
 from special_funds f left join lateral (
   select sum(case when p.status in ('closed','terminated') then b.paid_amount else b.allocated_amount end) reserved,sum(b.paid_amount) paid
   from project_funding_balances b join procurement_projects p on p.tenant_id=b.tenant_id and p.id=b.project_id
   where b.tenant_id=f.tenant_id and b.fund_id=f.id
 ) x on true;
create function protect_special_funding_history() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then raise exception 'Funding history cannot be deleted'; end if;
 if tg_table_name='special_funding_changes' then
   if old.status<>'submitted' or (to_jsonb(new)-array['status','revision','workflow_instance_id','completed_by','completed_at']) is distinct from
       (to_jsonb(old)-array['status','revision','workflow_instance_id','completed_by','completed_at'])
       or (old.workflow_instance_id is not null and new.workflow_instance_id is distinct from old.workflow_instance_id) then
     raise exception 'Funding approval history is immutable'; end if;
 else raise exception 'Funding source ledger is immutable'; end if;
 return new;
end $$;
create trigger protect_funding_changes before update or delete on special_funding_changes for each row execute function protect_special_funding_history();
create trigger protect_funding_lines before update or delete on project_funding_lines for each row execute function protect_special_funding_history();
create trigger protect_funding_payments before update or delete on funding_payment_allocations for each row execute function protect_special_funding_history();

-- Deferred until the ledger entry and all its source lines are present in the same transaction.
create function verify_special_funding_payment() returns trigger language plpgsql as $$
begin
 if exists(select 1 from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
   join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id
   join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
   join project_funding_balances b on b.tenant_id=d.tenant_id and b.project_id=d.project_id
   where i.tenant_id=new.tenant_id and i.id=new.invoice_id) then
   if coalesce((select sum(amount) from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.id),0)<>new.amount then
     raise exception 'Funding source lines must equal actual payment amount';
   end if;
   if exists(select 1 from funding_payment_allocations a where a.tenant_id=new.tenant_id and a.entry_id=new.id
     and not exists(select 1 from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
       join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
       where i.id=new.invoice_id and i.tenant_id=new.tenant_id and d.project_id=a.project_id)) then
     raise exception 'Funding source does not belong to the payment project';
   end if;
   if exists(select 1 from project_funding_balances where tenant_id=new.tenant_id and (paid_amount<0 or remaining_amount<0))
     or exists(select 1 from special_fund_balances where tenant_id=new.tenant_id and available_amount<0) then
     raise exception 'Funding responsibility or payment exceeds approved source limit';
   end if;
   if new.reversal_of is not null and exists(
     select 1 from (select fund_id,amount from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.reversal_of) original
     full join (select fund_id,amount from funding_payment_allocations where tenant_id=new.tenant_id and entry_id=new.id) reversal using(fund_id)
     where original.amount is null or reversal.amount is null or original.amount<>-reversal.amount) then
     raise exception 'Reversal must retain exact original funding attribution';
   end if;
 end if;
 return null;
end $$;
create constraint trigger special_funding_payment_complete after insert on invoice_payment_entries
  deferrable initially deferred for each row execute function verify_special_funding_payment();
