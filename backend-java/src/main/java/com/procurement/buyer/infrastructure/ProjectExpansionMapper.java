package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectExpansionContracts.*;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectExpansionMapper {
  String LOT =
      "select"
          + " id,tenant_id,project_id,title,status,revision,project_revision,amount,lines::text,snapshot::text,created_by,created_at"
          + " from procurement_project_packages ";

  @Select(LOT + "where tenant_id=#{t} and project_id=#{p} order by created_at,id")
  List<PackageRow> packages(@Param("t") String t, @Param("p") String p);

  @Select(LOT + "where tenant_id=#{t} and id=#{id}")
  PackageRow lot(@Param("t") String t, @Param("id") String id);

  @Insert(
      "insert into"
          + " procurement_project_packages(id,tenant_id,project_id,title,project_revision,amount,lines,snapshot,created_by)"
          + " values(#{id},#{t},#{p},#{title},#{version},#{amount},cast(#{lines} as"
          + " jsonb),cast(#{snapshot} as jsonb),#{actor})")
  void insertLot(
      @Param("t") String t,
      @Param("p") String p,
      @Param("id") String id,
      @Param("title") String title,
      @Param("version") int version,
      @Param("amount") BigDecimal amount,
      @Param("lines") String lines,
      @Param("snapshot") String snapshot,
      @Param("actor") String actor);

  @Update(
      "update procurement_project_packages set"
          + " title=#{title},project_revision=#{version},amount=#{amount},lines=cast(#{lines} as"
          + " jsonb),snapshot=cast(#{snapshot} as jsonb),revision=revision+1,updated_at=now() where"
          + " tenant_id=#{t} and id=#{id} and revision=#{revision} and status='draft'")
  int editLot(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("title") String title,
      @Param("version") int version,
      @Param("amount") BigDecimal amount,
      @Param("lines") String lines,
      @Param("snapshot") String snapshot);

  @Update(
      "update procurement_project_packages set"
          + " status=#{status},revision=revision+1,updated_at=now() where tenant_id=#{t} and"
          + " id=#{id} and revision=#{revision}")
  int lotState(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status);

  @Select(
      "select demand_id from procurement_project_package_demands where tenant_id=#{t} and"
          + " package_id=#{id} order by demand_id")
  List<String> lotDemands(@Param("t") String t, @Param("id") String id);

  @Select(
      "select package_id from procurement_project_package_demands where tenant_id=#{t} and"
          + " demand_id=#{id}")
  String demandLot(@Param("t") String t, @Param("id") String id);

  @Insert(
      "insert into procurement_project_package_demands(tenant_id,package_id,demand_id)"
          + " values(#{t},#{lot},#{demand})")
  void link(@Param("t") String t, @Param("lot") String lot, @Param("demand") String demand);

  String RUN =
      "select"
          + " id,tenant_id,project_id,package_id,execution_type,execution_id,status,reason,created_by,created_at"
          + " from procurement_project_executions ";

  @Select(RUN + "where tenant_id=#{t} and package_id=#{id} order by created_at,id")
  List<Run> runs(@Param("t") String t, @Param("id") String id);

  @Select(RUN + "where tenant_id=#{t} and execution_type=#{type} and execution_id=#{id}")
  Run run(@Param("t") String t, @Param("type") String type, @Param("id") String id);

  @Insert(
      "insert into"
          + " procurement_project_executions(id,tenant_id,project_id,package_id,execution_type,execution_id,created_by)"
          + " values(#{id},#{t},#{p},#{lot},#{type},#{execution},#{actor})")
  void insertRun(
      @Param("t") String t,
      @Param("p") String p,
      @Param("lot") String lot,
      @Param("id") String id,
      @Param("type") String type,
      @Param("execution") String execution,
      @Param("actor") String actor);

  @Update(
      "update procurement_project_executions set status='abandoned',reason=#{reason} where"
          + " tenant_id=#{t} and id=#{id} and status='active'")
  int abandon(@Param("t") String t, @Param("id") String id, @Param("reason") String reason);

  @Select("select status from rfqs where tenant_id=#{t} and id=#{id}")
  String rfqStatus(@Param("t") String t, @Param("id") String id);

  @Select("select status from tenders where tenant_id=#{t} and id=#{id}")
  String tenderStatus(@Param("t") String t, @Param("id") String id);

  @Select("select count(*) from purchase_orders where tenant_id=#{t} and rfq_id=#{id}")
  int rfqOrders(@Param("t") String t, @Param("id") String id);

  @Select("select owner_id from rfqs where tenant_id=#{t} and id=#{id}")
  String rfqOwner(@Param("t") String t, @Param("id") String id);

  @Select(
      "select"
          + " coalesce(jsonb_agg(jsonb_build_object('materialId',material_id,'quantity',quantity)),'[]'::jsonb)::text"
          + " from purchase_demand_items where tenant_id=#{t} and demand_id=#{id}")
  String demandLines(@Param("t") String t, @Param("id") String id);

  @Select(
      "select snapshot::text from procurement_project_legacy_baselines where tenant_id=#{t} and"
          + " execution_type=#{type} and execution_id=#{id}")
  String baseline(@Param("t") String t, @Param("type") String type, @Param("id") String id);

  @Select(
      "select demand_ids::text from procurement_project_legacy_baselines where tenant_id=#{t} and"
          + " execution_type=#{type} and execution_id=#{id}")
  String baselineDemands(@Param("t") String t, @Param("type") String type, @Param("id") String id);

  @Insert(
      "insert into"
          + " procurement_project_legacy_baselines(tenant_id,project_id,execution_type,execution_id,snapshot,demand_ids)"
          + " values(#{t},#{p},#{type},#{id},cast(#{snapshot} as jsonb),cast(#{demands} as jsonb))"
          + " on conflict do nothing")
  void insertBaseline(
      @Param("t") String t,
      @Param("p") String p,
      @Param("type") String type,
      @Param("id") String id,
      @Param("snapshot") String snapshot,
      @Param("demands") String demands);

  @Select(
      "select e.* from procurement_project_executions e left join tenders t on"
          + " e.execution_type='tender' and t.tenant_id=e.tenant_id and t.id=e.execution_id left"
          + " join purchase_orders o on o.tenant_id=t.tenant_id and o.id=t.execution_order_id where"
          + " e.tenant_id=#{t} and ((e.execution_type='rfq' and e.execution_id=#{rfq}) or"
          + " o.rfq_id=#{rfq})")
  Run runForRfq(@Param("t") String t, @Param("rfq") String rfq);

  String CHANGE =
      "select"
          + " id,tenant_id,project_id,based_revision,before_snapshot::text,proposal::text,amount,reason,status,revision,workflow_instance_id,result_revision,created_by,created_at"
          + " from procurement_project_changes ";

  @Select(CHANGE + "where tenant_id=#{t} and id=#{id}")
  Change change(@Param("t") String t, @Param("id") String id);

  @Select(
      CHANGE
          + "where tenant_id=#{t} and project_id=#{p} order by created_at desc,id limit #{size}"
          + " offset #{offset}")
  List<Change> changes(
      @Param("t") String t,
      @Param("p") String p,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select(
      "select count(*) from procurement_project_changes where tenant_id=#{t} and project_id=#{p}")
  long changeCount(@Param("t") String t, @Param("p") String p);

  @Select(
      "select count(*) from procurement_project_changes where tenant_id=#{t} and project_id=#{p}"
          + " and status='submitted'")
  int pending(@Param("t") String t, @Param("p") String p);

  @Select(
      "select count(*) from procurement_project_changes where tenant_id=#{t} and project_id=#{p}"
          + " and status in ('draft','submitted')")
  int openChanges(@Param("t") String t, @Param("p") String p);

  @Insert(
      "insert into"
          + " procurement_project_changes(id,tenant_id,project_id,based_revision,before_snapshot,proposal,amount,reason,created_by)"
          + " values(#{id},#{t},#{p},#{base},cast(#{before} as jsonb),cast(#{proposal} as"
          + " jsonb),#{amount},#{reason},#{actor})")
  void insertChange(
      @Param("t") String t,
      @Param("p") String p,
      @Param("id") String id,
      @Param("base") int base,
      @Param("before") String before,
      @Param("proposal") String proposal,
      @Param("amount") BigDecimal amount,
      @Param("reason") String reason,
      @Param("actor") String actor);

  @Update(
      "update procurement_project_changes set proposal=cast(#{proposal} as"
          + " jsonb),amount=#{amount},reason=#{reason},status='draft',revision=revision+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and revision=#{revision} and status in"
          + " ('draft','rejected','withdrawn')")
  int editChange(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("proposal") String proposal,
      @Param("amount") BigDecimal amount,
      @Param("reason") String reason);

  @Update(
      "update procurement_project_changes set"
          + " status=#{status},workflow_instance_id=coalesce(#{workflow,jdbcType=VARCHAR},workflow_instance_id),result_revision=#{result,jdbcType=INTEGER},revision=revision+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and revision=#{revision}")
  int changeState(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("workflow") String workflow,
      @Param("result") Integer result);

  @Update(
      "update procurement_projects set"
          + " title=#{d.title},department_id=#{d.departmentId},owner_id=#{d.ownerId},period=#{d.period},funding_source=#{d.fundingSource},purpose=#{d.purpose},planned_amount=#{amount},revision=revision+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{p} and revision=#{revision} and status='approved'")
  int apply(
      @Param("t") String t,
      @Param("p") String p,
      @Param("revision") int revision,
      @Param("d") com.procurement.buyer.api.ProjectContracts.Draft d,
      @Param("amount") BigDecimal amount);

  @Select(
      CHANGE
          + "where tenant_id=#{t} and project_id=#{p} and status='approved' and"
          + " result_revision<=#{revision} order by result_revision,id")
  List<Change> approvedChanges(
      @Param("t") String t, @Param("p") String p, @Param("revision") int revision);
}
