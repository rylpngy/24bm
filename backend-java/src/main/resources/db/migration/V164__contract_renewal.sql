-- 合同到期续签:renewal_status 记录续签状态(空=未续签 / 已发起续签)。
alter table contracts add column renewal_status varchar(16);
