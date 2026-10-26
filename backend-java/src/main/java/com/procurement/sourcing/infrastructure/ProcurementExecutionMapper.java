package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.ProcurementExecutionArchive;
import java.util.List;
import org.apache.ibatis.annotations.*;

/** Read-only projections across business tables; no foreign infrastructure dependencies. */
@Mapper
public interface ProcurementExecutionMapper {
  @Select("select id from rfqs where tenant_id=#{tenant} and id=#{rfq} for update")
  String lockRfq(@Param("tenant") String tenant, @Param("rfq") String rfq);

  @Select("""
      with r as (select id,title,status,awarded_supplier_id as "awardedSupplierId",owner_id as "ownerId",
                        updated_at as "updatedAt",method,deadline_at as "deadlineAt"
                 from rfqs where tenant_id=#{tenant} and id=#{rfq}),
      d as (select pd.id,pd.title,pd.status,pd.budget,pd.department_id as "departmentId",
                   pd.requester_id as "requesterId",pd.updated_at as "updatedAt",pd.created_at as "createdAt",
                   pd.purpose,pd.priority,pd.expected_delivery_date as "expectedDeliveryDate",pd.source
            from purchase_demands pd join rfq_demands rd on rd.tenant_id=pd.tenant_id and rd.demand_id=pd.id
            where rd.tenant_id=#{tenant} and rd.rfq_id=#{rfq}),
      di as (select items.id,items.demand_id as "demandId",items.material_id as "materialId",items.quantity,
                    m.code as "materialCode",m.name as "materialName",m.unit as "materialUnit"
             from purchase_demand_items items join d on d.id=items.demand_id
             left join materials m on m.tenant_id=items.tenant_id and m.id=items.material_id where items.tenant_id=#{tenant}),
      o as (select id,rfq_id as "rfqId",supplier_id as "supplierId",amount,status,
                   expected_receipt_date as "expectedReceiptDate",updated_at as "updatedAt"
            from purchase_orders where tenant_id=#{tenant} and rfq_id=#{rfq}),
      ol as (select l.id,l.order_id as "orderId",l.description,l.unit,l.quantity,l.unit_price as "unitPrice",
                    l.line_amount as "lineAmount",l.sort_no as "sortNo",l.reserved_stock_qty as "reservedStockQty"
             from order_line_items l join o on o.id=l.order_id where l.tenant_id=#{tenant}),
      rec as (select a.id,a.order_id as "orderId",a.receiver_id as "receiverId",a.result,
                     a.received_quantity as "receivedQuantity",a.qualified_quantity as "qualifiedQuantity",
                     a.inspection_conclusion as "inspectionConclusion",a.disposition,a.disposition_note as "dispositionNote",
                     a.quality_note as "qualityNote",a.received_at as "receivedAt"
              from receipts a join o on o.id=a.order_id where a.tenant_id=#{tenant}),
      rl as (select l.id,l.receipt_id as "receiptId",l.order_line_id as "orderLineId",l.description,l.unit,
                    l.ordered_quantity as "orderedQuantity",l.received_quantity as "receivedQuantity",
                    l.qualified_quantity as "qualifiedQuantity",l.sort_no as "sortNo"
             from receipt_line_items l join rec on rec.id=l.receipt_id where l.tenant_id=#{tenant}),
      dr as (select review.receipt_id as "receiptId",review.decision,review.reason,review.evidence_no as "evidenceNo",
                    review.reviewed_by as "reviewedBy",review.reviewed_at as "reviewedAt"
             from receipt_disposition_reviews review join rec on rec.id=review.receipt_id where review.tenant_id=#{tenant}),
      c as (select c.id,c.contract_no as "contractNo",c.contract_name as "contractName",c.related_order_id as "relatedOrderId",
                   c.supplier_id as "supplierId",c.amount,c.status,c.archive_status as "archiveStatus",
                   c.effective_date as "effectiveDate",c.updated_at as "updatedAt",c.payment_terms as "paymentTerms",
                   c.warranty_terms as "warrantyTerms",c.sign_date as "signDate",c.expiry_date as "expiryDate"
            from contracts c join o on o.id=c.related_order_id where c.tenant_id=#{tenant}),
      i as (select i.id,i.order_id as "orderId",i.supplier_id as "supplierId",i.amount,i.invoice_no as "invoiceNo",
                   i.payment_status as "paymentStatus",i.updated_at as "updatedAt",i.invoice_code as "invoiceCode",
                   i.invoice_date as "invoiceDate",i.tax_rate as "taxRate"
            from invoices i join o on o.id=i.order_id where i.tenant_id=#{tenant}),
      il as (select l.id,l.invoice_id as "invoiceId",l.order_line_id as "orderLineId",l.description,l.quantity,
                    l.unit_price as "unitPrice",l.line_amount as "lineAmount"
             from invoice_line_items l join i on i.id=l.invoice_id where l.tenant_id=#{tenant}),
      p as (select p.id,p.invoice_id as "invoiceId",p.amount,p.reversal_of as "reversalOf",p.milestone_id as "milestoneId",
                   p.evidence_no as "evidenceNo",p.remark,p.created_by as "createdBy",p.created_at as "createdAt"
            from invoice_payment_entries p join i on i.id=p.invoice_id where p.tenant_id=#{tenant}),
      v as (select v.id,v.invoice_id as "invoiceId",v.order_id as "orderId",v.variance_amount as "varianceAmount",
                   v.reason,v.result,v.status,v.owner_id as "ownerId",v.updated_at as "updatedAt"
            from variance_handlings v join o on o.id=v.order_id where v.tenant_id=#{tenant}),
      recon as (select a.id,a.invoice_id as "invoiceId",a.stage,a.next_action as "nextAction",a.updated_at as "updatedAt"
                from invoice_reconciliations a join o on o.id=a.order_id where a.tenant_id=#{tenant}),
      q as (select id,supplier_id as "supplierId",amount,tax_rate as "taxRate",delivery_days as "deliveryDays",status,round,
                   submitted_at as "submittedAt" from quotes where tenant_id=#{tenant} and rfq_id=#{rfq}),
      ql as (select l.id,l.quote_id as "quoteId",l.description,l.unit,l.quantity,l.unit_price as "unitPrice",l.line_amount as "lineAmount"
             from quote_line_items l join q on q.id=l.quote_id where l.tenant_id=#{tenant}),
      aw as (select id,quote_id as "quoteId",supplier_id as "supplierId",amount,reason,approved_status as "approvedStatus",
                    created_at as "createdAt" from award_decisions where tenant_id=#{tenant} and rfq_id=#{rfq}),
      pr as (select p.id,p.invoice_id as "invoiceId",p.order_id as "orderId",p.amount,p.request_status as "requestStatus",
                    p.payment_batch_no as "paymentBatchNo",p.remark,p.updated_at as "updatedAt"
             from payment_requests p join o on o.id=p.order_id where p.tenant_id=#{tenant}),
      ap as (select a.id,a.biz_type as "bizType",a.biz_id as "bizId",a.assignee_id as "assigneeId",a.status,
                    a.acted_at as "actedAt",a.created_at as "createdAt",a.review_comment as "reviewComment"
             from approval_tasks a where a.tenant_id=#{tenant}
             and (a.biz_id=#{rfq} or a.biz_id in (select id from d union select id from aw union select id from c union select id from pr)))
      select jsonb_build_object(
        'rfq',(select to_jsonb(r) from r),
        'demands',coalesce((select jsonb_agg(to_jsonb(d) order by id) from d),'[]'::jsonb),
        'demandItems',coalesce((select jsonb_agg(to_jsonb(di) order by id) from di),'[]'::jsonb),
        'orders',coalesce((select jsonb_agg(to_jsonb(o) order by id) from o),'[]'::jsonb),
        'orderCancellations',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'orderId',x.order_id,'status',x.status,'reason',x.reason,'createdBy',x.created_by,'createdAt',x.created_at,'completedBy',x.completed_by,'completedAt',x.completed_at,'response',x.response) order by x.created_at,x.id) from order_cancellation_requests x join o on o.id=x.order_id where x.tenant_id=#{tenant}),'[]'::jsonb),
        'orderLines',coalesce((select jsonb_agg(to_jsonb(ol) order by id) from ol),'[]'::jsonb),
        'receipts',coalesce((select jsonb_agg(to_jsonb(rec) order by id) from rec),'[]'::jsonb),
        'receiptLines',coalesce((select jsonb_agg(to_jsonb(rl) order by id) from rl),'[]'::jsonb),
        'dispositionReviews',coalesce((select jsonb_agg(to_jsonb(dr) order by "receiptId") from dr),'[]'::jsonb),
        'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by id) from c),'[]'::jsonb),
        'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by id) from i),'[]'::jsonb),
        'invoiceLines',coalesce((select jsonb_agg(to_jsonb(il) order by id) from il),'[]'::jsonb),
        'payments',coalesce((select jsonb_agg(to_jsonb(p) order by id) from p),'[]'::jsonb),
        'variances',coalesce((select jsonb_agg(to_jsonb(v) order by id) from v),'[]'::jsonb),
        'reconciliations',coalesce((select jsonb_agg(to_jsonb(recon) order by id) from recon),'[]'::jsonb),
        'quotes',coalesce((select jsonb_agg(to_jsonb(q) order by id) from q),'[]'::jsonb),
        'quoteLines',coalesce((select jsonb_agg(to_jsonb(ql) order by id) from ql),'[]'::jsonb),
        'awards',coalesce((select jsonb_agg(to_jsonb(aw) order by id) from aw),'[]'::jsonb),
        'paymentRequests',coalesce((select jsonb_agg(to_jsonb(pr) order by id) from pr),'[]'::jsonb),
        'legacyApprovals',coalesce((select jsonb_agg(to_jsonb(ap) order by id) from ap),'[]'::jsonb)
      )::text from r
      """)
  String snapshot(@Param("tenant") String tenant, @Param("rfq") String rfq);

