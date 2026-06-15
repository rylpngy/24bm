package com.procurement.order.infrastructure;

import com.procurement.order.domain.PurchaseOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PurchaseOrderMapper {

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  @Results(id = "listPurchaseOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<PurchaseOrder> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where tenant_id = #{tenantId}
        and (#{status} is null or status = #{status})
        and (#{supplierId} is null or supplier_id = #{supplierId})
        and (#{rfqId} is null or rfq_id = #{rfqId})
      order by created_at desc
      """)
  @Results(id = "filteredPurchaseOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<PurchaseOrder> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("supplierId") String supplierId,
      @Param("rfqId") String rfqId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId}
        and supplier_id = #{supplierId}
      """)
  @Results(id = "purchaseOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  PurchaseOrder findByAwardSource(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singlePurchaseOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  PurchaseOrder findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where id = #{id} and supplier_id = #{supplierId}
      """)
  @Results(id = "supplierPurchaseOrderResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  PurchaseOrder findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, status, expected_receipt_date, created_at, updated_at
      from purchase_orders
      where supplier_id = #{supplierId}
      order by created_at desc
      """)
  @Results(id = "supplierPurchaseOrderListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "expected_receipt_date", property = "expectedReceiptDate"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<PurchaseOrder> listBySupplier(@Param("supplierId") String supplierId);

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
}
