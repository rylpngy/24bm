package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.TenderEvaluator;
import com.procurement.tender.domain.TenderScore;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TenderEvaluationMapper {

  // ── 评标委员会 ─────────────────────────────────────────────
  @Insert("""
      insert into tender_evaluators (id, tenant_id, tender_id, evaluator_name, evaluator_role)
      values (#{id}, #{tenantId}, #{tenderId}, #{evaluatorName}, #{evaluatorRole})
      """)
  void insertEvaluator(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("evaluatorName") String evaluatorName,
      @Param("evaluatorRole") String evaluatorRole);

  @Delete("delete from tender_evaluators where tenant_id = #{tenantId} and tender_id = #{tenderId}")
  int deleteEvaluators(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("""
      select id, tenant_id, tender_id, evaluator_name, evaluator_role, created_at
      from tender_evaluators where tenant_id = #{tenantId} and tender_id = #{tenderId}
      order by case evaluator_role when '组长' then 0 else 1 end, evaluator_name, id
      """)
  List<TenderEvaluator> listEvaluators(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  // ── 评分表:同一评委对同一投标重复提交=覆盖(评分修正) ─────────
  @Insert("""
      insert into tender_scores (
        id, tenant_id, tender_id, bid_id, evaluator_id, technical_score, commercial_score,
        comment, scored_at)
      values (
        #{id}, #{tenantId}, #{tenderId}, #{bidId}, #{evaluatorId}, #{technicalScore},
        #{commercialScore}, #{comment}, #{scoredAt})
      on conflict (tenant_id, evaluator_id, bid_id) do update set
        technical_score = excluded.technical_score,
        commercial_score = excluded.commercial_score,
        comment = excluded.comment,
        scored_at = excluded.scored_at
      """)
  void upsertScore(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("tenderId") String tenderId,
      @Param("bidId") String bidId,
      @Param("evaluatorId") String evaluatorId,
      @Param("technicalScore") BigDecimal technicalScore,
      @Param("commercialScore") BigDecimal commercialScore,
      @Param("comment") String comment,
      @Param("scoredAt") OffsetDateTime scoredAt);

  @Select("""
      select id, tenant_id, tender_id, bid_id, evaluator_id, technical_score, commercial_score,
             comment, scored_at
      from tender_scores where tenant_id = #{tenantId} and tender_id = #{tenderId}
      order by scored_at, id
      """)
  List<TenderScore> listScores(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("select count(1) from tender_scores where tenant_id = #{tenantId} and tender_id = #{tenderId}")
  int countScores(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);
}
