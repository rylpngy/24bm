package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyFinalResponseRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyFinalResponseMapper {
  @Select("select * from agency_final_response_plans where tenant_id=#{t} and session_id=#{s}")
  Plan plan(String t, String s);

  @Select(
      "select distinct on (user_id) * from agency_final_response_sheets where tenant_id=#{t} and"
          + " session_id=#{s} order by user_id,ordinal desc")
  List<Sheet> sheets(String t, String s);

  @Select(
      "select * from agency_final_response_sheets where tenant_id=#{t} and session_id=#{s} and"
          + " user_id=#{user} order by ordinal desc limit 1")
  Sheet mine(String t, String s, String user);

  @Insert(
      "insert into"
          + " agency_final_response_plans(tenant_id,session_id,package_id,mode,snapshot_json,frozen_hash,created_by)"
          + " values(#{p.tenantId},#{p.sessionId},#{p.packageId},'active',cast(#{p.snapshotJson} as"
          + " jsonb),#{p.frozenHash},#{p.createdBy})")
  void create(@Param("p") Plan p);

  @Update(
      "update agency_final_response_plans set"
          + " mode='active',version=version+1,snapshot_json=cast(#{json} as"
          + " jsonb),frozen_hash=#{hash},created_by=#{actor},created_at=now() where tenant_id=#{t}"
          + " and session_id=#{s} and mode='legacy' and version=#{v}")
  int activate(String t, String s, long v, String json, String hash, String actor);

  @Insert(
      "insert into agency_final_response_sheets(id,tenant_id,session_id,user_id)"
          + " values(#{id},#{t},#{s},#{user})")
  void sheet(String id, String t, String s, String user);

  @Update(
      "update agency_final_response_sheets set entries_json=cast(#{json} as"
          + " jsonb),version=version+1,updated_at=now() where tenant_id=#{t} and session_id=#{s}"
          + " and user_id=#{user} and version=#{v} and status='draft'")
  int save(String t, String s, String user, long v, String json);

  @Update(
      "update agency_final_response_sheets set"
          + " status='submitted',version=version+1,snapshot_json=cast(#{json} as"
          + " jsonb),frozen_hash=#{hash},submitted_at=now(),updated_at=now() where tenant_id=#{t}"
          + " and session_id=#{s} and user_id=#{user} and version=#{v} and status='draft'")
  int submit(String t, String s, String user, long v, String json, String hash);

  @Select("select * from agency_final_response_sheets where tenant_id=#{t} and id=#{id}")
  Sheet byId(String t, String id);

  @Select(
      "select * from agency_final_response_sheets where tenant_id=#{t} and session_id=#{s} and"
          + " user_id=#{user} order by ordinal desc")
  List<Sheet> history(String t, String s, String user);

  @Insert(
      "insert into"
          + " agency_final_response_sheets(id,tenant_id,session_id,user_id,ordinal,previous_id,correction_id,entries_json)"
          + " values(#{id},#{t},#{s},#{user},#{ordinal},#{previous},#{correction},cast(#{entries}"
          + " as jsonb))")
  void revision(
      String id,
      String t,
      String s,
      String user,
      int ordinal,
      String previous,
      String correction,
      String entries);

  @Select("select * from agency_final_response_corrections where tenant_id=#{t} and id=#{id}")
  com.procurement.agency.domain.AgencyAssessmentRecords.Correction correction(String t, String id);

  @Select(
      "select * from agency_final_response_corrections where tenant_id=#{t} and session_id=#{s}"
          + " order by created_at desc,id")
  List<com.procurement.agency.domain.AgencyAssessmentRecords.Correction> corrections(
      String t, String s);

  @Insert(
      "insert into"
          + " agency_final_response_corrections(id,tenant_id,session_id,sheet_id,user_id,sheet_version,sheet_hash,cells_json,reason,evidence_version_id,evidence_hash,status)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.sheetId},#{a.userId},#{a.sheetVersion},#{a.sheetHash},cast(#{a.cellsJson}"
          + " as jsonb),#{a.reason},#{a.evidenceVersionId},#{a.evidenceHash},'processing')")
  void createCorrection(
      @Param("a") com.procurement.agency.domain.AgencyAssessmentRecords.Correction a);

  @Update(
      "update agency_final_response_corrections set workflow_id=#{workflow} where tenant_id=#{t}"
          + " and id=#{id} and status='processing' and workflow_id is null")
  int bind(String t, String id, String workflow);

  @Update(
      "update agency_final_response_corrections set status=#{status},result_note=#{note} where"
          + " tenant_id=#{t} and id=#{id} and status='processing' and workflow_id=#{workflow}")
  int completeCorrection(String t, String id, String workflow, String status, String note);
}
