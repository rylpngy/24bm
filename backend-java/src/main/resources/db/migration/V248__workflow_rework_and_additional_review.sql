alter table workflow_task_events drop constraint workflow_task_events_action_check;
alter table workflow_task_events add constraint workflow_task_events_action_check
  check (action in ('created','claimed','approved','rejected','completed','cancelled',
    'transferred','copied','reminded','deadline_changed','returned','approval_invalidated',
    'additional_requested','additional_approved','additional_rejected'));

-- Evidence for native Flowable delegation, not a second task runtime.
create table workflow_additional_reviews (
  id text primary key,
  tenant_id text not null references tenants(id),
  workflow_instance_id text not null references workflow_business_instances(id),
  flowable_task_id text not null,
  node_id text not null,
  requested_by text not null references users(id),
  reviewer_id text not null references users(id),
  reason text not null,
  status text not null check (status in ('pending','approved','rejected','cancelled')),
  review_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
create unique index uq_workflow_pending_additional_review
  on workflow_additional_reviews(tenant_id, flowable_task_id) where status='pending';
create index idx_workflow_additional_review_instance
  on workflow_additional_reviews(tenant_id, workflow_instance_id, created_at);