  @Select("""
      select distinct reason from (
        select '订单 ' || o.id || '：' || f.blocking_reason as reason
        from purchase_orders o join finance_fulfillment_checks f on f.tenant_id=o.tenant_id and f.order_id=o.id
        where o.tenant_id=#{tenant} and o.rfq_id=#{rfq} and f.blocking_reason is not null
        and not (o.status='已取消' and exists(select 1 from order_cancellation_requests c where c.tenant_id=o.tenant_id and c.order_id=o.id and c.status='accepted'))
        union all
        select '发票 ' || i.id || '：' || f.blocking_reason
        from purchase_orders o join invoices i on i.tenant_id=o.tenant_id and i.order_id=o.id
        join finance_invoice_closeout_checks f on f.tenant_id=i.tenant_id and f.invoice_id=i.id
        where o.tenant_id=#{tenant} and o.rfq_id=#{rfq} and f.blocking_reason is not null
        union all
        select '合同 ' || c.id || '：' || f.blocking_reason
        from purchase_orders o join contracts c on c.tenant_id=o.tenant_id and c.related_order_id=o.id
        join contract_closeout_checks f on f.tenant_id=c.tenant_id and f.contract_id=c.id
        where o.tenant_id=#{tenant} and o.rfq_id=#{rfq} and f.blocking_reason is not null
      ) checks order by reason
      """)
  List<String> closeoutBlockers(@Param("tenant") String tenant, @Param("rfq") String rfq);

  @Select("""
      select id,tenant_id,rfq_id,snapshot::text as snapshot,sha256,created_by,created_at,remark,null::bytea as zip_data
      from procurement_execution_archives where tenant_id=#{tenant} and rfq_id=#{rfq} order by created_at desc,id
      """)
  List<ProcurementExecutionArchive> archives(@Param("tenant") String tenant, @Param("rfq") String rfq);

  @Select("""
      select id,tenant_id,rfq_id,snapshot::text as snapshot,sha256,created_by,created_at,remark,zip_data
      from procurement_execution_archives where tenant_id=#{tenant} and rfq_id=#{rfq} and id=#{id}
      """)
  ProcurementExecutionArchive archive(@Param("tenant") String tenant, @Param("rfq") String rfq, @Param("id") String id);

  @Insert("""
      insert into procurement_execution_archives(id,tenant_id,rfq_id,snapshot,sha256,created_by,created_at,remark,zip_data)
      values(#{id},#{tenantId},#{rfqId},#{snapshot}::jsonb,#{sha256},#{createdBy},#{createdAt},#{remark},#{zipData})
      """)
  void insert(ProcurementExecutionArchive archive);
}
