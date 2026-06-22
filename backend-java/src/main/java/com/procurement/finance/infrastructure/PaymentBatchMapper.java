package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.PaymentBatch;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PaymentBatchMapper {

  @Select("""
      <script>
      select pb.id, pb.tenant_id, pb.payment_batch_no, pb.supplier_id, pb.request_count, pb.total_amount,
             pb.approved_amount,
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
             end as execution_decision,
             coalesce(
               string_agg(distinct per.execution_block_reason, '、')
                 filter (
                   where per.execution_status in ('暂不可登记', '付款审批中')
                     and per.execution_block_reason is not null
                     and per.execution_block_reason not in ('付款申请已通过', '已登记付款')
                 ),
               '暂无阻断'
             ) as execution_block_summary,
             pb.batch_status, pb.planned_payment_date, pb.created_at, pb.updated_at
      from payment_batches pb
      left join payment_execution_records per
        on per.tenant_id = pb.tenant_id
       and per.payment_batch_no = pb.payment_batch_no
      left join payment_requests pr
        on pr.tenant_id = per.tenant_id
       and pr.id = per.payment_request_id
      where pb.tenant_id = #{tenantId}
      <if test="batchStatus != null">
        and pb.batch_status = #{batchStatus}
      </if>
      <if test="supplierId != null">
        and pb.supplier_id = #{supplierId}
      </if>
      group by pb.id, pb.tenant_id, pb.payment_batch_no, pb.supplier_id, pb.request_count,
               pb.total_amount, pb.approved_amount, pb.batch_status, pb.planned_payment_date,
               pb.created_at, pb.updated_at
      order by pb.planned_payment_date nulls last, pb.updated_at desc
      </script>
      """)
  List<PaymentBatch> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("batchStatus") String batchStatus,
      @Param("supplierId") String supplierId);

  @Select("""
      select pb.id, pb.tenant_id, pb.payment_batch_no, pb.supplier_id, pb.request_count, pb.total_amount,
             pb.approved_amount,
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
             end as execution_decision,
             coalesce(
               string_agg(distinct per.execution_block_reason, '、')
                 filter (
                   where per.execution_status in ('暂不可登记', '付款审批中')
                     and per.execution_block_reason is not null
                     and per.execution_block_reason not in ('付款申请已通过', '已登记付款')
                 ),
               '暂无阻断'
             ) as execution_block_summary,
             pb.batch_status, pb.planned_payment_date, pb.created_at, pb.updated_at
      from payment_batches pb
      left join payment_execution_records per
        on per.tenant_id = pb.tenant_id
       and per.payment_batch_no = pb.payment_batch_no
      left join payment_requests pr
        on pr.tenant_id = per.tenant_id
       and pr.id = per.payment_request_id
      where pb.tenant_id = #{tenantId}
        and pb.payment_batch_no = #{paymentBatchNo}
      group by pb.id, pb.tenant_id, pb.payment_batch_no, pb.supplier_id, pb.request_count,
               pb.total_amount, pb.approved_amount, pb.batch_status, pb.planned_payment_date,
               pb.created_at, pb.updated_at
      """)
  PaymentBatch findByTenantAndPaymentBatchNo(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo);

  @Insert("""
      insert into payment_batches (
        id, tenant_id, payment_batch_no, supplier_id, request_count, total_amount,
        approved_amount, batch_status, planned_payment_date
      )
      select
        #{id},
        pr.tenant_id,
        pr.payment_batch_no,
        case when count(distinct pr.supplier_id) = 1 then min(pr.supplier_id) else null end,
        count(*)::int,
        coalesce(sum(pr.amount), 0),
        coalesce(sum(case when pr.request_status = '付款申请已通过' then pr.amount else 0 end), 0),
        case
          when count(*) = sum(case when pr.request_status = '付款申请已通过' then 1 else 0 end) then '可安排付款'
          when sum(case when pr.request_status = '付款申请审批中' then 1 else 0 end) > 0 then '审批中'
          else '待提交审批'
        end,
        min((i.created_at::date + interval '30 days')::date)
      from payment_requests pr
      left join invoices i
        on i.tenant_id = pr.tenant_id
       and i.id = pr.invoice_id
      where pr.tenant_id = #{tenantId}
        and pr.payment_batch_no = #{paymentBatchNo}
      group by pr.tenant_id, pr.payment_batch_no
      on conflict (tenant_id, payment_batch_no) do update
        set supplier_id = excluded.supplier_id,
            request_count = excluded.request_count,
            total_amount = excluded.total_amount,
            approved_amount = excluded.approved_amount,
            batch_status = excluded.batch_status,
            planned_payment_date = excluded.planned_payment_date,
            updated_at = now()
      """)
  void upsertFromPaymentRequests(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo);

  @Update("""
      update payment_batches
      set batch_status = #{batchStatus},
          updated_at = now()
      where tenant_id = #{tenantId}
        and payment_batch_no = #{paymentBatchNo}
      """)
  void updateStatus(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo,
      @Param("batchStatus") String batchStatus);

  @Delete("""
      delete from payment_batches pb
      where pb.tenant_id = #{tenantId}
        and pb.payment_batch_no = #{paymentBatchNo}
        and not exists (
          select 1
          from payment_requests pr
          where pr.tenant_id = pb.tenant_id
            and pr.payment_batch_no = pb.payment_batch_no
        )
      """)
  void deleteIfEmpty(
      @Param("tenantId") String tenantId,
      @Param("paymentBatchNo") String paymentBatchNo);
}
