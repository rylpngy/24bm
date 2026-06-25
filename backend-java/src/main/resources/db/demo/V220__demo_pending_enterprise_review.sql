-- 平台端演示:一家待审核入驻企业(verified=false 才进入平台待审核队列)。
insert into enterprises (id, name, type, industry, verified)
values ('ent-supplier-newapply', '远景智能装备有限公司', 'supplier', '智能制造', false)
on conflict (id) do nothing;

insert into supplier_enterprises (
  enterprise_id, credit_code, legal_person, verified_status, profile_status,
  contact_name, contact_phone, contact_email, bank_name, bank_account, business_scope,
  profile_confirmed, risk_confirmed
)
values (
  'ent-supplier-newapply', '91330100MA2APPLY01', '周远', 'pending', 'submitted',
  '周远', '13655667788', 'zhouyuan@yj-equip.com', '中国银行杭州分行', '375566778899001',
  '工业自动化设备、机器人及智能产线集成；相关技术咨询与售后服务。',
  false, false
)
on conflict (enterprise_id) do nothing;
