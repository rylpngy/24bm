package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProcurementProjectMapper {
  String COLS =
      "p.id,p.tenant_id,p.project_no,p.title,p.department_id,p.owner_id,p.period,p.funding_source,p.purpose,p.planned_amount,p.status,p.revision,p.created_by,p.workflow_instance_id,p.execution_type,p.execution_id,p.closeout_reason,p.created_at,p.updated_at,d.name"
          + " department_name,u.name owner_name";
  String FROM =
      " from procurement_projects p join departments d on d.id=p.department_id and"
          + " d.tenant_id=p.tenant_id join users u on u.id=p.owner_id and u.tenant_id=p.tenant_id ";
  String SCOPE =
      "<if test='scope.restricted'> <choose><when test='scope.requesterId != null'>and"
          + " p.created_by=#{scope.requesterId}</when><when"
          + " test='!scope.departmentIds.isEmpty()'>and p.department_id in <foreach"
          + " collection='scope.departmentIds' item='dept' open='(' separator=','"
          + " close=')'>#{dept}</foreach></when><otherwise>and false</otherwise></choose></if>";
  String FILTER =
      "where p.tenant_id=#{tenant} and (#{status}='' or p.status=#{status}) and (#{keyword}='' or"
          + " strpos(lower(concat_ws('"
          + " ',p.project_no,p.title,p.funding_source)),lower(#{keyword}))>0) "
          + SCOPE;

  @Select(
      "<script>select "
          + COLS
          + FROM
          + FILTER
          + " order by p.created_at desc,p.id limit #{size} offset #{offset}</script>")
  List<Project> list(
      @Param("tenant") String tenant,
      @Param("scope") DataScope scope,
      @Param("status") String status,
      @Param("keyword") String keyword,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select("<script>select count(*) " + FROM + FILTER + "</script>")
  long count(
      @Param("tenant") String tenant,
      @Param("scope") DataScope scope,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select("select " + COLS + FROM + "where p.tenant_id=#{tenant} and p.id=#{id}")
  Project find(@Param("tenant") String tenant, @Param("id") String id);

  @Select("select id from tenants where id=#{tenant} for update")
  String lock(@Param("tenant") String tenant);

  @Select(
      "select exists(select 1 from users u join departments d on d.id=u.department_id and"
          + " d.tenant_id=u.tenant_id where u.tenant_id=#{tenant} and u.id=#{owner} and"
          + " u.status='active' and u.department_id=#{department} and d.status='active')")
  boolean validOwner(
      @Param("tenant") String tenant,
      @Param("department") String department,
      @Param("owner") String owner);

  @Insert(
      "insert into"
          + " procurement_projects(id,tenant_id,project_no,title,department_id,owner_id,period,funding_source,purpose,planned_amount,created_by)"
          + " values(#{id},#{tenant},#{number},#{draft.title},#{draft.departmentId},#{draft.ownerId},#{draft.period},#{draft.fundingSource},#{draft.purpose},#{amount},#{actor})")
  void insert(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("number") String number,
      @Param("draft") Draft draft,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);

  @Update(
      "update procurement_projects set"
          + " title=#{draft.title},department_id=#{draft.departmentId},owner_id=#{draft.ownerId},period=#{draft.period},funding_source=#{draft.fundingSource},purpose=#{draft.purpose},planned_amount=#{amount},status='draft',revision=revision+1,updated_at=now()"
          + " where tenant_id=#{tenant} and id=#{id} and revision=#{draft.revision}")
  int edit(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("draft") Draft draft,
      @Param("amount") BigDecimal amount);

  @Select(
      "select id,material_id,name,specification,unit,quantity,unit_price,purpose from"
          + " procurement_project_lines where tenant_id=#{tenant} and project_id=#{id} order by id")
  List<Line> lines(@Param("tenant") String tenant, @Param("id") String id);

  @Select(
      "select id material_id,name,coalesce(specification,'') specification,unit from materials"
          + " where tenant_id=#{tenant} and id=#{id}")
  java.util.Map<String, Object> material(@Param("tenant") String tenant, @Param("id") String id);

  @Delete("delete from procurement_project_lines where tenant_id=#{tenant} and project_id=#{id}")
  void replaceLines(@Param("tenant") String tenant, @Param("id") String id);

  @Insert(
      "insert into"
          + " procurement_project_lines(id,tenant_id,project_id,material_id,name,specification,unit,quantity,unit_price,purpose)"
          + " values(#{line.id},#{tenant},#{project},#{line.materialId},#{line.name},#{line.specification},#{line.unit},#{line.quantity},#{line.unitPrice},#{line.purpose})")
  void insertLine(
      @Param("tenant") String tenant, @Param("project") String project, @Param("line") Line line);

  @Update(
      "update procurement_projects set"
          + " status=#{status},workflow_instance_id=coalesce(#{workflow,jdbcType=VARCHAR},workflow_instance_id),revision=revision+1,updated_at=now(),closeout_reason=#{reason,jdbcType=VARCHAR}"
          + " where tenant_id=#{tenant} and id=#{id} and revision=#{revision}")
  int state(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("workflow") String workflow,
      @Param("reason") String reason);

  @Update(
      "update procurement_projects set"
          + " execution_type=#{type},execution_id=#{execution},revision=revision+1,updated_at=now()"
          + " where tenant_id=#{tenant} and id=#{id} and execution_id is null and"
          + " status='approved'")
  int bindExecution(
      @Param("tenant") String tenant,
      @Param("id") String id,
      @Param("type") String type,
      @Param("execution") String execution);

  @Select(
      "select p.id from procurement_projects p where p.tenant_id=#{tenant} and"
          + " p.execution_type=#{type} and p.execution_id=#{execution}")
  String executionProject(
      @Param("tenant") String tenant,
      @Param("type") String type,
      @Param("execution") String execution);

  @Select(
      "select project_id from procurement_project_demands where tenant_id=#{tenant} and"
          + " demand_id=#{id}")
  String demandProject(@Param("tenant") String tenant, @Param("id") String id);

  @Select(
      "select p.id from procurement_projects p left join tenders t on p.execution_type='tender' and"
          + " t.tenant_id=p.tenant_id and t.id=p.execution_id left join purchase_orders o on"
          + " o.tenant_id=t.tenant_id and o.id=t.execution_order_id where p.tenant_id=#{tenant} and"
          + " ((p.execution_type='rfq' and p.execution_id=#{rfq}) or o.rfq_id=#{rfq})")
  String projectForRfq(@Param("tenant") String tenant, @Param("rfq") String rfq);

  String DEMAND =
      "select"
          + " pd.id,pd.title,pd.status,pd.budget,pd.department_id,pd.requester_id,to_char(pd.created_at"
          + " at time zone 'Asia/Shanghai','YYYY') period from purchase_demands pd ";

  @Select(DEMAND + "where pd.tenant_id=#{tenant} and pd.id=#{id}")
  Demand demand(@Param("tenant") String tenant, @Param("id") String id);

  @Select(
      DEMAND
          + "join procurement_project_demands l on l.tenant_id=pd.tenant_id and l.demand_id=pd.id"
          + " where l.tenant_id=#{tenant} and l.project_id=#{id} order by pd.id")
  List<Demand> demands(@Param("tenant") String tenant, @Param("id") String id);

  @Insert(
      "insert into procurement_project_demands(tenant_id,project_id,demand_id,linked_by)"
          + " values(#{tenant},#{project},#{demand},#{actor})")
  void linkDemand(
      @Param("tenant") String tenant,
      @Param("project") String project,
      @Param("demand") String demand,
      @Param("actor") String actor);

  @Select(
      "select count(*) from rfq_demands rd join rfqs r on r.tenant_id=rd.tenant_id and"
          + " r.id=rd.rfq_id where rd.tenant_id=#{tenant} and rd.demand_id=#{id} and r.status not"
          + " in ('已流标','已废标')")
  int activeRfq(@Param("tenant") String tenant, @Param("id") String id);

  @Select("select owner_id from tenders where tenant_id=#{tenant} and id=#{id}")
  String tenderOwner(@Param("tenant") String tenant, @Param("id") String id);

  String OPTION_SCOPE =
      "<if test='scope.restricted'><choose><when test='scope.requesterId != null'>and d.id=(select"
          + " department_id from users where id=#{scope.requesterId} and"
          + " tenant_id=#{tenant})</when><when test='!scope.departmentIds.isEmpty()'>and d.id in"
          + " <foreach collection='scope.departmentIds' item='dept' open='(' separator=','"
          + " close=')'>#{dept}</foreach></when><otherwise>and false</otherwise></choose></if>";

  @Select(
      "<script>select d.id,d.name,d.id department_id,d.status from departments d where"
          + " d.tenant_id=#{tenant} and d.status='active' "
          + OPTION_SCOPE
          + " order by d.name</script>")
  List<Option> departments(@Param("tenant") String tenant, @Param("scope") DataScope scope);

  @Select(
      "<script>select u.id,u.name,d.id department_id,u.status from users u join departments d on"
          + " d.id=u.department_id and d.tenant_id=u.tenant_id where u.tenant_id=#{tenant} and"
          + " u.status='active' and d.status='active' "
          + OPTION_SCOPE
          + " order by u.name,u.id</script>")
  List<Option> owners(@Param("tenant") String tenant, @Param("scope") DataScope scope);

  @Select("select execution_order_id from tenders where tenant_id=#{tenant} and id=#{id}")
  String tenderOrder(@Param("tenant") String tenant, @Param("id") String id);

  @Select("select rfq_id from purchase_orders where tenant_id=#{tenant} and id=#{id}")
  String orderRfq(@Param("tenant") String tenant, @Param("id") String id);

  @Select(
      "select 'demand' type,id,title,status,budget amount,'demands' module,id record_id from"
          + " purchase_demands where tenant_id=#{tenant} and id in (select demand_id from"
          + " procurement_project_demands where tenant_id=#{tenant} and project_id=#{id}) order by"
          + " id")
  List<Trace> demandTrace(@Param("tenant") String tenant, @Param("id") String id);

  @Select(
      "select 'tender' type,id,title,status,budget amount,'tenders' module,id record_id from"
          + " tenders where tenant_id=#{tenant} and id=#{id}")
  Trace tenderTrace(@Param("tenant") String tenant, @Param("id") String id);
}
