package com.procurement.ludongpoc.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LudongPocAiReviewMapper {
  @Insert("""
      insert into ludong_poc_ai_review_runs (
        id, tenant_id, application_id, node_id, analysis_mode, model_name,
        knowledge_version, response_payload, created_by
      ) values (
        #{id}, #{tenantId}, #{applicationId}, #{nodeId}, #{analysisMode}, #{modelName},
        #{knowledgeVersion}, #{responseJson}::jsonb, #{createdBy}
      )
      """)
  void insertRun(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId,
      @Param("nodeId") String nodeId,
      @Param("analysisMode") String analysisMode,
      @Param("modelName") String modelName,
      @Param("knowledgeVersion") String knowledgeVersion,
      @Param("responseJson") String responseJson,
      @Param("createdBy") String createdBy);

  @Select("""
      select count(*) > 0
      from ludong_poc_ai_review_runs
      where id = #{runId} and tenant_id = #{tenantId} and application_id = #{applicationId}
      """)
  boolean runBelongsToApplication(
      @Param("tenantId") String tenantId,
      @Param("applicationId") String applicationId,
      @Param("runId") String runId);

  @Insert("""
      insert into ludong_poc_ai_review_feedback (
        id, tenant_id, run_id, finding_id, reviewer_id, disposition, comment
      ) values (
        #{id}, #{tenantId}, #{runId}, #{findingId}, #{reviewerId}, #{disposition},
        #{comment,jdbcType=VARCHAR}
      )
      on conflict (tenant_id, run_id, finding_id, reviewer_id) do update
      set disposition = excluded.disposition,
          comment = excluded.comment,
          updated_at = now()
      """)
  void upsertFeedback(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("runId") String runId,
      @Param("findingId") String findingId,
      @Param("reviewerId") String reviewerId,
      @Param("disposition") String disposition,
      @Param("comment") String comment);

  @Select("select count(*) from ludong_poc_ai_review_feedback where tenant_id = #{tenantId}")
  int countFeedback(@Param("tenantId") String tenantId);

  @Select("""
      select count(*) from ludong_poc_ai_review_feedback
      where tenant_id = #{tenantId} and disposition = #{disposition}
      """)
  int countFeedbackByDisposition(
      @Param("tenantId") String tenantId,
      @Param("disposition") String disposition);
}
