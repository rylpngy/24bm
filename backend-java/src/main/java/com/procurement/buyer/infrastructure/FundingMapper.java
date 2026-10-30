package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.FundingContracts.*;
import com.procurement.buyer.domain.FundingAllocationPolicy.Share;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FundingMapper {
  @Select(
      "select #{t} from (select"
          + " pg_advisory_xact_lock(hashtextextended('special-funding:'||#{t},0))) locked")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  String lock(@Param("t") String t);

  String SCOPE =
      "<if test='scope.restricted'><choose><when test='scope.requesterId != null'> and"
          + " created_by=#{scope.requesterId}</when><when test='!scope.departmentIds.isEmpty()'>"
          + " and department_id in <foreach collection='scope.departmentIds' item='d' open='('"
          + " separator=',' close=')'>#{d}</foreach></when><otherwise> and"
          + " false</otherwise></choose></if>";
  String FUND =
      "select"
          + " id,tenant_id,department_id,period,code,name,total_amount,revision,status,created_by,reserved_amount,paid_amount,available_amount"
          + " from special_fund_balances ";

  @Select(FUND + "where tenant_id=#{t} and id=#{id}")
  Fund fund(@Param("t") String t, @Param("id") String id);

  @Select(
      "<script>"
          + FUND
          + "where tenant_id=#{t} "
          + SCOPE
          + " order by period desc,code,id limit #{size} offset #{offset}</script>")
  List<Fund> funds(
      @Param("t") String t,
      @Param("scope") DataScope scope,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select("<script>select count(*) from special_funds where tenant_id=#{t} " + SCOPE + "</script>")
  long fundCount(@Param("t") String t, @Param("scope") DataScope scope);

  @Select(
      FUND
          + "where tenant_id=#{t} and department_id=#{d} and period=#{p} and status='approved'"
          + " order by code,id")
  List<Fund> choices(@Param("t") String t, @Param("d") String d, @Param("p") String p);

  @Select(
      "select exists(select 1 from departments where tenant_id=#{t} and id=#{d} and"
          + " status='active')")
  boolean department(@Param("t") String t, @Param("d") String d);

  @Insert(
      "insert into special_funds(id,tenant_id,department_id,period,code,name,created_by)"
          + " values(#{id},#{t},#{d},#{period},#{code},#{name},#{actor})")
  void create(
      @Param("id") String id,
      @Param("t") String t,
      @Param("d") String d,
      @Param("period") String period,
      @Param("code") String code,
      @Param("name") String name,
      @Param("actor") String actor);

  @Update(
      "update special_funds set total_amount=#{amount},revision=revision+1,status='approved' where"
          + " tenant_id=#{t} and id=#{id} and revision=#{revision}")
  int approveFund(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("amount") BigDecimal amount);

  String CHANGE =
      "select"
          + " id,tenant_id,kind,fund_id,project_id,department_id,period,based_revision,amount,request_key,proposal::text,snapshot::text,reason,status,revision,workflow_instance_id,created_by,created_at,completed_by,completed_at"
          + " from special_funding_changes ";

  @Select(CHANGE + "where tenant_id=#{t} and id=#{id}")
  Change change(@Param("t") String t, @Param("id") String id);

  @Select(CHANGE + "where tenant_id=#{t} and request_key=#{key}")
  Change byKey(@Param("t") String t, @Param("key") String key);

  String FILTER =
      "where tenant_id=#{t} and (#{fund}='' or fund_id=#{fund} or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(proposal->'lines')='array' then proposal->'lines' else '[]'::jsonb end) l where l->>'fundId'=#{fund} or l->>'sourceFundId'=#{fund} or l->>'targetFundId'=#{fund})) and (#{project}='' or"
          + " project_id=#{project}) ";

  @Select(
      "<script>"
          + CHANGE
          + FILTER
          + SCOPE
          + " order by created_at desc,id limit #{size} offset #{offset}</script>")
  List<Change> changes(
      @Param("t") String t,
      @Param("scope") DataScope scope,
      @Param("fund") String fund,
      @Param("project") String project,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select("<script>select count(*) from special_funding_changes " + FILTER + SCOPE + "</script>")
  long changeCount(
      @Param("t") String t,
      @Param("scope") DataScope scope,
      @Param("fund") String fund,
      @Param("project") String project);

  @Select(
      "select count(*) from special_funding_changes where tenant_id=#{t} and status='submitted' and"
          + " ((cast(#{fund,jdbcType=VARCHAR} as text) is not null and fund_id=#{fund}) or"
          + " (cast(#{project,jdbcType=VARCHAR} as text) is not null and project_id=#{project}))")
  int pending(@Param("t") String t, @Param("fund") String fund, @Param("project") String project);

  @Insert(
      """
insert into special_funding_changes(id,tenant_id,kind,fund_id,project_id,department_id,period,based_revision,amount,request_key,proposal,snapshot,reason,created_by)
values(#{id},#{tenantId},#{kind},#{fundId},#{projectId},#{departmentId},#{period},#{basedRevision},#{amount},#{requestKey},cast(#{proposal} as jsonb),cast(#{snapshot} as jsonb),#{reason},#{createdBy})
""")
  void insert(Change c);

  @Update(
      "update special_funding_changes set workflow_instance_id=#{flow} where tenant_id=#{t} and"
          + " id=#{id} and status='submitted' and workflow_instance_id is null")
  int bind(@Param("t") String t, @Param("id") String id, @Param("flow") String flow);

  @Update(
      "update special_funding_changes set"
          + " status=#{status},revision=revision+1,completed_by=#{actor},completed_at=now() where"
          + " tenant_id=#{t} and id=#{id} and revision=#{revision} and status='submitted'")
  int finish(
      @Param("t") String t,
      @Param("id") String id,
      @Param("revision") int revision,
      @Param("status") String status,
      @Param("actor") String actor);

  @Select("select change_id from project_funding_plans where tenant_id=#{t} and project_id=#{p}")
  String plan(@Param("t") String t, @Param("p") String p);

  @Select("select coalesce((select prior_paid_amount from project_funding_plans where tenant_id=#{t} and project_id=#{p}),0)")
  BigDecimal priorPaid(@Param("t") String t, @Param("p") String p);

  @Select("select coalesce(sum(amount),0) from funding_payment_allocations where tenant_id=#{t} and project_id=#{p}")
  BigDecimal totalPaid(@Param("t") String t, @Param("p") String p);

  @Select("select exists(select 1 from funding_payment_allocations a where a.tenant_id=#{t} and a.entry_id=#{e} and a.change_id<>#{plan})")
  boolean historicalEntry(@Param("t") String t,@Param("e") String e,@Param("plan") String plan);

  @Update("update project_funding_plans set prior_paid_amount=#{amount} where tenant_id=#{t} and project_id=#{p}")
  int carryPaidBasis(@Param("t") String t,@Param("p") String p,@Param("amount") BigDecimal amount);

  @Select(
      "select fund_id,code,name,allocated_amount,paid_amount,remaining_amount from"
          + " project_funding_balances where tenant_id=#{t} and project_id=#{p} order by fund_id")
  List<Balance> balances(@Param("t") String t, @Param("p") String p);

  @Insert(
      "insert into project_funding_lines(tenant_id,change_id,project_id,fund_id,amount)"
          + " values(#{t},#{c},#{p},#{f},#{amount})")
  void line(
      @Param("t") String t,
      @Param("c") String c,
      @Param("p") String p,
      @Param("f") String f,
      @Param("amount") BigDecimal amount);

  @Insert(
      "insert into project_funding_plans(tenant_id,project_id,change_id) values(#{t},#{p},#{c}) on"
          + " conflict(tenant_id,project_id) do update set change_id=excluded.change_id")
  void publish(@Param("t") String t, @Param("p") String p, @Param("c") String c);

  @Select(
      "select count(*) from invoice_payment_entries e join invoices i on i.tenant_id=e.tenant_id"
          + " and i.id=e.invoice_id join purchase_orders o on o.tenant_id=i.tenant_id and"
          + " o.id=i.order_id where e.tenant_id=#{t} and exists(select 1 from rfq_demands rd join"
          + " procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and"
          + " d.project_id=#{p})")
  int paymentHistory(@Param("t") String t, @Param("p") String p);

  @Select(
      "select (select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and status not in ('withdrawn','rejected'))+(select count(*) from"
          + " procurement_project_changes where tenant_id=#{t} and project_id=#{p} and status in"
          + " ('draft','submitted'))+(select count(*) from order_settlements s join purchase_orders"
          + " o on o.tenant_id=s.tenant_id and o.id=s.order_id where s.tenant_id=#{t} and s.status"
          + " not in ('withdrawn','rejected') and exists(select 1 from rfq_demands rd join"
          + " procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and"
          + " d.project_id=#{p}))")
  int conflicts(@Param("t") String t, @Param("p") String p);

  @Select(
      "select distinct coalesce(d.project_id,'') from invoices i join purchase_orders o on"
          + " o.tenant_id=i.tenant_id and o.id=i.order_id join rfq_demands rd on"
          + " rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id left join procurement_project_demands"
          + " d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id where i.tenant_id=#{t} and"
          + " i.id=#{i}")
  List<String> invoiceProjects(@Param("t") String t, @Param("i") String i);

  @Select(
      "select distinct coalesce(d.project_id,'') from purchase_orders o join rfq_demands rd on"
          + " rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id left join procurement_project_demands"
          + " d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id where o.tenant_id=#{t} and"
          + " o.id=#{o}")
  List<String> orderProjects(@Param("t") String t, @Param("o") String o);

  @Select(
      "select fund_id,amount from funding_payment_allocations where tenant_id=#{t} and"
          + " entry_id=#{e} order by fund_id")
  List<Share> entry(@Param("t") String t, @Param("e") String e);

  @Insert(
      "insert into"
          + " funding_payment_allocations(tenant_id,entry_id,project_id,fund_id,change_id,amount,created_by)"
          + " values(#{t},#{e},#{p},#{f},#{c},#{amount},#{actor})")
  void payment(
      @Param("t") String t,
      @Param("e") String e,
      @Param("p") String p,
      @Param("f") String f,
      @Param("c") String c,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);

  @Select(
      "select a.entry_id,a.fund_id,f.code,a.amount,e.evidence_no,a.created_by,a.created_at from"
          + " funding_payment_allocations a join special_funds f on f.tenant_id=a.tenant_id and"
          + " f.id=a.fund_id join invoice_payment_entries e on e.tenant_id=a.tenant_id and"
          + " e.id=a.entry_id where a.tenant_id=#{t} and e.invoice_id=#{i} order by"
          + " e.created_at,e.id,f.id")
  List<Attribution> attributions(@Param("t") String t, @Param("i") String i);
}
