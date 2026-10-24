package com.procurement.order.infrastructure;

import com.procurement.order.domain.PurchaseOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PurchaseOrderMapper {

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at,
             delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders where tenant_id = #{tenantId} and id = #{id} for update
      """)
  PurchaseOrder lockByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select status from buyer_supplier_relations
      where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      for update
      """)
  String lockSupplierAdmissionStatus(@Param("tenantId") String tenantId, @Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<PurchaseOrder> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      <script>
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="supplierId != null and supplierId != ''">
        and supplier_id = #{supplierId}
        </if>
        <if test="rfqId != null and rfqId != ''">
        and rfq_id = #{rfqId}
        </if>
      order by created_at desc
      </script>
      """)
  List<PurchaseOrder> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("supplierId") String supplierId,
      @Param("rfqId") String rfqId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
      """)
  PurchaseOrder findByAwardSource(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at,
             delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where tenant_id = #{tenantId} and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
      """)
  PurchaseOrder findByAwardSourceFresh(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where tenant_id = #{tenantId} and id = #{id}
      """)
  PurchaseOrder findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where id = #{id} and supplier_id = #{supplierId,jdbcType=VARCHAR}
      """)
  PurchaseOrder findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
      order by created_at desc
      """)
  List<PurchaseOrder> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at, delivery_address, contact_name, contact_phone, payment_terms
      from purchase_orders
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="rfqId != null and rfqId != ''">
        and rfq_id = #{rfqId}
        </if>
      order by created_at desc
      </script>
      """)
  List<PurchaseOrder> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("rfqId") String rfqId);

  @Insert("""
      insert into purchase_orders (id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date)
      values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{amount}, #{status}, #{expectedReceiptDate})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("status") String status,
      @Param("expectedReceiptDate") LocalDate expectedReceiptDate);

  @Update("""
      update purchase_orders
      set status = #{status}, updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status);

  @Update("""
      update purchase_orders
      set expected_receipt_date = #{expectedReceiptDate},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status <> '已收货'
      """)
  int updateExpectedReceiptDate(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("expectedReceiptDate") LocalDate expectedReceiptDate);

  @Update("""
      update purchase_orders
      set delivery_address = coalesce(#{deliveryAddress,jdbcType=VARCHAR}, delivery_address),
          contact_name = coalesce(#{contactName,jdbcType=VARCHAR}, contact_name),
          contact_phone = coalesce(#{contactPhone,jdbcType=VARCHAR}, contact_phone),
          payment_terms = coalesce(#{paymentTerms,jdbcType=VARCHAR}, payment_terms),
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status <> '已收货'
      """)
  int updateOrderDetails(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("deliveryAddress") String deliveryAddress,
      @Param("contactName") String contactName,
      @Param("contactPhone") String contactPhone,
      @Param("paymentTerms") String paymentTerms);
}
