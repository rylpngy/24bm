package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentArchiveExceptionRequestMapper {

  default List<PaymentArchiveExceptionRequest> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("approvalStatus") String approvalStatus,
      @Param("exceptionType") String exceptionType) {
    return listVisible(tenantId, paymentBatchNo, approvalStatus, exceptionType, com.procurement.identity.domain.DataScope.unrestricted());
  }

  @Select("""
      <script>
      select id, tenant_id, payment_batch_no, exception_type, exception_reason,
             approval_status, action_status, action_result, closure_status, closure_result, requested_by, reviewed_by, handled_by, closed_by,
             created_at, updated_at
      from payment_archive_exception_requests
      where tenant_id = #{tenantId}
      <if test="paymentBatchNo != null">
        and payment_batch_no = #{paymentBatchNo}
      </if>
      <if test="approvalStatus != null">
        and approval_status = #{approvalStatus}
      </if>
      <if test="exceptionType != null">
        and exception_type = #{exceptionType}
      </if>
      and payment_batch_no in (
      """ + FinanceScopeSql.BATCHES + """
      )
      order by updated_at desc, created_at desc
      </script>
      """)
  List<PaymentArchiveExceptionRequest> listVisible(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("approvalStatus") String approvalStatus,
      @Param("exceptionType") String exceptionType,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Insert("""
      insert into payment_archive_exception_requests (
        id, tenant_id, payment_batch_no, exception_type, exception_reason,
        approval_status, requested_by
      )
      values (
        #{id}, #{tenantId}, #{paymentBatchNo}, #{exceptionType}, #{exceptionReason},
        #{approvalStatus}, #{requestedBy}
      )
      on conflict (tenant_id, payment_batch_no, exception_type, approval_status) do update
        set exception_reason = excluded.exception_reason,
            action_status = '待处理',
            action_result = null,
            closure_status = '待关闭',
            closure_result = null,
            requested_by = excluded.requested_by,
            handled_by = null,
            closed_by = null,
            updated_at = now()
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("exceptionType") String exceptionType,
      @Param("exceptionReason") String exceptionReason,
      @Param("approvalStatus") String approvalStatus,
      @Param("requestedBy") String requestedBy);

  @Select("""
      select id, tenant_id, payment_batch_no, exception_type, exception_reason,
             approval_status, action_status, action_result, closure_status, closure_result, requested_by, reviewed_by, handled_by, closed_by,
             created_at, updated_at
      from payment_archive_exception_requests
      where tenant_id = #{tenantId}
        and payment_batch_no = #{paymentBatchNo}
        and exception_type = #{exceptionType}
        and approval_status = #{approvalStatus}
      """)
  PaymentArchiveExceptionRequest findByTenantAndNaturalKey(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("exceptionType") String exceptionType,
      @Param("approvalStatus") String approvalStatus);

  @Select("""
      select id, tenant_id, payment_batch_no, exception_type, exception_reason,
             approval_status, action_status, action_result, closure_status, closure_result, requested_by, reviewed_by, handled_by, closed_by,
             created_at, updated_at
      from payment_archive_exception_requests
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  PaymentArchiveExceptionRequest findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("id") String id);

  @Update("""
      update payment_archive_exception_requests
      set approval_status = #{targetStatus},
          reviewed_by = #{reviewedBy},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and approval_status = #{expectedStatus}
      """)
  int updateApprovalStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("expectedStatus") String expectedStatus,
      @Param("targetStatus") String targetStatus,
      @Param("reviewedBy") String reviewedBy);

  @Update("""
      update payment_archive_exception_requests
      set action_status = #{actionStatus},
          action_result = #{actionResult},
          handled_by = #{handledBy},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  int updateActionStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("actionStatus") String actionStatus,
      @Param("actionResult") String actionResult,
      @Param("handledBy") String handledBy);

  @Update("""
      update payment_archive_exception_requests
      set closure_status = #{closureStatus},
          closure_result = #{closureResult},
          closed_by = #{closedBy},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  int updateClosureStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("closureStatus") String closureStatus,
      @Param("closureResult") String closureResult,
      @Param("closedBy") String closedBy);
}
