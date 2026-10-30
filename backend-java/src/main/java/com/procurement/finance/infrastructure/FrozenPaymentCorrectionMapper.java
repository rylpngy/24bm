package com.procurement.finance.infrastructure;

import com.procurement.finance.api.FrozenPaymentCorrectionContracts.*;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FrozenPaymentCorrectionMapper {
  record Basis(
      String projectId,
      String departmentId,
      String rfqId,
      String sourcePeriod,
      String targetPeriod,
      int projectRevision,
      String projectStatus,
      int conflicts) {}

  @Select(
      """
select p.id project_id,p.department_id,o.rfq_id,min(r.source_period) source_period,
  (select max(c.target_period) from procurement_project_lifecycle_requests c where c.tenant_id=p.tenant_id and c.project_id=p.id and c.kind='carryover' and c.status='approved') target_period,
  p.revision project_revision,p.status project_status,
  (select count(*) from procurement_project_lifecycle_requests c where c.tenant_id=p.tenant_id and c.project_id=p.id and c.status='submitted')+
  (select count(*) from procurement_project_changes c where c.tenant_id=p.tenant_id and c.project_id=p.id and c.status='submitted')+
  (select count(*) from order_settlements s where s.tenant_id=o.tenant_id and s.order_id=o.id and s.status not in ('rejected','withdrawn'))+
  (select count(*) from contracts c where c.tenant_id=o.tenant_id and c.related_order_id=o.id and c.archive_status='已归档') conflicts
from invoices i join purchase_orders o on o.tenant_id=i.tenant_id and o.id=i.order_id
join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id
join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
join procurement_projects p on p.tenant_id=d.tenant_id and p.id=d.project_id
join procurement_project_lifecycle_requests r on r.tenant_id=p.tenant_id and r.project_id=p.id
  and r.kind='carryover' and r.status='approved' and jsonb_exists(r.snapshot->'paidEntryIds',#{entry})
where i.tenant_id=#{tenant} and i.id=#{invoice}
and not exists(select 1 from rfq_demands other where other.tenant_id=o.tenant_id and other.rfq_id=o.rfq_id
  and not exists(select 1 from procurement_project_demands own where own.tenant_id=other.tenant_id and own.demand_id=other.demand_id and own.project_id=p.id))
group by p.id,p.tenant_id,p.department_id,p.revision,p.status,o.rfq_id,o.tenant_id,o.id
""")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Basis> basis(
      @Param("tenant") String tenant,
      @Param("invoice") String invoice,
      @Param("entry") String entry);

  String ROW =
      "select"
          + " id,tenant_id,invoice_id,entry_id,request_key,project_id,department_id,rfq_id,source_period,target_period,amount,evidence_no,reason,snapshot::text,status,revision,workflow_instance_id,reversal_id,created_by,created_at,completed_by,completed_at"
          + " from frozen_payment_corrections ";

  @Select(ROW + "where tenant_id=#{tenant} and id=#{id}")
  Correction find(@Param("tenant") String tenant, @Param("id") String id);

  @Select(ROW + "where tenant_id=#{tenant} and invoice_id=#{invoice} and request_key=#{key}")
  Correction byKey(
      @Param("tenant") String tenant, @Param("invoice") String invoice, @Param("key") String key);

  @Select(
      ROW
          + "where tenant_id=#{tenant} and invoice_id=#{invoice} order by created_at desc,id limit"
          + " #{size} offset #{offset}")
  List<Correction> page(
      @Param("tenant") String tenant,
      @Param("invoice") String invoice,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select(
      "select count(*) from frozen_payment_corrections where tenant_id=#{tenant} and"
          + " invoice_id=#{invoice}")
  long count(@Param("tenant") String tenant, @Param("invoice") String invoice);

  @Select(
      "select exists(select 1 from frozen_payment_corrections where tenant_id=#{tenant} and"
          + " entry_id=#{entry} and status='submitted')")
  boolean active(@Param("tenant") String tenant, @Param("entry") String entry);

  @Select("select id from payment_requests where tenant_id=#{tenant} and invoice_id=#{invoice}")
  List<String> paymentRequests(@Param("tenant") String tenant, @Param("invoice") String invoice);

  @Select(
      "select paid_amount from budget_commitment_lines where tenant_id=#{tenant} and"
          + " department_id=#{department} and source_type='rfq' and source_id=#{rfq} and"
          + " period=#{period}")
  BigDecimal frozenAmount(
      @Param("tenant") String tenant,
      @Param("department") String department,
      @Param("rfq") String rfq,
      @Param("period") String period);

  @Insert(
      """
insert into frozen_payment_corrections(id,tenant_id,invoice_id,entry_id,request_key,project_id,department_id,rfq_id,source_period,target_period,amount,evidence_no,reason,snapshot,created_by)
values(#{id},#{tenantId},#{invoiceId},#{entryId},#{requestKey},#{projectId},#{departmentId},#{rfqId},#{sourcePeriod},#{targetPeriod},#{amount},#{evidenceNo},#{reason},cast(#{snapshot} as jsonb),#{createdBy})
""")
  void insert(Correction request);

  @Update(
      "update frozen_payment_corrections set workflow_instance_id=#{flow} where tenant_id=#{tenant}"
          + " and id=#{id} and workflow_instance_id is null and status='submitted'")
  int bind(@Param("tenant") String tenant, @Param("id") String id, @Param("flow") String flow);

  @Update(
      "update frozen_payment_corrections set"
          + " status=#{status},reversal_id=#{reversal},completed_by=#{actor},completed_at=now(),revision=revision+1"
          + " where tenant_id=#{tenant} and id=#{id} and revision=#{revision} and"
          + " status='submitted'")
  int finish(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("reversal") String reversal,
      @Param("actor") String actor);
}
