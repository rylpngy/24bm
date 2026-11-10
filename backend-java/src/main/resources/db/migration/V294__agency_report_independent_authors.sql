create table agency_report_contributors(tenant_id text not null,report_id text not null,user_id text not null,created_at timestamptz not null default now(),primary key(tenant_id,report_id,user_id),foreign key(tenant_id,report_id) references agency_evaluation_reports(tenant_id,id));
insert into agency_report_contributors(tenant_id,report_id,user_id) select tenant_id,id,created_by from agency_evaluation_reports on conflict do nothing;
insert into agency_report_contributors(tenant_id,report_id,user_id) select tenant_id,report_id,created_by from agency_report_artifacts on conflict do nothing;
insert into agency_report_contributors(tenant_id,report_id,user_id) select tenant_id,report_id,created_by from agency_report_submissions on conflict do nothing;
