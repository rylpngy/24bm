package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentExecutionRecord;
import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentExecutionRecordMapper {

  @Select("""
      <script>
      select id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
             registered_amount, planned_payment_date, execution_status, execution_trace,
             execution_block_reason, release_evidence_no, release_remark,
             created_by, created_at, updated_at
      from payment_execution_records
      where tenant_id = #{tenantId}
      <if test="paymentBatchNo != null">
        and payment_batch_no = #{paymentBatchNo}
      </if>
      <if test="executionStatus != null">
        and execution_status = #{executionStatus}
      </if>
      <if test="supplierId != null">
        and supplier_id = #{supplierId}
      </if>
      <if test="invoiceId != null">
        and invoice_id = #{invoiceId}
      </if>
      order by planned_payment_date nulls last, updated_at desc
      </script>
      """)
  List<PaymentExecutionRecord> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("executionStatus") String executionStatus,
      @Param("supplierId") String supplierId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      select id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
             registered_amount, planned_payment_date, execution_status, execution_trace,
             execution_block_reason, release_evidence_no, release_remark,
             created_by, created_at, updated_at
      from payment_execution_records
      where tenant_id = #{tenantId}
        and id = #{executionRecordId}
      """)
  PaymentExecutionRecord findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("executionRecordId") String executionRecordId);

  @Select("""
      select
        coalesce(sum(case when per.execution_status = '已登记付款' then per.registered_amount else 0 end), 0) as registered_amount,
        coalesce(sum(case when per.execution_status = '待登记付款' then coalesce(pr.amount, 0) else 0 end), 0) as pending_registration_amount,
        coalesce(sum(case when per.execution_status = '暂不可登记' then coalesce(pr.amount, 0) else 0 end), 0) as blocked_registration_amount,
        coalesce(sum(case when per.execution_status = '已登记付款' then 1 else 0 end), 0)::int as registered_count,
        coalesce(sum(case when per.execution_status = '待登记付款' then 1 else 0 end), 0)::int as pending_registration_count,
        coalesce(sum(case when per.execution_status = '暂不可登记' then 1 else 0 end), 0)::int as blocked_registration_count,
        case
          when count(per.id) = 0 then '暂无执行记录'
          when sum(case when per.execution_status = '暂不可登记' then 1 else 0 end) > 0 then '存在暂不可登记'
          when sum(case when per.execution_status = '待登记付款' then 1 else 0 end) > 0 then '可继续登记付款'
          else '批次付款已登记'
        end as execution_decision
      from payment_execution_records per
      left join payment_requests pr
        on pr.tenant_id = per.tenant_id
       and pr.id = per.payment_request_id
      where per.tenant_id = #{tenantId}
        and per.payment_batch_no = #{paymentBatchNo}
      """)
  Map<String, Object> summarizeByTenantAndBatch(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo);

  @Insert("""
      insert into payment_execution_records (
        id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
        registered_amount, planned_payment_date, execution_status, execution_trace,
        execution_block_reason, created_by
      )
      select
        #{id},
        pr.tenant_id,
        pr.payment_batch_no,
        pr.id,
        pr.invoice_id,
        pr.supplier_id,
        case when i.payment_status = '已付款' then pr.amount else 0 end,
        (i.created_at::date + interval '30 days')::date,
        case
          when i.payment_status = '已付款' then '已登记付款'
          when pr.request_status = '付款申请审批中' then '付款审批中'
          when pr.request_status <> '付款申请已通过' then '暂不可登记'
          when twm.id is null then '暂不可登记'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '暂不可登记'
          when twm.match_status <> '三单匹配通过' then '暂不可登记'
          else '待登记付款'
        end,
        case
          when i.payment_status = '已付款' then '发票已登记付款，仅记录付款登记轨迹，不接真实支付'
          when pr.request_status = '付款申请审批中' then '付款申请审批中，暂不可登记付款'
          when pr.request_status <> '付款申请已通过' then '付款申请未通过，暂不可登记付款'
          when twm.id is null then '三单未同步，暂不可登记付款'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '三单金额差异未处理，暂不可登记付款'
          when twm.match_status <> '三单匹配通过' then '三单未通过，暂不可登记付款'
          else '付款申请已通过且三单匹配通过，可进入线下付款登记'
        end,
        case
          when i.payment_status = '已付款' then '已登记付款'
          when pr.request_status = '付款申请审批中' then '付款申请审批中'
          when pr.request_status <> '付款申请已通过' then '付款申请未通过'
          when twm.id is null then '三单未同步'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '差异未处理'
          when twm.match_status <> '三单匹配通过' then '三单未通过'
          else '付款申请已通过'
        end,
        pr.created_by
      from payment_requests pr
      join invoices i
        on i.tenant_id = pr.tenant_id
       and i.id = pr.invoice_id
      left join three_way_matches twm
        on twm.tenant_id = pr.tenant_id
       and twm.invoice_id = pr.invoice_id
      left join variance_handlings vh
        on vh.tenant_id = pr.tenant_id
       and vh.invoice_id = pr.invoice_id
      where pr.tenant_id = #{tenantId}
        and pr.id = #{paymentRequestId}
      on conflict (tenant_id, payment_request_id) do update
        set payment_batch_no = excluded.payment_batch_no,
            invoice_id = excluded.invoice_id,
            supplier_id = excluded.supplier_id,
            registered_amount = excluded.registered_amount,
            planned_payment_date = excluded.planned_payment_date,
            execution_status = excluded.execution_status,
            execution_trace = excluded.execution_trace,
            execution_block_reason = excluded.execution_block_reason,
            updated_at = now()
      """)
  void upsertFromPaymentRequest(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("paymentRequestId") String paymentRequestId);

  @Update("""
      update payment_execution_records per
      set registered_amount = case when i.payment_status = '已付款' then pr.amount else 0 end,
          planned_payment_date = (i.created_at::date + interval '30 days')::date,
          execution_status = case
            when i.payment_status = '已付款' then '已登记付款'
            when pr.request_status = '付款申请审批中' then '付款审批中'
            when pr.request_status <> '付款申请已通过' then '暂不可登记'
            when twm.id is null then '暂不可登记'
            when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '暂不可登记'
            when twm.match_status <> '三单匹配通过' then '暂不可登记'
            else '待登记付款'
          end,
          execution_trace = case
            when i.payment_status = '已付款' then '发票已登记付款，仅记录付款登记轨迹，不接真实支付'
            when pr.request_status = '付款申请审批中' then '付款申请审批中，暂不可登记付款'
            when pr.request_status <> '付款申请已通过' then '付款申请未通过，暂不可登记付款'
            when twm.id is null then '三单未同步，暂不可登记付款'
            when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '三单金额差异未处理，暂不可登记付款'
            when twm.match_status <> '三单匹配通过' then '三单未通过，暂不可登记付款'
            else '付款申请已通过且三单匹配通过，可进入线下付款登记'
          end,
          execution_block_reason = case
            when i.payment_status = '已付款' then '已登记付款'
            when pr.request_status = '付款申请审批中' then '付款申请审批中'
            when pr.request_status <> '付款申请已通过' then '付款申请未通过'
            when twm.id is null then '三单未同步'
            when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '差异未处理'
            when twm.match_status <> '三单匹配通过' then '三单未通过'
            else '付款申请已通过'
          end,
          updated_at = now()
      from payment_requests pr
      join invoices i
        on i.tenant_id = pr.tenant_id
       and i.id = pr.invoice_id
      left join three_way_matches twm
        on twm.tenant_id = pr.tenant_id
       and twm.invoice_id = pr.invoice_id
      left join variance_handlings vh
        on vh.tenant_id = pr.tenant_id
       and vh.invoice_id = pr.invoice_id
      where per.tenant_id = #{tenantId}
        and per.id = #{executionRecordId}
        and pr.tenant_id = per.tenant_id
        and pr.id = per.payment_request_id
      """)
  int refreshByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("executionRecordId") String executionRecordId);

  @Update("""
      update payment_execution_records
      set release_evidence_no = #{releaseEvidenceNo},
          release_remark = #{releaseRemark},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{executionRecordId}
      """)
  int markReleaseEvidence(
      @Param("tenantId") String tenantId,
      @Param("executionRecordId") String executionRecordId,
      @Param("releaseEvidenceNo") String releaseEvidenceNo,
      @Param("releaseRemark") String releaseRemark);

  @Insert("""
      insert into payment_execution_records (
        id, tenant_id, payment_batch_no, payment_request_id, invoice_id, supplier_id,
        registered_amount, planned_payment_date, execution_status, execution_trace,
        execution_block_reason, created_by
      )
      select
        concat('payexec-', gen_random_uuid()),
        pr.tenant_id,
        pr.payment_batch_no,
        pr.id,
        pr.invoice_id,
        pr.supplier_id,
        case when i.payment_status = '已付款' then pr.amount else 0 end,
        (i.created_at::date + interval '30 days')::date,
        case
          when i.payment_status = '已付款' then '已登记付款'
          when pr.request_status = '付款申请审批中' then '付款审批中'
          when pr.request_status <> '付款申请已通过' then '暂不可登记'
          when twm.id is null then '暂不可登记'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '暂不可登记'
          when twm.match_status <> '三单匹配通过' then '暂不可登记'
          else '待登记付款'
        end,
        case
          when i.payment_status = '已付款' then '发票已登记付款，仅记录付款登记轨迹，不接真实支付'
          when pr.request_status = '付款申请审批中' then '付款申请审批中，暂不可登记付款'
          when pr.request_status <> '付款申请已通过' then '付款申请未通过，暂不可登记付款'
          when twm.id is null then '三单未同步，暂不可登记付款'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '三单金额差异未处理，暂不可登记付款'
          when twm.match_status <> '三单匹配通过' then '三单未通过，暂不可登记付款'
          else '付款申请已通过且三单匹配通过，可进入线下付款登记'
        end,
        case
          when i.payment_status = '已付款' then '已登记付款'
          when pr.request_status = '付款申请审批中' then '付款申请审批中'
          when pr.request_status <> '付款申请已通过' then '付款申请未通过'
          when twm.id is null then '三单未同步'
          when twm.match_status = '金额差异' and (vh.id is null or vh.status <> '已处理') then '差异未处理'
          when twm.match_status <> '三单匹配通过' then '三单未通过'
          else '付款申请已通过'
        end,
        pr.created_by
      from payment_requests pr
      join invoices i
        on i.tenant_id = pr.tenant_id
       and i.id = pr.invoice_id
      left join three_way_matches twm
        on twm.tenant_id = pr.tenant_id
       and twm.invoice_id = pr.invoice_id
      left join variance_handlings vh
        on vh.tenant_id = pr.tenant_id
       and vh.invoice_id = pr.invoice_id
      where pr.tenant_id = #{tenantId}
      on conflict (tenant_id, payment_request_id) do update
        set payment_batch_no = excluded.payment_batch_no,
            invoice_id = excluded.invoice_id,
            supplier_id = excluded.supplier_id,
            registered_amount = excluded.registered_amount,
            planned_payment_date = excluded.planned_payment_date,
            execution_status = excluded.execution_status,
            execution_trace = excluded.execution_trace,
            execution_block_reason = excluded.execution_block_reason,
            updated_at = now()
      """)
  void refreshTenantFromPaymentRequests(@Param("tenantId") String tenantId);
}
