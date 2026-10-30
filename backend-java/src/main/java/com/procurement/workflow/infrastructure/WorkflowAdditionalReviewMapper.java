package com.procurement.workflow.infrastructure;

import com.procurement.workflow.domain.WorkflowAdditionalReview;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface WorkflowAdditionalReviewMapper {
  String COLUMNS = """
      select a.id,a.tenant_id,a.workflow_instance_id,a.flowable_task_id,a.node_id,a.requested_by,
        r.name as requester_name,a.reviewer_id,u.name as reviewer_name,a.reason,a.status,
        a.review_data::text as review_data,a.created_at,a.completed_at
      from workflow_additional_reviews a
      join users r on r.id=a.requested_by and r.tenant_id=a.tenant_id
      join users u on u.id=a.reviewer_id and u.tenant_id=a.tenant_id
      """;

  @Select(COLUMNS + " where a.tenant_id=#{tenant} and a.flowable_task_id=#{task} and a.status='pending'")
  WorkflowAdditionalReview pending(@Param("tenant") String tenant, @Param("task") String task);

  @Select(COLUMNS + " where a.tenant_id=#{tenant} and a.workflow_instance_id=#{instance} order by a.created_at,a.id")
  List<WorkflowAdditionalReview> list(@Param("tenant") String tenant, @Param("instance") String instance);

  @Insert("""
      insert into workflow_additional_reviews(id,tenant_id,workflow_instance_id,flowable_task_id,node_id,
        requested_by,reviewer_id,reason,status)
      values(#{id},#{tenant},#{instance},#{task},#{node},#{actor},#{reviewer},#{reason},'pending')
      """)
  void insert(@Param("id") String id, @Param("tenant") String tenant, @Param("instance") String instance,
      @Param("task") String task, @Param("node") String node, @Param("actor") String actor,
      @Param("reviewer") String reviewer, @Param("reason") String reason);

  @Update("""
      update workflow_additional_reviews set status=#{status},review_data=#{data}::jsonb,completed_at=clock_timestamp()
      where tenant_id=#{tenant} and id=#{id} and reviewer_id=#{actor} and status='pending'
      """)
  int complete(@Param("tenant") String tenant, @Param("id") String id, @Param("actor") String actor,
      @Param("status") String status, @Param("data") String data);

  @Update("""
      update workflow_additional_reviews set status='cancelled',completed_at=clock_timestamp()
      where tenant_id=#{tenant} and workflow_instance_id=#{instance} and status='pending'
      """)
  int cancelPending(@Param("tenant") String tenant, @Param("instance") String instance);
}
