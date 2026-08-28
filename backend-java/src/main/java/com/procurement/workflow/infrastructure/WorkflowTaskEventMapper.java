package com.procurement.workflow.infrastructure;

import com.procurement.workflow.domain.WorkflowTaskEvent;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface WorkflowTaskEventMapper {

  @Insert("""
      insert into workflow_task_events (
        id, tenant_id, workflow_instance_id, flowable_task_id, node_id, node_name,
        action, actor_id, comment
      ) values (
        #{id}, #{tenantId}, #{workflowInstanceId}, #{flowableTaskId,jdbcType=VARCHAR},
        #{nodeId,jdbcType=VARCHAR}, #{nodeName,jdbcType=VARCHAR}, #{action},
        #{actorId,jdbcType=VARCHAR}, nullif(trim(#{comment,jdbcType=VARCHAR}), '')
      )
      on conflict (tenant_id, workflow_instance_id, flowable_task_id, action)
        where flowable_task_id is not null do nothing
      """)
  int insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("workflowInstanceId") String workflowInstanceId,
      @Param("flowableTaskId") String flowableTaskId,
      @Param("nodeId") String nodeId,
      @Param("nodeName") String nodeName,
      @Param("action") String action,
      @Param("actorId") String actorId,
      @Param("comment") String comment);

  @Select("""
      select id, tenant_id, workflow_instance_id, flowable_task_id, node_id, node_name,
             action, actor_id, comment, created_at
      from workflow_task_events
      where tenant_id = #{tenantId} and workflow_instance_id = #{workflowInstanceId}
      order by created_at asc
      """)
  List<WorkflowTaskEvent> listByTenantAndWorkflowInstance(
      @Param("tenantId") String tenantId,
      @Param("workflowInstanceId") String workflowInstanceId);
}
