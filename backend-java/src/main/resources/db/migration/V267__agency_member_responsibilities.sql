alter table agency_members drop constraint agency_members_role_check;
alter table agency_members add constraint agency_members_role_check check(role in ('OWNER','EDITOR','VIEWER','DRAFTER','OFFICE'));
