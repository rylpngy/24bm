package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyTotalRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyTotalMapper {
  @Select("select * from agency_total_rules where tenant_id=#{t} and session_id=#{session}")
  RuleRow rule(String t, String session);

  @Insert(
      "insert into agency_total_rules(id,tenant_id,session_id,config_json,created_by)"
          + " values(#{id},#{t},#{session},cast(#{json} as jsonb),#{actor})")
  void create(String id, String t, String session, String json, String actor);

  @Update(
      "update agency_total_rules set config_json=cast(#{json} as jsonb),version=version+1 where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int save(String t, String id, long v, String json);

  @Update(
      "update agency_total_rules set frozen_json=cast(#{json} as"
          + " jsonb),frozen_hash=#{hash},status='frozen',version=version+1,frozen_at=now() where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int freeze(String t, String id, long v, String json, String hash);

  @Select(
      "select * from agency_assessment_totals where tenant_id=#{t} and session_id=#{session} order"
          + " by created_at desc,id limit 30")
  List<Snapshot> history(String t, String session);

  @Select(
      "select count(*) from agency_assessment_totals where tenant_id=#{t} and"
          + " session_id=#{session}")
  int count(String t, String session);

  @Insert(
      "insert into"
          + " agency_assessment_totals(id,tenant_id,session_id,rule_id,rule_hash,price_calculation_id,basis_fingerprint,input_fingerprint,trace_json,evidence_version_id,evidence_hash,reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.ruleId},#{a.ruleHash},#{a.priceCalculationId},#{a.basisFingerprint},#{a.inputFingerprint},cast(#{a.traceJson}"
          + " as jsonb),#{a.evidenceVersionId},#{a.evidenceHash},#{a.reason},#{a.createdBy})")
  void snapshot(@Param("a") Snapshot a);

  @Select(
      "select * from agency_assessment_totals where tenant_id=#{t} and session_id=#{s} and"
          + " id=#{id}")
  Snapshot findSnapshot(String t, String s, String id);
}
