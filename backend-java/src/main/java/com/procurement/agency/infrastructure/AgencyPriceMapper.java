package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyPriceRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyPriceMapper {
  @Select("select * from agency_price_rules where tenant_id=#{t} and session_id=#{session}")
  RuleRow rule(String t, String session);

  @Insert(
      "insert into agency_price_rules(id,tenant_id,session_id,config_json,created_by)"
          + " values(#{id},#{t},#{session},cast(#{json} as jsonb),#{actor})")
  void create(String id, String t, String session, String json, String actor);

  @Update(
      "update agency_price_rules set config_json=cast(#{json} as jsonb),version=version+1 where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int save(String t, String id, long v, String json);

  @Update(
      "update agency_price_rules set frozen_json=cast(#{json} as"
          + " jsonb),frozen_hash=#{hash},status='frozen',version=version+1,frozen_at=now() where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int freeze(String t, String id, long v, String json, String hash);

  @Select(
      "select * from agency_price_calculations where tenant_id=#{t} and session_id=#{session} order"
          + " by created_at desc,id limit 30")
  List<Calculation> history(String t, String session);

  @Select(
      "select count(*) from agency_price_calculations where tenant_id=#{t} and"
          + " session_id=#{session}")
  int count(String t, String session);

  @Insert(
      "insert into"
          + " agency_price_calculations(id,tenant_id,session_id,rule_id,rule_hash,basis_fingerprint,input_fingerprint,scope_json,trace_json,evidence_version_id,evidence_hash,reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.ruleId},#{a.ruleHash},#{a.basisFingerprint},#{a.inputFingerprint},cast(#{a.scopeJson}"
          + " as jsonb),cast(#{a.traceJson} as"
          + " jsonb),#{a.evidenceVersionId},#{a.evidenceHash},#{a.reason},#{a.createdBy})")
  void createCalculation(@Param("a") Calculation a);

  @Select(
      "select * from agency_price_calculations where tenant_id=#{t} and session_id=#{session} and"
          + " id=#{id}")
  Calculation calculation(String t, String session, String id);
}
