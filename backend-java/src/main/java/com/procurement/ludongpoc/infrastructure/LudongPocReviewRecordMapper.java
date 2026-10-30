package com.procurement.ludongpoc.infrastructure;

import com.procurement.ludongpoc.domain.LudongPocReviewRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LudongPocReviewRecordMapper {
  @Select("""
      select r.id,r.tenant_id,r.application_id,r.workflow_task_id,r.node_id,r.reviewer_id,
        r.decision,r.review_data::text as review_data_json,r.comment,r.reviewed_at
      from ludong_poc_review_records r
      join workflow_task_events e on e.tenant_id=r.tenant_id and e.flowable_task_id=r.workflow_task_id and e.action='approved'
      join workflow_business_instances w on w.tenant_id=e.tenant_id and w.id=e.workflow_instance_id
      where r.tenant_id=#{tenantId} and r.application_id=#{applicationId} and r.decision='approve'
        and w.id=(select x.id from workflow_business_instances x where x.tenant_id=r.tenant_id
          and x.business_type='ludong_project_application' and x.business_id=r.application_id
          order by x.created_at desc,x.id desc limit 1)
        and w.status<>'cancelled'
        and not exists(select 1 from workflow_task_events i where i.tenant_id=e.tenant_id
          and i.workflow_instance_id=e.workflow_instance_id and i.flowable_task_id=e.flowable_task_id
          and i.action='approval_invalidated')
      order by r.reviewed_at,r.id
      """)
  List<LudongPocReviewRecord> listEffectiveByApplication(@Param("tenantId") String tenantId, @Param("applicationId") String applicationId);

  @Select("""
      select r.id,r.tenant_id,r.application_id,r.workflow_task_id,r.node_id,r.reviewer_id,
        r.decision,r.review_data::text as review_data_json,r.comment,r.reviewed_at
      from ludong_poc_review_records r
      where r.tenant_id=#{tenantId} and r.application_id=#{applicationId}
        and exists(select 1 from workflow_task_events e where e.tenant_id=r.tenant_id
          and e.workflow_instance_id=#{instanceId} and e.flowable_task_id=r.workflow_task_id)
      order by r.reviewed_at,r.id
      """)
  List<LudongPocReviewRecord> listByInstance(@Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId, @Param("instanceId") String instanceId);

  @Insert("""
      insert into ludong_poc_review_records (
        id, tenant_id, application_id, workflow_task_id, node_id, reviewer_id,
        decision, review_data, comment
      ) values (
        #{id}, #{tenantId}, #{applicationId}, #{workflowTaskId}, #{nodeId}, #{reviewerId},
        #{decision}, #{reviewDataJson}::jsonb, #{comment,jdbcType=VARCHAR}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId,
      @Param("workflowTaskId") String workflowTaskId,
      @Param("nodeId") String nodeId,
      @Param("reviewerId") String reviewerId,
      @Param("decision") String decision,
      @Param("reviewDataJson") String reviewDataJson,
      @Param("comment") String comment);

  @Select("""
      select id, tenant_id, application_id, workflow_task_id, node_id, reviewer_id,
             decision, review_data::text as review_data_json, comment, reviewed_at
      from ludong_poc_review_records
      where tenant_id = #{tenantId} and application_id = #{applicationId}
      order by reviewed_at asc
      """)
  List<LudongPocReviewRecord> listByApplication(
      @Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId);

  @Select("""
      select id, tenant_id, application_id, workflow_task_id, node_id, reviewer_id,
             decision, review_data::text as review_data_json, comment, reviewed_at
      from ludong_poc_review_records
      where tenant_id = #{tenantId}
        and application_id = #{applicationId}
        and workflow_task_id = #{workflowTaskId}
      """)
  LudongPocReviewRecord findByWorkflowTaskId(
      @Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId,
      @Param("workflowTaskId") String workflowTaskId);
}
