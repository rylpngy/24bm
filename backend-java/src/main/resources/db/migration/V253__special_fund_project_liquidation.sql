alter table special_funding_changes drop constraint special_funding_change_kind;
alter table special_funding_changes drop constraint special_funding_change_object;
alter table special_funding_changes add constraint special_funding_change_kind check(kind in ('fund_limit','project_plan','project_carryover','project_reallocation','project_liquidation'));
alter table special_funding_changes add constraint special_funding_change_object check((kind='fund_limit' and fund_id is not null and project_id is null) or (kind in ('project_plan','project_carryover','project_reallocation','project_liquidation') and project_id is not null and fund_id is null));
