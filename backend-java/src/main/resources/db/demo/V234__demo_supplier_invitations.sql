-- 演示邀请单:待回复(关联已知供应商 远景,接受可桥接为待准入)/ 已接受外部 / 待回复外部。
insert into supplier_invitations
  (id, tenant_id, supplier_id, supplier_name, contact, category, note, status, responded_at)
values
  ('inv-yuanjing', 'tenant-acme', 'ent-supplier-newapply', '远景智能装备有限公司',
   'zhang@yuanjing.com', '智能制造', '邀请补充资质并加入私域', '待回复', null),
  ('inv-bluesea', 'tenant-acme', null, '蓝海办公用品有限公司',
   '0571-88880000', '办公耗材', '邀请注册平台并报价', '待回复', null),
  ('inv-greenpower', 'tenant-acme', null, '绿能电气设备厂',
   'sales@greenpower.com', '电气设备', '已接受,等待注册', '已接受', now() - interval '2 day')
on conflict (id) do nothing;
