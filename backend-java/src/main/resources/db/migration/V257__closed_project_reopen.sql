do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='procurement_project_lifecycle_requests'::regclass and contype='c' and pg_get_constraintdef(oid) like '%kind%' loop
  execute format('alter table procurement_project_lifecycle_requests drop constraint %I',c.conname);
 end loop;
end $$;
alter table procurement_project_lifecycle_requests add constraint project_lifecycle_kind check(kind in ('carryover','liquidation','reopen'));
alter table procurement_project_lifecycle_requests add constraint project_lifecycle_period check((kind='carryover' and target_period>source_period) or (kind in ('liquidation','reopen') and target_period=source_period));
alter table procurement_project_lifecycle_requests add constraint project_lifecycle_tenant_id unique(tenant_id,id);
create table project_reopen_archives(
 tenant_id text not null,request_id text not null,sha256 varchar(64) not null check(sha256 ~ '^[a-f0-9]{64}$'),
 file_bytes bytea not null check(octet_length(file_bytes)<=104857600),created_at timestamptz not null default now(),
 primary key(tenant_id,request_id),foreign key(tenant_id,request_id) references procurement_project_lifecycle_requests(tenant_id,id)
);
create trigger immutable_project_reopen_archive before update or delete on project_reopen_archives for each row execute function protect_special_funding_history();

create function verify_project_reopen_transition() returns trigger language plpgsql as $$
begin
 if tg_table_name='procurement_projects' then
  if old.status in ('closed','terminated') and new.status='approved' and not exists(
   select 1 from procurement_project_lifecycle_requests r where r.tenant_id=new.tenant_id and r.project_id=new.id and r.kind='reopen' and r.status='approved' and r.project_revision=old.revision
   and r.snapshot->'reopen'->'project'->>'status'=old.status
  ) then raise exception 'Closed project requires a separately approved reopen request'; end if;
 else
  if old.status='closed' and new.status='ready' and not exists(
   select 1 from procurement_project_lifecycle_requests r where r.tenant_id=new.tenant_id and r.project_id=new.project_id and r.kind='reopen' and r.status='approved'
   and r.snapshot->'reopen'->>'packageId'=new.id
   and exists(select 1 from jsonb_array_elements(r.snapshot->'reopen'->'packages') p where p->>'id'=new.id and (p->>'revision')::integer=old.revision and p->>'status'='closed')
  ) then raise exception 'Closed package requires a separately approved reopen request'; end if;
 end if;
 return new;
end $$;
create trigger project_controlled_reopen before update on procurement_projects for each row execute function verify_project_reopen_transition();
create trigger package_controlled_reopen before update on procurement_project_packages for each row execute function verify_project_reopen_transition();
