-- POC 登录以工号作为校内人员身份标识。以下均为脱敏演示工号，不代表真实教职工信息。
update users
set employee_no = case id
  when 'user-ldu-admin' then 'LDU000001'
  when 'user-ldu-applicant' then 'LDU100001'
  when 'user-ldu-reviewer' then 'LDU200000'
  when 'user-ldu-argumentation' then 'LDU200001'
  when 'user-ldu-it-review' then 'LDU200002'
  when 'user-ldu-unit-manager' then 'LDU200003'
  when 'user-ldu-funding-manager' then 'LDU200004'
  when 'user-ldu-asset-review' then 'LDU200005'
  when 'user-ldu-asset-division' then 'LDU200006'
  when 'user-ldu-asset-unit' then 'LDU200007'
  when 'user-ldu-lab-review' then 'LDU200008'
  when 'user-ldu-lab-division' then 'LDU200009'
  when 'user-ldu-lab-unit' then 'LDU200010'
  when 'user-ldu-school-leader' then 'LDU200011'
  when 'user-ldu-finance-budget' then 'LDU200012'
  when 'user-ldu-procurement-budget' then 'LDU200013'
  when 'user-ldu-handover' then 'LDU200014'
  when 'user-ldu-method' then 'LDU200015'
  when 'user-ldu-finance-responsible' then 'LDU200016'
  else employee_no
end,
job_title = case id
  when 'user-ldu-admin' then '系统管理员'
  when 'user-ldu-applicant' then '项目申报人'
  when 'user-ldu-reviewer' then '综合审批办理人'
  else name
end,
updated_at = now()
where tenant_id = 'tenant-ludong-poc';
