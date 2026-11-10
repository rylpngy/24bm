package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyRequirementChangeRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyRequirementChangeMapper {
  @Select(
      "select * from agency_requirement_changes where tenant_id=#{t} and session_id=#{session}"
          + " order by ordinal")
  List<Change> changes(String t, String session);

  @Select("select * from agency_requirement_changes where tenant_id=#{t} and id=#{id}")
  Change change(String t, String id);

  @Select(
      "select n.* from agency_requirement_notice_receipts n join agency_requirement_changes c on"
          + " c.tenant_id=n.tenant_id and c.id=n.change_id where n.tenant_id=#{t} and"
          + " c.session_id=#{session} order by c.ordinal,n.participation_id,n.ordinal")
  List<Receipt> receipts(String t, String session);

  @Insert(
      "insert into"
          + " agency_requirement_changes(id,tenant_id,session_id,package_id,ordinal,snapshot_json,frozen_hash,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.packageId},#{a.ordinal},cast(#{a.snapshotJson}"
          + " as jsonb),#{a.frozenHash},#{a.createdBy})")
  void create(@Param("a") Change a);

  @Insert(
      "insert into"
          + " agency_requirement_notice_receipts(id,tenant_id,change_id,participation_id,ordinal,previous_id,snapshot_json,frozen_hash,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.changeId},#{a.participationId},#{a.ordinal},#{a.previousId},cast(#{a.snapshotJson}"
          + " as jsonb),#{a.frozenHash},#{a.createdBy})")
  void receipt(@Param("a") Receipt a);

  @Update(
      "update agency_requirement_changes set version=version+1 where tenant_id=#{t} and id=#{id}"
          + " and version=#{v} and status='authorized'")
  int bump(String t, String id, long v);

  @Update(
      "update agency_requirement_changes set"
          + " status='notified',version=version+1,completion_json=cast(#{json} as"
          + " jsonb),completion_hash=#{hash} where tenant_id=#{t} and id=#{id} and version=#{v} and"
          + " status='authorized'")
  int complete(String t, String id, long v, String json, String hash);
}
