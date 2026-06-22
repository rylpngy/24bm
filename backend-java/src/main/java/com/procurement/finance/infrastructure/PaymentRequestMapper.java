package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentRequest;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentRequestMapper {

  @Select("""
      <script>
      select id, tenant_id, invoice_id, supplier_id, order_id, amount, request_status,
             payment_batch_no, remark, created_by, created_at, updated_at
      from payment_requests
      where tenant_id = #{tenantId}
      <if test="requestStatus != null">
        and request_status = #{requestStatus}
      </if>
      <if test="supplierId != null">
        and supplier_id = #{supplierId}
      </if>
      <if test="orderId != null">
        and order_id = #{orderId}
      </if>
      <if test="invoiceId != null">
        and invoice_id = #{invoiceId}
      </if>
      order by updated_at desc, created_at desc
      </script>
      """)
  List<PaymentRequest> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("requestStatus") String requestStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, amount, request_status,
             payment_batch_no, remark, created_by, created_at, updated_at
      from payment_requests
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  PaymentRequest findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update payment_requests
      set request_status = #{requestStatus},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("requestStatus") String requestStatus);

  @Insert("""
      insert into payment_requests (
        id, tenant_id, invoice_id, supplier_id, order_id, amount, request_status,
        payment_batch_no, remark, created_by
      )
      values (
        #{id}, #{tenantId}, #{invoiceId}, #{supplierId}, #{orderId}, #{amount}, #{requestStatus},
        #{paymentBatchNo}, #{remark}, #{createdBy}
      )
      on conflict (tenant_id, invoice_id) do update
        set amount = excluded.amount,
            request_status = excluded.request_status,
            payment_batch_no = excluded.payment_batch_no,
            remark = excluded.remark,
            updated_at = now()
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("amount") BigDecimal amount,
      @Param("requestStatus") String requestStatus,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("remark") String remark,
      @Param("createdBy") String createdBy);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, amount, request_status,
             payment_batch_no, remark, created_by, created_at, updated_at
      from payment_requests
      where tenant_id = #{tenantId}
        and invoice_id = #{invoiceId}
      """)
  PaymentRequest findByTenantAndInvoice(@Param("tenantId") String tenantId, @Param("invoiceId") String invoiceId);
}
