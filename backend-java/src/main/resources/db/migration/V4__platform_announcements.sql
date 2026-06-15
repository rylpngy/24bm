create table platform_announcements (
  id text primary key,
  title text not null,
  content text not null,
  audience text not null check (audience in ('all', 'buyer', 'supplier')),
  status text not null default 'active',
  published_by text not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_platform_announcements_status on platform_announcements (status, created_at desc);
