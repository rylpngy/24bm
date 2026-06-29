-- 企业准入审核的多步工作流留痕:每次状态流转记录一条事件(谁、从什么状态到什么状态、动作、意见)。
-- 配合 supplier_enterprises.verified_status 的状态机(pending → preliminary → approved/rejected)。
create table enterprise_review_events (
  id text primary key,
  enterprise_id text not null references enterprises(id),
  actor_id text not null references users(id),
  action text not null,
  from_status text not null,
  to_status text not null,
  comment text,
  created_at timestamptz not null default now()
);

create index idx_enterprise_review_events_enterprise
  on enterprise_review_events (enterprise_id, created_at desc);
