package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.InvoiceInstallmentPolicy.Balance;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface InvoiceIssuanceMapper {
  @Select(
      """
select id,tenant_id,rfq_id,supplier_id,amount,status,expected_receipt_date,created_at,updated_at,
delivery_address,contact_name,contact_phone,payment_terms from purchase_orders where supplier_id=#{supplier} and id=#{order}
""")
  com.procurement.order.domain.PurchaseOrder order(
      @Param("supplier") String supplier, @Param("order") String order);

  @Select(
      """
select l.id,l.description,l.unit,l.quantity,l.unit_price,l.line_amount,
  coalesce(sum(il.quantity),0) invoiced_quantity,coalesce(sum(il.line_amount),0) invoiced_amount
from order_line_items l left join (invoice_line_items il join invoices i
  on i.tenant_id=il.tenant_id and i.id=il.invoice_id and i.order_id=#{order})
  on il.tenant_id=l.tenant_id and il.order_line_id=l.id
where l.tenant_id=#{tenant} and l.order_id=#{order}
group by l.id order by l.sort_no,l.id
""")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Balance> balances(@Param("tenant") String tenant, @Param("order") String order);

  @Select(
      """
select exists(select 1 from invoices i where i.tenant_id=#{tenant} and i.order_id=#{order} and
  (i.amount<=0 or i.supplier_id<>(select supplier_id from purchase_orders where tenant_id=#{tenant} and id=#{order})
  or not exists(select 1 from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id)
  or i.amount is distinct from (select sum(il.line_amount) from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id)
  or exists(select 1 from invoice_line_items il left join order_line_items ol
     on ol.tenant_id=il.tenant_id and ol.id=il.order_line_id and ol.order_id=i.order_id
     where il.tenant_id=i.tenant_id and il.invoice_id=i.id and (ol.id is null or il.quantity<=0
       or il.unit_price is distinct from ol.unit_price or il.line_amount<>round(il.quantity*il.unit_price,2)))
  or exists(select 1 from invoice_line_items il where il.tenant_id=i.tenant_id and il.invoice_id=i.id group by il.order_line_id having count(*)>1)))
""")
  boolean invalidHistory(@Param("tenant") String tenant, @Param("order") String order);

  @Select(
      "select coalesce(sum(amount),0) from invoices where tenant_id=#{tenant} and"
          + " order_id=#{order}")
  java.math.BigDecimal invoiced(@Param("tenant") String tenant, @Param("order") String order);

  record Submission(String id, String fingerprint) {}

  @Select(
      "select id,submission_fingerprint fingerprint from invoices where tenant_id=#{tenant} and"
          + " supplier_id=#{supplier} and order_id=#{order} and submission_key=#{key}")
  Submission byKey(
      @Param("tenant") String tenant,
      @Param("supplier") String supplier,
      @Param("order") String order,
      @Param("key") String key);

  @Select(
      "select exists(select 1 from invoices where tenant_id=#{tenant} and order_id=#{order} and"
          + " invoice_no=#{number})")
  boolean duplicateNumber(
      @Param("tenant") String tenant, @Param("order") String order, @Param("number") String number);

  @Update(
      "update invoices set submission_key=#{key},submission_fingerprint=#{fingerprint} where"
          + " tenant_id=#{tenant} and id=#{id}")
  int submission(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("key") String key,
      @Param("fingerprint") String fingerprint);
}
