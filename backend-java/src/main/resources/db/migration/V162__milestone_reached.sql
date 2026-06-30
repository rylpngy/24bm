-- 合同履约里程碑达成:reached 标记里程碑是否达成(履约确认);付款须先达成,且按序达成。
alter table contract_payment_milestones add column reached boolean not null default false;
alter table contract_payment_milestones add column reached_at timestamptz;
