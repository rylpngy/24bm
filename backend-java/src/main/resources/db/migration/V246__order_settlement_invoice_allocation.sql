alter table order_settlements alter column contract_id drop not null;
alter table invoices drop constraint invoices_tenant_id_order_id_key;
create index invoices_order_lookup on invoices(tenant_id,order_id);
-- Keep the original anti-duplicate safeguard, now expressed as a serialized cumulative cap.
create function guard_order_invoice_total() returns trigger language plpgsql as $$
declare total numeric; original numeric;
begin
 select amount into original from purchase_orders where tenant_id=NEW.tenant_id and id=NEW.order_id for update;
 select coalesce(sum(amount),0) into total from invoices where tenant_id=NEW.tenant_id and order_id=NEW.order_id and id<>NEW.id;
 if total+NEW.amount>original then
   raise exception '累计发票金额不得超过原订单金额，禁止重复全额开票';
 end if;
 return NEW;
end $$;
create trigger protect_order_invoice_total before insert or update of amount,order_id,tenant_id on invoices
 for each row execute function guard_order_invoice_total();
alter table order_settlements drop constraint order_settlements_kind_check;
alter table order_settlements add constraint order_settlements_kind_check
 check(kind in ('draft_void','termination','reduction','order_closeout'));
alter table order_settlement_evidence add column source text;
drop index settlement_final_document;
create unique index settlement_final_document
 on order_settlement_evidence(tenant_id,settlement_id,kind,coalesce(source,''))
 where kind in ('invoice','compensation_receipt');
