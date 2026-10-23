create table supplier_qualification_reviews (
  id bigserial primary key,
  relation_id text not null references buyer_supplier_relations(id),
  qualification_id text not null references supplier_qualifications(id),
  previous_id text not null references supplier_qualifications(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  comment text,
  actor_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (relation_id, qualification_id)
);
create index supplier_qualification_review_pending_idx on supplier_qualification_reviews(relation_id,status);
-- Existing replacements require explicit review; do not invent past decisions.
insert into supplier_qualification_reviews(relation_id,qualification_id,previous_id)
select r.id,q.replaced_by,q.id from supplier_qualifications q
join buyer_supplier_relations r on r.supplier_id=q.supplier_id
join supplier_qualifications n on n.id=q.replaced_by
where n.replaced_by is null and n.status='active';
