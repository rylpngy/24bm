package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyEvaluationRecords.Round;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyEvaluationMapper {
  @Select(
      "select * from agency_evaluation_rounds where tenant_id=#{t} and package_id=#{pkg} order by"
          + " ordinal desc")
  List<Round> rounds(String t, String pkg);

  @Select("select * from agency_evaluation_rounds where tenant_id=#{t} and id=#{id}")
  Round round(String t, String id);

  @Insert(
      "insert into agency_evaluation_rounds(id,tenant_id,package_id,ordinal,config_json,created_by)"
          + " values(#{id},#{t},#{pkg},#{ordinal},cast(#{config} as jsonb),#{actor})")
  void create(String t, String pkg, String id, int ordinal, String config, String actor);

  @Update(
      "update agency_evaluation_rounds set config_json=cast(#{config} as"
          + " jsonb),version=version+1,updated_at=now() where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status='draft'")
  int save(String t, String id, long v, String config);

  @Update(
      "update agency_evaluation_rounds set status='frozen',frozen_json=cast(#{snapshot} as"
          + " jsonb),frozen_hash=#{hash},frozen_by=#{actor},frozen_at=now(),version=version+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int freeze(String t, String id, long v, String snapshot, String hash, String actor);

  @Update(
      "update agency_evaluation_rounds set"
          + " status='voided',void_reason=#{reason},version=version+1,updated_at=now() where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status<>'voided'")
  int voidRound(String t, String id, long v, String reason);
}
