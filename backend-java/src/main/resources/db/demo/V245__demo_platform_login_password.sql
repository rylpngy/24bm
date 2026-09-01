-- V172 creates the platform identity row for OIDC deployments without a local hash.
-- The demo seed must complete that row so the documented local demo credential works.
update users
set password_hash = '$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O'
where id = 'user-platform-admin'
  and tenant_id is null
  and supplier_id is null
  and password_hash is null;
