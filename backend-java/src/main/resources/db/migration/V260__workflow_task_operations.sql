alter table workflow_task_events drop constraint workflow_task_events_action_check;
alter table workflow_task_events add constraint workflow_task_events_action_check
  check (action in ('created','claimed','approved','rejected','completed','cancelled',
    'transferred','copied','reminded','deadline_changed'));
