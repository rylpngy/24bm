package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.BudgetContracts.*;
import com.procurement.buyer.domain.BudgetChange;
import com.procurement.buyer.domain.BudgetPosition;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface BudgetLifecycleMapper {
  String POSITION = """
      select k.department_id,coalesce(d.name,k.department_id) as department_name,k.period,
        coalesce(b.total_amount,0) as total_amount,coalesce(v.version,0) as version,
        coalesce(l.pending,0) as pending,coalesce(l.committed,0) as committed,
        coalesce(l.order_amount,0) as order_amount,case when l.line_count>0 and l.paid_amount is null then null else coalesce(l.paid_amount,0) end as paid_amount,
        coalesce(l.released_amount,0) as released_amount,(b.id is not null) as configured
      from (select tenant_id,department_id,period from department_budgets
            union select tenant_id,department_id,period from budget_commitment_lines) k
      left join department_budgets b using(tenant_id,department_id,period)
      left join budget_pool_versions v using(tenant_id,department_id,period)
      left join (select tenant_id,department_id,period,sum(pending) as pending,sum(committed) as committed,
        sum(order_amount) as order_amount,case when bool_or(paid_amount is null) then null else sum(paid_amount) end as paid_amount,
        count(*) as line_count,sum(released_amount) as released_amount
        from budget_commitment_lines group by tenant_id,department_id,period) l using(tenant_id,department_id,period)
      left join departments d on d.tenant_id=k.tenant_id and d.id=k.department_id
      """;
  String SCOPE = """
      <if test="scope.restricted">
        <choose><when test="scope.requesterId == null and scope.departmentIds != null and !scope.departmentIds.isEmpty()">
          and department_id in <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>
        </when><otherwise>and false</otherwise></choose>
      </if>
      """;
  String REQUEST_FILTER = """
      where tenant_id=#{tenant}
      <if test="kind != ''">and kind=#{kind}</if>
      <if test="scope.restricted"><choose>
        <when test="scope.requesterId != null">and created_by=#{scope.requesterId}</when>
        <when test="scope.departmentIds != null and !scope.departmentIds.isEmpty()">
          and department_id in <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>
        </when><otherwise>and false</otherwise>
      </choose></if>
      """;
  String UNASSIGNED = """
      from purchase_orders po where po.tenant_id=#{tenant}
        and not exists(select 1 from budget_commitment_lines l where l.tenant_id=po.tenant_id
          and ((l.source_type='rfq' and l.source_id=po.rfq_id) or (l.source_type='order' and l.source_id=po.id)))
      """;

  @Select("select 1 from (select pg_advisory_xact_lock(hashtextextended('budget-control:' || #{tenant},0))) locked")
  @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
  int lockTenant(@Param("tenant") String tenant);

  @Select(POSITION + " where k.tenant_id=#{tenant} and k.department_id=#{department} and k.period=#{period}")
  BudgetPosition position(@Param("tenant") String tenant,@Param("department") String department,@Param("period") String period);

  @Select("<script>select * from ("+POSITION+" where k.tenant_id=#{tenant}) positions where true "+SCOPE+" order by period desc,department_id</script>")
  List<BudgetPosition> positions(@Param("tenant") String tenant,@Param("scope") DataScope scope);

  @Select("select coalesce((select version from budget_pool_versions where tenant_id=#{tenant} and department_id=#{department} and period=#{period}),0)")
  long version(@Param("tenant") String tenant,@Param("department") String department,@Param("period") String period);

  @Select("select total_amount from department_budgets where tenant_id=#{tenant} and department_id=#{department} and period=#{period}")
  BigDecimal total(@Param("tenant") String tenant,@Param("department") String department,@Param("period") String period);

  @Insert("""
      insert into budget_pool_versions(tenant_id,department_id,period,version) values(#{tenant},#{department},#{period},1)
      on conflict(tenant_id,department_id,period) do update set version=budget_pool_versions.version+1
      """)
  void incrementVersion(@Param("tenant") String tenant,@Param("department") String department,@Param("period") String period);

  @Select("select * from budget_change_requests where tenant_id=#{tenant} and id=#{id}")
  BudgetChange find(@Param("tenant") String tenant,@Param("id") String id);

  @Select("<script>select * from budget_change_requests "+REQUEST_FILTER+" order by updated_at desc,id desc limit #{size} offset #{offset}</script>")
  List<BudgetChange> requests(@Param("tenant") String tenant,@Param("scope") DataScope scope,@Param("kind") String kind,
      @Param("size") int size,@Param("offset") long offset);

  @Select("<script>select count(*) from budget_change_requests "+REQUEST_FILTER+"</script>")
  long countRequests(@Param("tenant") String tenant,@Param("scope") DataScope scope,@Param("kind") String kind);

  @Select("select exists(select 1 from budget_change_requests where tenant_id=#{tenant} and department_id=#{department} and period=#{period} and kind<>'exception' and status='submitted')")
  boolean pendingChange(@Param("tenant") String tenant,@Param("department") String department,@Param("period") String period);

  @Insert("""
      insert into budget_change_requests(id,tenant_id,department_id,period,kind,target_amount,base_amount,base_version,
        target_type,target_id,title,reason,status,created_by)
      values(#{id},#{tenantId},#{departmentId},#{period},#{kind},#{targetAmount},#{baseAmount},#{baseVersion},
        #{targetType,jdbcType=VARCHAR},#{targetId,jdbcType=VARCHAR},#{title},#{reason},'draft',#{createdBy})
      """)
  void insert(BudgetChange request);

  @Update("""
      update budget_change_requests set target_amount=#{amount},title=#{title},reason=#{reason},base_amount=#{base},
        base_version=#{baseVersion},revision=revision+1,updated_at=now()
      where tenant_id=#{tenant} and id=#{id} and status='draft' and revision=#{revision}
      """)
  int edit(@Param("tenant") String tenant,@Param("id") String id,@Param("revision") long revision,
      @Param("amount") BigDecimal amount,@Param("title") String title,@Param("reason") String reason,
      @Param("base") BigDecimal base,@Param("baseVersion") long baseVersion);

  @Update("""
      update budget_change_requests set status=#{next},revision=revision+1,updated_at=now()
      where tenant_id=#{tenant} and id=#{id} and status=#{expected}
      """)
  int status(@Param("tenant") String tenant,@Param("id") String id,@Param("expected") String expected,@Param("next") String next);

  @Update("update budget_change_requests set workflow_instance_id=#{workflow} where tenant_id=#{tenant} and id=#{id} and status='submitted'")
  void bindWorkflow(@Param("tenant") String tenant,@Param("id") String id,@Param("workflow") String workflow);

  @Update("""
      update budget_change_requests set status='approved',approved_by=#{actor},approved_at=now(),
        expires_at=case when kind='exception' then now()+interval '7 days' else null end,revision=revision+1,updated_at=now()
      where tenant_id=#{tenant} and id=#{id} and status='submitted'
      """)
  int approve(@Param("tenant") String tenant,@Param("id") String id,@Param("actor") String actor);

  @Select("""
      select * from budget_change_requests where tenant_id=#{tenant} and kind='exception' and status='approved'
        and target_type=#{type} and target_id=#{target} and department_id=#{department} and period=#{period}
        and base_version=#{version} and target_amount >= #{exposure} and expires_at > now()
        and (consumed_at is null or (consumed_transaction=txid_current() and consumed_by=#{actor}))
      order by target_amount,approved_at,id limit 1
      """)
  BudgetChange exception(@Param("tenant") String tenant,@Param("type") String type,@Param("target") String target,
      @Param("department") String department,@Param("period") String period,@Param("version") long version,
      @Param("exposure") BigDecimal exposure,@Param("actor") String actor);

  @Update("update budget_change_requests set consumed_at=now(),consumed_by=#{actor},consumed_transaction=txid_current(),updated_at=now() where tenant_id=#{tenant} and id=#{id} and (consumed_at is null or (consumed_transaction=txid_current() and consumed_by=#{actor})) and expires_at>now()")
  int consume(@Param("tenant") String tenant,@Param("id") String id,@Param("actor") String actor);

  @Select("select coalesce((select mode from budget_policies where tenant_id=#{tenant}),'warning')")
  String mode(@Param("tenant") String tenant);

  @Select("select coalesce((select revision from budget_policies where tenant_id=#{tenant}),0)")
  long policyRevision(@Param("tenant") String tenant);

  @Select("""
      select coalesce(p.mode,'warning') as mode,coalesce(p.revision,0) as revision,coalesce(p.reason,'') as reason,
        p.updated_by,p.updated_at,
      """+" (select count(*) "+UNASSIGNED+") as unassigned_order_count,"+"""
        (select count(*) from purchase_demands pd where pd.tenant_id=#{tenant} and pd.status in ('审批中','已通过','已转询价')
          and (pd.budget is null or pd.budget<=0 or pd.department_id is null
            or not exists(select 1 from departments d where d.tenant_id=pd.tenant_id and d.id=pd.department_id))) as invalid_demand_count,
        false as can_configure
      from (select 1) seed left join budget_policies p on p.tenant_id=#{tenant}
      """)
  BudgetPolicy policy(@Param("tenant") String tenant);

  @Select("<script>select id,name from departments where tenant_id=#{tenant} and status='active' "+
      "<if test=\"scope.restricted\"><choose><when test=\"scope.requesterId == null and scope.departmentIds != null and !scope.departmentIds.isEmpty()\">"+
      "and id in <foreach collection=\"scope.departmentIds\" item=\"dept\" open=\"(\" separator=\",\" close=\")\">#{dept}</foreach>"+
      "</when><otherwise>and false</otherwise></choose></if> order by name,id</script>")
  List<BudgetDepartment> departments(@Param("tenant") String tenant,@Param("scope") DataScope scope);

  @Insert("""
      insert into budget_policies(tenant_id,mode,revision,reason,updated_by) values(#{tenant},#{mode},1,#{reason},#{actor})
      on conflict(tenant_id) do update set mode=excluded.mode,revision=budget_policies.revision+1,
        reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now()
      """)
  void savePolicy(@Param("tenant") String tenant,@Param("mode") String mode,@Param("reason") String reason,@Param("actor") String actor);

  @Select("select exists(select 1 from departments where tenant_id=#{tenant} and id=#{department} and status='active')")
  boolean activeDepartment(@Param("tenant") String tenant,@Param("department") String department);

  @Select("select u.department_id from users u join departments d on d.tenant_id=u.tenant_id and d.id=u.department_id and d.status='active' where u.tenant_id=#{tenant} and u.id=#{user}")
  String actorDepartment(@Param("tenant") String tenant,@Param("user") String user);

  @Select("select exists(select 1 from purchase_demands pd where pd.tenant_id=#{tenant} and pd.id=#{id} and pd.department_id=#{department} and coalesce((select max(r.target_period) from procurement_project_lifecycle_requests r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.project_id=r.project_id where d.tenant_id=pd.tenant_id and d.demand_id=pd.id and r.kind='carryover' and r.status='approved'),to_char(pd.created_at at time zone 'Asia/Shanghai','YYYY'))=#{period} and pd.status in ('草稿','已驳回','审批中','已通过'))")
  boolean demandTarget(@Param("tenant") String tenant,@Param("id") String id,@Param("department") String department,@Param("period") String period);

  @Select("select exists(select 1 from budget_commitment_lines where tenant_id=#{tenant} and source_type='rfq' and source_id=#{id} and department_id=#{department} and period=#{period})")
  boolean rfqTarget(@Param("tenant") String tenant,@Param("id") String id,@Param("department") String department,@Param("period") String period);

  @Select("select exists(select 1 from rfq_demands where tenant_id=#{tenant} and rfq_id=#{rfq})")
  boolean hasDemandLinks(@Param("tenant") String tenant,@Param("rfq") String rfq);

  @Select("select distinct b.department_id,b.period from budget_commitment_lines b where b.tenant_id=#{tenant} and b.source_type='rfq' and b.source_id=#{rfq} and not exists(select 1 from procurement_project_lifecycle_requests r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.project_id=r.project_id join rfq_demands rd on rd.tenant_id=d.tenant_id and rd.demand_id=d.demand_id where rd.tenant_id=b.tenant_id and rd.rfq_id=b.source_id and r.kind='carryover' and r.status='approved' and r.target_period>b.period)")
  List<java.util.Map<String,Object>> rfqPools(@Param("tenant") String tenant,@Param("rfq") String rfq);

  @Select("select po.id,po.rfq_id,po.amount,po.status,po.created_at "+UNASSIGNED+" order by po.created_at,po.id limit #{size} offset #{offset}")
  List<BudgetUnassignedOrder> unassigned(@Param("tenant") String tenant,@Param("size") int size,@Param("offset") long offset);

  @Select("select po.id,po.rfq_id,po.amount,po.status,po.created_at from purchase_orders po where po.tenant_id=#{tenant} and po.id=#{id}")
  BudgetUnassignedOrder order(@Param("tenant") String tenant,@Param("id") String id);

  @Insert("insert into budget_order_allocations(order_id,tenant_id,department_id,period,assigned_by) values(#{order},#{tenant},#{department},#{period},#{actor})")
  void assign(@Param("tenant") String tenant,@Param("order") String order,@Param("department") String department,@Param("period") String period,@Param("actor") String actor);

  @Select("select exists(select 1 from budget_order_allocations where tenant_id=#{tenant} and order_id=#{order})")
  boolean assigned(@Param("tenant") String tenant,@Param("order") String order);

  String LEDGER_FILTER = "where tenant_id=#{tenant} <if test=\"department != ''\">and department_id=#{department}</if> <if test=\"period != ''\">and period=#{period}</if> " + SCOPE;
  @Select("<script>select department_id,period,source_type,source_id,label,pending,committed,order_amount,paid_amount,released_amount from budget_commitment_lines "+LEDGER_FILTER+" order by period desc,department_id,source_type,source_id limit #{size} offset #{offset}</script>")
  List<BudgetLedgerLine> ledger(@Param("tenant") String tenant,@Param("scope") DataScope scope,@Param("department") String department,
      @Param("period") String period,@Param("size") int size,@Param("offset") long offset);

  @Select("<script>select count(*) from budget_commitment_lines "+LEDGER_FILTER+"</script>")
  long countLedger(@Param("tenant") String tenant,@Param("scope") DataScope scope,@Param("department") String department,@Param("period") String period);

  @Insert("""
      insert into budget_project_settlements(tenant_id,rfq_id,archive_id,demand_amount,order_amount,paid_amount,settled_by)
      select #{tenant},#{rfq},#{archive},
        coalesce((select sum(pd.budget) from rfq_demands rd join purchase_demands pd on pd.id=rd.demand_id and pd.tenant_id=rd.tenant_id
          where rd.tenant_id=#{tenant} and rd.rfq_id=#{rfq} and pd.status in ('已通过','已转询价')),0),#{orders},#{paid},#{actor}
      on conflict(tenant_id,rfq_id) do update set archive_id=excluded.archive_id,demand_amount=excluded.demand_amount,
        order_amount=excluded.order_amount,paid_amount=excluded.paid_amount,settled_by=excluded.settled_by,settled_at=now()
      """)
  void settle(@Param("tenant") String tenant,@Param("rfq") String rfq,@Param("archive") String archive,
      @Param("orders") BigDecimal orders,@Param("paid") BigDecimal paid,@Param("actor") String actor);
}
