-- 审计日志增加可选明细列:记录「改了什么」(如 角色: 财务专员 → 采购管理员)。
-- 旧记录 detail 为空,新写入按需填充;读侧原样透出。
alter table audit_logs add column detail text;
