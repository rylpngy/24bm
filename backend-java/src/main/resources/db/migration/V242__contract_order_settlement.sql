create table order_settlements (
 id text primary key,tenant_id text not null references tenants(id),order_id text not null references purchase_orders(id),
 supplier_id text not null references enterprises(id),contract_id text not null references contracts(id),request_key text not null,
 kind text not null check(kind in ('draft_void','termination','reduction')),reason varchar(1000) not null,previous_status text not null,
 snapshot jsonb not null,goods_amount numeric(16,2) not null check(goods_amount>=0),compensation_amount numeric(16,2) not null check(compensation_amount>=0),
 final_amount numeric(16,2) not null check(final_amount=goods_amount+compensation_amount),initial_paid numeric(16,2) not null check(initial_paid>=0),
 initial_invoiced numeric(16,2) not null check(initial_invoiced>=0),
 status text not null check(status in ('supplier_pending','agreed','submitted','approved','rejected','withdrawn','settled')),
 revision int not null default 1,workflow_instance_id text,created_by text not null references users(id),created_at timestamptz not null default now(),
 supplier_actor text references users(id),supplier_comment varchar(1000),supplier_acted_at timestamptz,completed_by text references users(id),completed_at timestamptz,
 agreement_id text not null references attachments(id),agreement_name text not null,agreement_sha text not null,agreement_bytes bytea not null,
 unique(tenant_id,order_id,request_key)
);
create unique index order_one_live_settlement on order_settlements(tenant_id,order_id) where status not in ('rejected','withdrawn');
create index order_settlement_history on order_settlements(tenant_id,order_id,created_at desc,id);
create table order_settlement_evidence (
 id text primary key,tenant_id text not null references tenants(id),settlement_id text not null references order_settlements(id),request_key text not null,
 kind text not null check(kind in ('refund','payment','invoice','compensation_receipt')),
 amount numeric(16,2) not null check(amount>=0 and (kind not in ('refund','payment') or amount>0)),evidence_no varchar(150) not null,
 attachment_id text not null references attachments(id),content_sha text not null,remark varchar(1000) not null,
 created_by text not null references users(id),created_at timestamptz not null default now(),unique(tenant_id,settlement_id,request_key)
);
create unique index settlement_cash_reference on order_settlement_evidence(tenant_id,kind,evidence_no) where kind in ('refund','payment');
create unique index settlement_final_document on order_settlement_evidence(tenant_id,settlement_id,kind) where kind in ('invoice','compensation_receipt');

-- Serialize legacy finance mutations with the same parent order; a settlement is append-only.
create function guard_order_settlement_finance() returns trigger language plpgsql as $$
declare t text; o text;
begin
 if TG_TABLE_NAME='invoice_payment_entries' then
   select i.tenant_id,i.order_id into t,o from invoices i where i.tenant_id=coalesce(NEW.tenant_id,OLD.tenant_id) and i.id=coalesce(NEW.invoice_id,OLD.invoice_id);
 else t:=coalesce(NEW.tenant_id,OLD.tenant_id);o:=coalesce(NEW.order_id,OLD.order_id);end if;
 perform id from purchase_orders where tenant_id=t and id=o for update;
 if exists(select 1 from order_settlements s where s.tenant_id=t and s.order_id=o and s.status not in ('rejected','withdrawn')) then
   raise exception '订单已进入合同清算，原始发票和付款记录冻结，请使用清算台账登记凭证';
 end if;
 return coalesce(NEW,OLD);
end $$;
create trigger protect_settlement_invoice before insert or update or delete on invoices for each row execute function guard_order_settlement_finance();
create trigger protect_settlement_payment before insert or update or delete on invoice_payment_entries for each row execute function guard_order_settlement_finance();
create trigger protect_settlement_request before insert or update or delete on payment_requests for each row execute function guard_order_settlement_finance();

create function guard_order_settlement_fulfillment() returns trigger language plpgsql as $$
declare t text; o text;
begin
 t:=coalesce(NEW.tenant_id,OLD.tenant_id);
 if TG_TABLE_NAME='delivery_line_items' then
   select order_id into o from deliveries where tenant_id=t and id=coalesce(NEW.delivery_id,OLD.delivery_id);
 elsif TG_TABLE_NAME='receipt_line_items' then
   select order_id into o from receipts where tenant_id=t and id=coalesce(NEW.receipt_id,OLD.receipt_id);
 else o:=coalesce(NEW.order_id,OLD.order_id); end if;
 perform id from purchase_orders where tenant_id=t and id=o for update;
 if exists(select 1 from order_settlements s where s.tenant_id=t and s.order_id=o and s.status not in ('rejected','withdrawn')) then
   raise exception '合同清算期间及清算完成后，原始履约依据不可变更';
 end if;
 return coalesce(NEW,OLD);
end $$;
create trigger protect_settlement_delivery before insert or update or delete on deliveries for each row execute function guard_order_settlement_fulfillment();
create trigger protect_settlement_receipt before insert or update or delete on receipts for each row execute function guard_order_settlement_fulfillment();
create trigger protect_settlement_delivery_line before insert or update or delete on delivery_line_items for each row execute function guard_order_settlement_fulfillment();
create trigger protect_settlement_receipt_line before insert or update or delete on receipt_line_items for each row execute function guard_order_settlement_fulfillment();
