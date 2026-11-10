package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyOpeningRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyOpeningMapper {
  @Select("select * from agency_opening_plans where tenant_id=#{t} and round_id=#{round}")
  Plan plan(String t, String round);

  @Insert(
      "insert into agency_opening_plans(tenant_id,round_id,package_id,config_json,created_by)"
          + " values(#{t},#{round},#{pkg},cast(#{json} as jsonb),#{actor})")
  void createPlan(String t, String round, String pkg, String json, String actor);

  @Update(
      "update agency_opening_plans set config_json=cast(#{json} as"
          + " jsonb),version=version+1,updated_at=now() where tenant_id=#{t} and round_id=#{round}"
          + " and version=#{v} and status='draft'")
  int savePlan(String t, String round, long v, String json);

  @Update(
      "update agency_opening_plans set status=#{next},version=version+1,updated_at=now() where"
          + " tenant_id=#{t} and round_id=#{round} and version=#{v} and status=#{old}")
  int planState(String t, String round, long v, String old, String next);

  @Select(
      "select * from agency_response_receipts where tenant_id=#{t} and round_id=#{round} order by"
          + " created_at,id")
  List<Receipt> receipts(String t, String round);

  @Select("select * from agency_response_receipts where tenant_id=#{t} and file_id=#{file}")
  Receipt receiptFile(String t, String file);

  @Select("select * from agency_response_receipts where tenant_id=#{t} and id=#{id}")
  Receipt receipt(String t, String id);

  @Insert(
      "insert into"
          + " agency_response_receipts(id,tenant_id,package_id,round_id,participation_id,item_key,file_id,received_at,original_type,source_note,note,late_entry_reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.roundId},#{a.participationId},#{a.itemKey},#{a.fileId},#{a.receivedAt},#{a.originalType},#{a.sourceNote},#{a.note},#{a.lateEntryReason},#{a.createdBy})")
  void createReceipt(@Param("a") Receipt a);

  @Update(
      "update agency_response_receipts set"
          + " status='withdrawn',version=version+1,withdraw_reason=#{reason} where tenant_id=#{t}"
          + " and id=#{id} and version=#{v} and status='received'")
  int withdraw(String t, String id, long v, String reason);

  @Select("select * from agency_response_openings where tenant_id=#{t} and round_id=#{round}")
  Opening opening(String t, String round);

  @Insert(
      "insert into"
          + " agency_response_openings(id,tenant_id,package_id,round_id,manifest_json,manifest_hash,subjects_json,opened_at,evidence_version_id,evidence_hash,note,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.roundId},cast(#{a.manifestJson} as"
          + " jsonb),#{a.manifestHash},cast(#{a.subjectsJson} as"
          + " jsonb),#{a.openedAt},#{a.evidenceVersionId},#{a.evidenceHash},#{a.note},#{a.createdBy})")
  void createOpening(@Param("a") Opening a);

  @Select(
      "select * from agency_assessment_stages where tenant_id=#{t} and session_id=#{session} order"
          + " by created_at,id")
  List<Release> stages(String t, String session);

  @Insert(
      "insert into"
          + " agency_assessment_stages(id,tenant_id,session_id,stage_key,subjects_json,prerequisite_hash,evidence_version_id,evidence_hash,note,exclusions_json,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.stageKey},cast(#{a.subjectsJson} as"
          + " jsonb),#{a.prerequisiteHash},#{a.evidenceVersionId},#{a.evidenceHash},#{a.note},cast(#{a.exclusionsJson}"
          + " as jsonb),#{a.createdBy})")
  void release(@Param("a") Release a);
}
