package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentBlockResolution;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentBlockResolutionMapper {

  default List<PaymentBlockResolution> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("blockReason") String blockReason,
      @Param("resolutionStatus") String resolutionStatus,
      @Param("invoiceId") String invoiceId) {
    return listVisible(tenantId, paymentBatchNo, blockReason, resolutionStatus, invoiceId, com.procurement.identity.domain.DataScope.unrestricted());
  }

  @Select("""
      <script>
      select id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
             block_reason, resolution_status, resolution_action, next_step,
             handled_by, created_by, created_at, updated_at
      from payment_block_resolutions
      where tenant_id = #{tenantId}
      <if test="paymentBatchNo != null">
        and payment_batch_no = #{paymentBatchNo}
      </if>
      <if test="blockReason != null">
        and block_reason = #{blockReason}
      </if>
      <if test="resolutionStatus != null">
        and resolution_status = #{resolutionStatus}
      </if>
      <if test="invoiceId != null">
        and invoice_id = #{invoiceId}
      </if>
      and payment_batch_no in (
      """ + FinanceScopeSql.BATCHES + """
      )
      order by updated_at desc, created_at desc
      </script>
      """)
  List<PaymentBlockResolution> listVisible(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("blockReason") String blockReason,
      @Param("resolutionStatus") String resolutionStatus,
      @Param("invoiceId") String invoiceId,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Select("""
      select id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
             block_reason, resolution_status, resolution_action, next_step,
             handled_by, created_by, created_at, updated_at
      from payment_block_resolutions
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  PaymentBlockResolution findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into payment_block_resolutions (
        id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
        block_reason, resolution_status, resolution_action, next_step, handled_by, created_by
      )
      values (
        #{id}, #{tenantId}, #{paymentBatchNo}, #{paymentRequestId}, #{invoiceId}, #{supplierId},
        #{blockReason}, #{resolutionStatus}, #{resolutionAction}, #{nextStep}, #{handledBy}, #{createdBy}
      )
      on conflict (tenant_id, payment_batch_no, payment_request_id, block_reason) do update
        set invoice_id = excluded.invoice_id,
            supplier_id = excluded.supplier_id,
            resolution_status = excluded.resolution_status,
            resolution_action = excluded.resolution_action,
            next_step = excluded.next_step,
            handled_by = excluded.handled_by,
            updated_at = now()
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("paymentRequestId") String paymentRequestId,
      @Param("invoiceId") String invoiceId,
      @Param("supplierId") String supplierId,
      @Param("blockReason") String blockReason,
      @Param("resolutionStatus") String resolutionStatus,
      @Param("resolutionAction") String resolutionAction,
      @Param("nextStep") String nextStep,
      @Param("handledBy") String handledBy,
      @Param("createdBy") String createdBy);

  @Update("""
      update payment_block_resolutions
      set resolution_status = #{resolutionStatus},
          resolution_action = #{resolutionAction},
          next_step = #{nextStep},
          handled_by = #{handledBy},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("resolutionStatus") String resolutionStatus,
      @Param("resolutionAction") String resolutionAction,
      @Param("nextStep") String nextStep,
      @Param("handledBy") String handledBy);

  @Select("""
      select id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
             block_reason, resolution_status, resolution_action, next_step,
             handled_by, created_by, created_at, updated_at
      from payment_block_resolutions
      where tenant_id = #{tenantId}
        and payment_batch_no = #{paymentBatchNo}
        and (
          (payment_request_id = #{paymentRequestId})
          or (payment_request_id is null and #{paymentRequestId} is null)
        )
        and block_reason = #{blockReason}
      """)
  PaymentBlockResolution findByTenantAndNaturalKey(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("paymentRequestId") String paymentRequestId,
      @Param("blockReason") String blockReason);
}
