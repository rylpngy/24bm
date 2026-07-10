-- 供应商资质（提交准入与 RFQ 邀请要求至少一条 active 资质）。
-- expires_at 设不同到期，供后续资质到期预警(S2c)演示。

insert into supplier_qualifications (
  id, supplier_id, qualification_type, certificate_no, expires_at, file_name, storage_key, status
)
values
  ('qual-sunrise-iso', 'ent-supplier-sunrise', 'ISO9001', 'ISO-SUNRISE-001', date '2027-12-31', 'iso9001.pdf', 'demo/qual/sunrise-iso.pdf', 'active'),
  ('qual-tech-iso', 'ent-supplier-tech', 'ISO9001', 'ISO-TECH-002', date '2026-07-10', 'iso9001.pdf', 'demo/qual/tech-iso.pdf', 'active'),
  ('qual-office-biz', 'ent-supplier-office', '营业执照', 'BL-OFFICE-003', date '2027-06-30', 'license.pdf', 'demo/qual/office-bl.pdf', 'active')
on conflict (id) do nothing;
