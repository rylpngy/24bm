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

  default List<VarianceHandling> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId) {
    return listVisible(tenantId, status, supplierId, orderId, invoiceId, com.procurement.identity.domain.DataScope.unrestricted());
  }

  @Select("""
      <script>
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at,
             order_line_id, line_description
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
      and order_id in (
      """ + FinanceScopeSql.ORDERS + """
      )
      order by updated_at desc, created_at desc
      </script>
      """)
  List<VarianceHandling> listVisible(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at,
             order_line_id, line_description
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
        owner_id, result, status, created_by, order_line_id, line_description
      )
      values (
        #{id}, #{tenantId}, #{invoiceId}, #{supplierId}, #{orderId}, #{varianceAmount}, #{reason},
        #{ownerId}, #{result}, #{status}, #{createdBy}, #{orderLineId,jdbcType=VARCHAR},
        #{lineDescription,jdbcType=VARCHAR}
      )
      on conflict (tenant_id, invoice_id) do update
        set variance_amount = excluded.variance_amount,
            reason = excluded.reason,
            owner_id = excluded.owner_id,
            result = excluded.result,
            status = excluded.status,
            order_line_id = excluded.order_line_id,
            line_description = excluded.line_description,
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
      @Param("createdBy") String createdBy,
      @Param("orderLineId") String orderLineId,
      @Param("lineDescription") String lineDescription);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, variance_amount, reason,
             owner_id, result, status, created_by, created_at, updated_at,
             order_line_id, line_description
      from variance_handlings
      where tenant_id = #{tenantId}
        and invoice_id = #{invoiceId}
      """)
  VarianceHandling findByTenantAndInvoice(@Param("tenantId") String tenantId, @Param("invoiceId") String invoiceId);
}
