create function protect_project_reopen_request() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' then
  if old.kind='reopen' then raise exception 'Reopen history cannot be deleted'; end if;
  return old;
 end if;
 if old.kind='reopen' or new.kind='reopen' then
  if old.kind<>new.kind or old.status<>'submitted' or
   (to_jsonb(new)-array['status','revision','workflow_instance_id','completed_by','completed_at']) is distinct from
   (to_jsonb(old)-array['status','revision','workflow_instance_id','completed_by','completed_at']) then raise exception 'Reopen evidence is immutable'; end if;
  if new.status='approved' and not exists(select 1 from workflow_business_instances w where w.tenant_id=new.tenant_id and w.id=new.workflow_instance_id and w.business_type='project_reopen' and w.business_id=new.id and w.status='approved' and w.completed_by=new.completed_by and w.completed_by<>w.initiator_id) then raise exception 'Reopen requires recorded independent workflow approval'; end if;
 end if;
 return new;
end $$;
create trigger immutable_project_reopen_request before update or delete on procurement_project_lifecycle_requests for each row execute function protect_project_reopen_request();
