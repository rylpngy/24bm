-- Keep local Keycloak realms imported before V240 compatible with the demo user table.
-- New realm imports use user-buyer-zhang/user-buyer-li; older local realms may still
-- issue user-buyer-requester/user-buyer-finance in the userId claim.
-- Legacy aliases only bridge historical Keycloak subject ids. Employee numbers
-- remain on the canonical user so tenant-wide employee identity stays unique.
insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash, employee_no, job_title)
select 'user-buyer-requester', tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash, null, job_title
from users
where id = 'user-buyer-zhang'
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  supplier_id = excluded.supplier_id,
  name = excluded.name,
  mobile = excluded.mobile,
  email = excluded.email,
  status = excluded.status,
  department_id = excluded.department_id,
  password_hash = excluded.password_hash,
  employee_no = null,
  job_title = excluded.job_title;

insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash, employee_no, job_title)
select 'user-buyer-finance', tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash, null, job_title
from users
where id = 'user-buyer-li'
on conflict (id) do update set
  tenant_id = excluded.tenant_id,
  supplier_id = excluded.supplier_id,
  name = excluded.name,
  mobile = excluded.mobile,
  email = excluded.email,
  status = excluded.status,
  department_id = excluded.department_id,
  password_hash = excluded.password_hash,
  employee_no = null,
  job_title = excluded.job_title;

insert into user_roles (user_id, role_id) values
  ('user-buyer-requester', 'role-buyer-requester'),
  ('user-buyer-finance', 'role-buyer-finance')
on conflict (user_id, role_id) do nothing;
