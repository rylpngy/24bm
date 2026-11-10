package com.procurement.agency.infrastructure;

import com.procurement.agency.application.AgencyQuoteService.Layer;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyQuoteMapper {
  @Select(
      "select * from agency_quote_layers where tenant_id=#{t} and session_id=#{session} order by"
          + " ordinal desc,created_at desc")
  List<Layer> list(String t, String session);

  @Insert(
      "insert into"
          + " agency_quote_layers(id,tenant_id,session_id,participation_id,ordinal,previous_id,original_amount,corrected_amount,evaluation_amount,currency,kind,evidence_version_id,evidence_hash,reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.participationId},#{a.ordinal},#{a.previousId},#{a.originalAmount},#{a.correctedAmount},#{a.evaluationAmount},#{a.currency},#{a.kind},#{a.evidenceVersionId},#{a.evidenceHash},#{a.reason},#{a.createdBy})")
  void create(@Param("a") Layer a);
}
