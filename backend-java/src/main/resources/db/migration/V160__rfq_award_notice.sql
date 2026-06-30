-- 中标通知书签发留痕(电子签章):一份 RFQ 一份通知书,记录印章号/签发人/签发时间。
create table rfq_award_notices (
  rfq_id varchar(64) primary key,
  tenant_id varchar(64) not null,
  award_id varchar(64) not null,
  seal_no varchar(64) not null,
  issued_by varchar(64) not null,
  issued_at timestamptz not null default now()
);
