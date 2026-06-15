package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.Invoice;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface InvoiceMapper {

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  @Results(id = "listInvoiceResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Invoice> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where tenant_id = #{tenantId}
        and (#{paymentStatus} is null or payment_status = #{paymentStatus})
        and (#{supplierId} is null or supplier_id = #{supplierId})
        and (#{orderId} is null or order_id = #{orderId})
      order by created_at desc
      """)
  @Results(id = "filteredInvoiceResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Invoice> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("paymentStatus") String paymentStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where supplier_id = #{supplierId}
      order by created_at desc
      """)
  @Results(id = "supplierInvoiceListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Invoice> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where supplier_id = #{supplierId}
        and (#{paymentStatus} is null or payment_status = #{paymentStatus})
        and (#{orderId} is null or order_id = #{orderId})
      order by created_at desc
      """)
  @Results(id = "supplierInvoiceFilteredListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Invoice> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("paymentStatus") String paymentStatus,
      @Param("orderId") String orderId);

  @Insert("""
      insert into invoices (id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status)
      values (#{id}, #{tenantId}, #{supplierId}, #{orderId}, #{amount}, #{invoiceNo}, #{paymentStatus})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("amount") BigDecimal amount,
      @Param("invoiceNo") String invoiceNo,
      @Param("paymentStatus") String paymentStatus);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "invoiceResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  Invoice findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, supplier_id, order_id, amount, invoice_no, payment_status, created_at, updated_at
      from invoices
      where supplier_id = #{supplierId} and id = #{id}
      """)
  @Results(id = "supplierInvoiceResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "invoice_no", property = "invoiceNo"),
      @Result(column = "payment_status", property = "paymentStatus"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
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
}
