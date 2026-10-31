package com.procurement.tender.infrastructure;

import com.procurement.tender.domain.TenderScoringWeights;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface TenderScoringRuleMapper {
  record Rule(int revision, BigDecimal technicalWeight, BigDecimal commercialWeight, BigDecimal priceWeight,
      String reason, String createdBy, OffsetDateTime createdAt) {
    public TenderScoringWeights weights() { return new TenderScoringWeights(technicalWeight, commercialWeight, priceWeight); }
  }
  @Select("select revision,technical_weight,commercial_weight,price_weight,reason,created_by,created_at from tender_scoring_rules where tenant_id=#{tenantId} and tender_id=#{tenderId} order by revision desc limit 1")
  Rule latest(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);
  @Select("select revision,technical_weight,commercial_weight,price_weight,reason,created_by,created_at from tender_scoring_rules where tenant_id=#{tenantId} and tender_id=#{tenderId} order by revision desc")
  List<Rule> history(@Param("tenantId") String tenantId,@Param("tenderId") String tenderId);
  @Insert("insert into tender_scoring_rules(tenant_id,tender_id,revision,technical_weight,commercial_weight,price_weight,reason,created_by) values(#{tenantId},#{tenderId},#{revision},#{weights.technical},#{weights.commercial},#{weights.price},#{reason},#{actor})")
  void insert(@Param("tenantId") String tenantId,@Param("tenderId") String tenderId,@Param("revision") int revision,
      @Param("weights") TenderScoringWeights weights,@Param("reason") String reason,@Param("actor") String actor);
}
