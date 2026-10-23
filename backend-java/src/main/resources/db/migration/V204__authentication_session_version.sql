alter table users add column session_version bigint not null default 0;

create function invalidate_user_sessions() returns trigger language plpgsql as $$
begin
  if new.password_hash is distinct from old.password_hash
      or new.status is distinct from old.status then
    new.session_version := old.session_version + 1;
  end if;
  return new;
end;
$$;

create trigger users_invalidate_sessions
before update of password_hash, status on users
for each row execute function invalidate_user_sessions();
