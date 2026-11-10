package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyMethodRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyMethodMapper {
  @Select(
      "select * from agency_method_records where tenant_id=#{t} and round_id=#{round} order by"
          + " ordinal desc,kind")
  List<Row> history(String t, String round);

  @Select(
      "select * from agency_method_records where tenant_id=#{t} and round_id=#{round} and"
          + " kind=#{kind} order by ordinal desc limit 1")
  Row latest(String t, String round, String kind);

  @Select(
      "select kind from agency_method_legacy where tenant_id=#{t} and round_id=#{round} order by"
          + " kind")
  List<String> legacy(String t, String round);

  @Insert(
      "insert into"
          + " agency_method_records(id,tenant_id,package_id,round_id,kind,ordinal,previous_id,source_fingerprint,snapshot_json,frozen_hash,actor_id)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.roundId},#{r.kind},#{r.ordinal},#{r.previousId},#{r.sourceFingerprint},cast(#{r.snapshotJson}"
          + " as jsonb),#{r.frozenHash},#{r.actorId})")
  void create(@Param("r") Row r);
}
