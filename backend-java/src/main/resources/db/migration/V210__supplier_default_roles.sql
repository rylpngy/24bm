-- Explicit defaults; existing assignments are deliberately preserved.
insert into roles (id, tenant_id, scope, name, permissions) values
('role-system-supplier-owner', null, 'supplier', '供应商管理员', '["supplier:*"]'::jsonb),
('role-system-supplier-member', null, 'supplier', '供应商业务成员', '[
  "supplier:rfq:read", "supplier:rfq:manage",
  "supplier:tender:read", "supplier:tender:manage",
  "supplier:order:read", "supplier:order:manage",
  "supplier:delivery:read", "supplier:delivery:manage",
  "supplier:invoice:read", "supplier:invoice:manage",
  "supplier:mall:read", "supplier:mall:manage",
  "supplier:profile:read", "supplier:qualification:read",
  "supplier:notification:read", "supplier:notification:manage",
  "supplier:announcement:read", "supplier:esign:read"
]'::jsonb);
