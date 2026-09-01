package com.procurement.ludongpoc.infrastructure;

import com.procurement.ludongpoc.domain.LudongPocReviewRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LudongPocReviewRecordMapper {
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
