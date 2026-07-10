-- 演示:rfq-demo(报价中)的澄清答疑——一条已广播答复 + 一条待答复。
insert into rfq_clarifications (id, tenant_id, rfq_id, supplier_id, question, answer, answered_by, published, asked_at, answered_at)
values
  ('clar-demo-1', 'tenant-acme', 'rfq-demo', 'ent-supplier-sunrise',
   '请问是否接受分两批交货?首批先交50台。', '可以接受分两批,首批不少于50台,余量15个工作日内交清。',
   'user-buyer-owner', true,
   timestamptz '2026-06-18 10:00:00+08', timestamptz '2026-06-18 15:30:00+08'),
  ('clar-demo-2', 'tenant-acme', 'rfq-demo', 'ent-supplier-tech',
   '报价是否需要包含三年上门质保?', null, null, false,
   timestamptz '2026-06-19 09:20:00+08', null)
on conflict (id) do nothing;
