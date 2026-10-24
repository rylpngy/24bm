-- Product media uses supplier/product/user ownership, not buyer-private attachments.
create table mall_product_media_uploads (
  storage_key text primary key,
  product_id text not null references mall_products(id),
  supplier_id text not null references enterprises(id),
  user_id text not null references users(id),
  file_name text not null,
  token_hash text not null,
  state text not null check (state in ('issued','uploading','uploaded','registered','failed')),
  content_type text,
  content_size bigint,
  content_sha256 text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index mall_product_media_uploads_product_idx on mall_product_media_uploads(product_id,storage_key);
