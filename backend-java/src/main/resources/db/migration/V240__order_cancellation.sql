create table order_cancellation_requests (
 id text primary key, tenant_id text not null references tenants(id),
 order_id text not null references purchase_orders(id), supplier_id text not null references enterprises(id),
 request_key text not null, reason varchar(1000) not null, previous_status text not null check(previous_status in ('待供应商确认','待发货')),
 status text not null check(status in ('pending','accepted','rejected','withdrawn')),
 created_by text not null references users(id), created_at timestamptz not null default now(),
 completed_by text references users(id), completed_at timestamptz, response varchar(1000),
 unique(tenant_id,order_id,request_key)
);
create unique index order_one_pending_cancellation on order_cancellation_requests(tenant_id,order_id) where status='pending';
create unique index order_one_accepted_cancellation on order_cancellation_requests(tenant_id,order_id) where status='accepted';
create index order_cancellation_history on order_cancellation_requests(tenant_id,order_id,created_at desc,id);
