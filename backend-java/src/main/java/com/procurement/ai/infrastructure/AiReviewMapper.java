package com.procurement.ai.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;
import com.procurement.common.ai.AiContracts.Feedback;

@Mapper
public interface AiReviewMapper {
  record RunRow(String id, String tenantId, String subjectType, String subjectId, String payload,
      String payloadHash, OffsetDateTime createdAt) {}
  @Insert("""
      insert into ai_review_runs(id,tenant_id,subject_type,subject_id,source_revision,payload,payload_hash,created_by,created_at)
      values(#{id},#{tenant},#{type},#{subject},#{revision},#{payload},#{hash},#{user},#{at})
      """)
  void insertRun(@Param("id") String id, @Param("tenant") String tenant, @Param("type") String type,
      @Param("subject") String subject, @Param("revision") String revision, @Param("payload") String payload,
      @Param("hash") String hash, @Param("user") String user, @Param("at") OffsetDateTime at);
  @Select("select id,tenant_id,subject_type,subject_id,payload,payload_hash,created_at from ai_review_runs where tenant_id=#{tenant} and id=#{id}")
  RunRow find(@Param("tenant") String tenant, @Param("id") String id);
  @Select("""
      select id,tenant_id,subject_type,subject_id,payload,payload_hash,created_at from ai_review_runs
      where tenant_id=#{tenant} and subject_type=#{type} and subject_id=#{subject}
      order by created_at desc,id desc limit #{limit}
      """)
  List<RunRow> history(@Param("tenant") String tenant, @Param("type") String type,
      @Param("subject") String subject, @Param("limit") int limit);
  @Select("""
      select finding_id,disposition,comment,reviewer_id as created_by,created_at,updated_at from ai_review_feedback
      where tenant_id=#{tenant} and run_id=#{run} order by updated_at,id
      """)
  List<Feedback> feedback(@Param("tenant") String tenant, @Param("run") String run);
  @Insert("""
      insert into ai_review_feedback(id,tenant_id,run_id,finding_id,reviewer_id,disposition,comment)
      values(#{id},#{tenant},#{run},#{finding},#{user},#{disposition},#{comment,jdbcType=VARCHAR})
      on conflict(tenant_id,run_id,finding_id,reviewer_id) do update
      set disposition=excluded.disposition,comment=excluded.comment,updated_at=now()
      """)
  void saveFeedback(@Param("id") String id, @Param("tenant") String tenant, @Param("run") String run,
      @Param("finding") String finding, @Param("user") String user, @Param("disposition") String disposition,
      @Param("comment") String comment);
}
