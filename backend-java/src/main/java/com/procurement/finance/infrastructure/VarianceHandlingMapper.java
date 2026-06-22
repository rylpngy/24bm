package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.VarianceHandling;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface VarianceHandlingMapper {

  @Select("""
      <script>
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at
      from variance_handlings
      where tenant_id = #{tenantId}
      <if test="status != null">
        and status = #{status}
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
  List<VarianceHandling> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at
      from variance_handlings
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  VarianceHandling findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Update("""
      update variance_handlings
      set status = #{status},
          result = #{result},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("status") String status,
      @Param("result") String result);

  @Insert("""
      insert into variance_handlings (
        id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
        owner_id, result, status, created_by
      )
      values (
        #{id}, #{tenantId}, #{invoiceId}, #{supplierId}, #{orderId}, #{varianceAmount}, #{reason},
        #{ownerId}, #{result}, #{status}, #{createdBy}
      )
      on conflict (tenant_id, invoice_id) do update
        set variance_amount = excluded.variance_amount,
            reason = excluded.reason,
            owner_id = excluded.owner_id,
            result = excluded.result,
            status = excluded.status,
            updated_at = now()
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("varianceAmount") BigDecimal varianceAmount,
      @Param("reason") String reason,
      @Param("ownerId") String ownerId,
      @Param("result") String result,
      @Param("status") String status,
      @Param("createdBy") String createdBy);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at
      from variance_handlings
      where tenant_id = #{tenantId}
        and invoice_id = #{invoiceId}
      """)
  VarianceHandling findByTenantAndInvoice(@Param("tenantId") String tenantId, @Param("invoiceId") String invoiceId);
}
