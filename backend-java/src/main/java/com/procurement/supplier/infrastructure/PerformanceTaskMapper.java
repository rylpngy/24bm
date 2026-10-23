package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.PerformanceTask;
import com.procurement.supplier.api.PerformanceTaskResponse.Assignee;
import com.procurement.supplier.api.PerformanceTaskResponse.Event;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PerformanceTaskMapper {
  String SELECT = """
      select p.id,p.tenant_id,p.supplier_id,p.relation_id,e.name supplier_name,t.name buyer_name,
        p.period,p.assignee_id,p.assignee_name,p.due_date,p.status,p.evaluation_id,p.total_score,
        p.requirement,p.response,p.version
      from supplier_performance_tasks p join enterprises e on e.id=p.supplier_id
      join tenants t on t.id=p.tenant_id
      """;

  @Select(SELECT + " where p.tenant_id=#{tenantId} and p.relation_id=#{relationId} order by p.created_at desc,p.id")
  List<PerformanceTask> listBuyer(@Param("tenantId") String tenantId, @Param("relationId") String relationId);

  @Select(SELECT + " where p.supplier_id=#{supplierId} and p.status in ('remediation_requested','remediation_submitted','closed') order by p.created_at desc,p.id")
  List<PerformanceTask> listSupplier(@Param("supplierId") String supplierId);

  @Select(SELECT + " where p.tenant_id=#{tenantId} and p.relation_id=#{relationId} and p.id=#{id} for update of p")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  PerformanceTask lockBuyer(@Param("tenantId") String tenantId, @Param("relationId") String relationId, @Param("id") String id);

  @Select(SELECT + " where p.supplier_id=#{supplierId} and p.id=#{id} and p.status in ('remediation_requested','remediation_submitted','closed') for update of p")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  PerformanceTask lockSupplier(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("""
      select u.id,u.name display_name from users u
      where u.tenant_id=#{tenantId} and u.supplier_id is null and u.status='active'
        and exists(select 1 from user_roles ur join roles r on r.id=ur.role_id
          cross join lateral jsonb_array_elements_text(r.permissions) perm
          where ur.user_id=u.id and r.tenant_id=u.tenant_id and r.scope='buyer'
            and perm in ('buyer:*','buyer:supplier:*','buyer:supplier:manage'))
      order by u.name,u.id
      """)
  List<Assignee> assignees(@Param("tenantId") String tenantId);

  @Select("select name from users where id=#{userId} and tenant_id=#{tenantId} and supplier_id is null and status='active'")
  String buyerActor(@Param("tenantId") String tenantId, @Param("userId") String userId);

  @Select("select name from users where id=#{userId} and supplier_id=#{supplierId} and tenant_id is null and status='active'")
  String supplierActor(@Param("supplierId") String supplierId, @Param("userId") String userId);

  @Insert("""
      insert into supplier_performance_tasks(id,tenant_id,supplier_id,relation_id,period,assignee_id,assignee_name,due_date,status)
      values(#{id},#{tenantId},#{supplierId},#{relationId},#{period},#{assigneeId},#{assigneeName},#{dueDate},'assigned')
      """)
  void insert(PerformanceTask task);

  @Update("""
      update supplier_performance_tasks set status=#{status},evaluation_id=#{evaluationId},total_score=#{totalScore},
        requirement=#{requirement},response=#{response},due_date=#{dueDate},updated_at=now(),version=version+1
      where id=#{id} and tenant_id=#{tenantId}
      """)
  void update(@Param("id") String id, @Param("tenantId") String tenantId, @Param("status") String status,
      @Param("evaluationId") String evaluationId, @Param("totalScore") BigDecimal totalScore,
      @Param("requirement") String requirement, @Param("response") String response, @Param("dueDate") LocalDate dueDate);

  @Insert("""
      insert into supplier_performance_task_events(task_id,action,actor_id,actor_name,comment)
      values(#{taskId},#{action},#{actorId},#{actorName},#{comment})
      """)
  void event(@Param("taskId") String taskId, @Param("action") String action,
      @Param("actorId") String actorId, @Param("actorName") String actorName, @Param("comment") String comment);

  @Select("select action,actor_name,comment,created_at from supplier_performance_task_events where task_id=#{taskId} order by id")
  List<Event> history(@Param("taskId") String taskId);
}
