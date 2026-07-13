-- 电子签单:关键单据(报价单/合同)的电子签署留痕。
-- 记录签署方、签署时间、单据内容指纹(SHA-256,防篡改核验)与手写签名图(data URL)。
create table esign_records (
  id text primary key,
  tenant_id text not null references tenants(id),
  target_type text not null,
  target_id text not null,
  signer_scope text not null,
  signer_id text not null,
  signer_name text,
  enterprise_id text,
  content_digest text not null,
  signature_image text not null,
  signed_at timestamptz not null default now(),
  remark text
);

create index idx_esign_records_target on esign_records (tenant_id, target_type, target_id);
