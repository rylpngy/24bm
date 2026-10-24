package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.Invoice;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface InvoiceMapper {

  @Select("""
      select min(id) as id, tenant_id, order_id, null::text as receiver_id,
             null::text as result, max(received_at) as received_at,
             case when count(received_quantity)=count(*) then sum(received_quantity)::integer end as received_quantity,
             case when count(qualified_quantity)=count(*) then sum(qualified_quantity)::integer end as qualified_quantity,
             null::text as quality_note, null::text as inspection_conclusion,
             null::text as disposition, null::text as disposition_note
      from receipts where tenant_id=#{tenantId} and order_id=#{orderId}
      group by tenant_id, order_id
      """)
  com.procurement.order.domain.Receipt findAggregateReceipt(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note,
             created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices where tenant_id=#{tenantId} and id=#{id} for update
      """)
  Invoice lockByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<Invoice> listByTenant(@Param("tenantId") String tenantId);

  default List<Invoice> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("paymentStatus") String paymentStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId) {
    return listVisible(tenantId, paymentStatus, supplierId, orderId, com.procurement.identity.domain.DataScope.unrestricted());
  }

  @Select("""
      <script>
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where tenant_id = #{tenantId}
        <if test="paymentStatus != null and paymentStatus != ''">
        and payment_status = #{paymentStatus}
        </if>
        <if test="supplierId != null and supplierId != ''">
        and supplier_id = #{supplierId}
        </if>
        <if test="orderId != null and orderId != ''">
        and order_id = #{orderId}
        </if>
      and order_id in (
      """ + FinanceScopeSql.ORDERS + """
      )
      order by created_at desc
      </script>
      """)
  List<Invoice> listVisible(
      @Param("tenantId") String tenantId,
      @Param("paymentStatus") String paymentStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
      order by created_at desc
      """)
  List<Invoice> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        <if test="paymentStatus != null and paymentStatus != ''">
        and payment_status = #{paymentStatus}
        </if>
        <if test="orderId != null and orderId != ''">
        and order_id = #{orderId}
        </if>
      order by created_at desc
      </script>
      """)
  List<Invoice> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("paymentStatus") String paymentStatus,
      @Param("orderId") String orderId);

  @Select("""
      select count(1)
      from invoices
      where tenant_id = #{tenantId}
        and order_id = #{orderId,jdbcType=VARCHAR}
      """)
  int countByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Insert("""
      insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, invoice_code, invoice_date, tax_rate)
      values (#{id}, #{tenantId}, #{supplierId}, #{orderId}, #{amount}, #{invoiceNo}, #{paymentStatus,jdbcType=VARCHAR}, #{invoiceCode}, #{invoiceDate,jdbcType=DATE}, #{taxRate})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("amount") BigDecimal amount,
      @Param("invoiceNo") String invoiceNo,
      @Param("paymentStatus") String paymentStatus,
      @Param("invoiceCode") String invoiceCode,
      @Param("invoiceDate") java.time.LocalDate invoiceDate,
      @Param("taxRate") BigDecimal taxRate);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Invoice findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, reconciliation_note, created_at, updated_at, invoice_code, invoice_date, tax_rate
      from invoices
      where supplier_id = #{supplierId,jdbcType=VARCHAR} and id = #{id}
      """)
  Invoice findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Update("""
      update invoices
      set payment_status = #{paymentStatus}, updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and payment_status = #{currentPaymentStatus}
      """)
  int updatePaymentStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentPaymentStatus") String currentPaymentStatus,
      @Param("paymentStatus") String paymentStatus);

  @Update("""
      update invoices
      set reconciliation_note = #{reconciliationNote},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
      """)
  int updateSupplierReconciliationNote(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("reconciliationNote") String reconciliationNote);
}
