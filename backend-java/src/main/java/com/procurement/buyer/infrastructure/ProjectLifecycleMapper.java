package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectLifecycleContracts.*;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectLifecycleMapper {
  @Select(
      "select po.id from purchase_orders po where po.tenant_id=#{t} and exists(select 1 from"
          + " rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where rd.tenant_id=po.tenant_id and rd.rfq_id=po.rfq_id and"
          + " d.project_id=#{p}) order by po.id for update of po")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<String> lockOrders(@Param("t") String t, @Param("p") String p);

  String ROW =
      "select"
          + " id,tenant_id,project_id,kind,source_period,target_period,project_revision,reason,snapshot::text,amount,status,revision,workflow_instance_id,created_by,created_at,completed_by,completed_at"
          + " from procurement_project_lifecycle_requests ";

  @Select(ROW + "where tenant_id=#{t} and id=#{id}")
  Record find(@Param("t") String t, @Param("id") String id);

  @Select(
      ROW
          + "where tenant_id=#{t} and project_id=#{p} order by created_at desc,id limit #{size}"
          + " offset #{offset}")
  List<Record> page(
      @Param("t") String t,
      @Param("p") String p,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select(
      "select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p}")
  long count(@Param("t") String t, @Param("p") String p);

  @Select(
      "select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and status='submitted'")
  int pending(@Param("t") String t, @Param("p") String p);

  @Select(
      "select target_period from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and kind='carryover' and status='approved' order by target_period"
          + " desc limit 1")
  String period(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select b.department_id,b.period,b.source_type,b.source_id,b.pending,b.committed,b.order_amount,b.paid_amount
from budget_commitment_lines b where b.tenant_id=#{t} and (
  (b.source_type='demand' and exists(select 1 from procurement_project_demands d where d.tenant_id=b.tenant_id and d.project_id=#{p} and d.demand_id=b.source_id))
  or (b.source_type='rfq' and exists(select 1 from rfq_demands rd join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
    where rd.tenant_id=b.tenant_id and rd.rfq_id=b.source_id and d.project_id=#{p})))
order by b.source_type,b.source_id,b.department_id,b.period
""")
  List<Source> sources(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select count(*) from rfq_demands rd where rd.tenant_id=#{t} and exists(
  select 1 from rfq_demands own join procurement_project_demands p on p.tenant_id=own.tenant_id and p.demand_id=own.demand_id
  where own.tenant_id=rd.tenant_id and own.rfq_id=rd.rfq_id and p.project_id=#{p})
and not exists(select 1 from procurement_project_demands p where p.tenant_id=rd.tenant_id and p.demand_id=rd.demand_id and p.project_id=#{p})
""")
  int mixedSources(@Param("t") String t, @Param("p") String p);

  @Insert(
      "insert into"
          + " procurement_project_lifecycle_requests(id,tenant_id,project_id,kind,source_period,target_period,project_revision,reason,snapshot,amount,created_by)"
          + " values(#{id},#{t},#{p},#{kind},#{source},#{target},#{revision},#{reason},cast(#{snapshot}"
          + " as jsonb),#{amount},#{actor})")
  void insert(
      @Param("id") String id,
      @Param("t") String t,
      @Param("p") String p,
      @Param("kind") String kind,
      @Param("source") String source,
      @Param("target") String target,
      @Param("revision") int revision,
      @Param("reason") String reason,
      @Param("snapshot") String snapshot,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);

  @Update(
      "update procurement_project_lifecycle_requests set"
          + " workflow_instance_id=#{workflow},revision=revision+1 where tenant_id=#{t} and"
          + " id=#{id} and status='submitted' and workflow_instance_id is null")
  int bind(@Param("t") String t, @Param("id") String id, @Param("workflow") String workflow);

  @Update(
      "update procurement_project_lifecycle_requests set"
          + " status=#{status},completed_by=#{actor},completed_at=now(),revision=revision+1 where"
          + " tenant_id=#{t} and id=#{id} and revision=#{revision} and status='submitted'")
  int finish(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("actor") String actor);

  @Select(
      "select exists(select 1 from procurement_project_demands d join"
          + " procurement_project_lifecycle_requests r on r.tenant_id=d.tenant_id and"
          + " r.project_id=d.project_id where d.tenant_id=#{t} and d.demand_id=#{id} and"
          + " r.kind='carryover' and r.status='approved')")
  boolean carriedDemand(@Param("t") String t, @Param("id") String id);

  @Select(
      "select coalesce(c.target_period,to_char(d.created_at at time zone 'Asia/Shanghai','YYYY'))"
          + " from purchase_demands d left join procurement_project_demands p on"
          + " p.tenant_id=d.tenant_id and p.demand_id=d.id left join lateral(select target_period"
          + " from procurement_project_lifecycle_requests r where r.tenant_id=p.tenant_id and"
          + " r.project_id=p.project_id and r.kind='carryover' and r.status='approved' order by"
          + " target_period desc limit 1)c on true where d.tenant_id=#{t} and d.id=#{id}")
  String demandPeriod(@Param("t") String t, @Param("id") String id);
}
