package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyAssessmentMapper {
  @Select("select * from agency_assessment_sessions where tenant_id=#{t} and round_id=#{round}")
  Session byRound(String t, String round);

  @Select("select * from agency_assessment_sessions where tenant_id=#{t} and id=#{id}")
  Session session(String t, String id);

  @Insert(
      "insert into"
          + " agency_assessment_sessions(id,tenant_id,package_id,round_id,round_hash,subjects_json,opening_evidence_version_id,opening_hash,opened_at,note,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.roundId},#{a.roundHash},cast(#{a.subjectsJson}"
          + " as jsonb),#{a.openingEvidenceVersionId},#{a.openingHash},#{a.openedAt},#{a.note},#{a.createdBy})")
  void createSession(@Param("a") Session a);

  @Select(
      "select"
          + " id,tenant_id,session_id,user_id,stage_key,ordinal,status,entries_json,version,previous_id,correction_id,content_hash,submitted_at,updated_at"
          + " from agency_assessment_sheets where tenant_id=#{t} and session_id=#{session} and"
          + " user_id=#{user} order by ordinal desc")
  List<Sheet> sheets(String t, String session, String user);

  @Select(
      "select"
          + " id,tenant_id,session_id,user_id,stage_key,ordinal,status,entries_json,version,previous_id,correction_id,content_hash,submitted_at,updated_at"
          + " from agency_assessment_sheets where tenant_id=#{t} and id=#{id}")
  Sheet sheet(String t, String id);

  @Insert(
      "insert into"
          + " agency_assessment_sheets(id,tenant_id,session_id,user_id,stage_key,ordinal,entries_json,previous_id,correction_id)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.userId},#{a.stageKey},#{a.ordinal},cast(#{a.entriesJson}"
          + " as jsonb),#{a.previousId},#{a.correctionId})")
  void createSheet(@Param("a") Sheet a);

  @Update(
      "update agency_assessment_sheets set entries_json=cast(#{json} as"
          + " jsonb),version=version+1,updated_at=now() where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status='draft'")
  int save(String t, String id, long v, String json);

  @Update(
      "update agency_assessment_sheets set"
          + " status='submitted',content_hash=#{hash},submitted_at=now(),version=version+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int submit(String t, String id, long v, String hash);

  @Select(
      "select * from agency_assessment_corrections where tenant_id=#{t} and session_id=#{session}"
          + " and user_id=#{user} order by created_at desc")
  List<Correction> corrections(String t, String session, String user);

  @Select("select * from agency_assessment_corrections where tenant_id=#{t} and id=#{id}")
  Correction correction(String t, String id);

  @Insert(
      "insert into"
          + " agency_assessment_corrections(id,tenant_id,session_id,sheet_id,user_id,sheet_version,sheet_hash,cells_json,reason,evidence_version_id,evidence_hash,status)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.sheetId},#{a.userId},#{a.sheetVersion},#{a.sheetHash},cast(#{a.cellsJson}"
          + " as jsonb),#{a.reason},#{a.evidenceVersionId},#{a.evidenceHash},'processing')")
  void createCorrection(@Param("a") Correction a);

  @Update(
      "update agency_assessment_corrections set workflow_id=#{workflow} where tenant_id=#{t} and"
          + " id=#{id} and status='processing' and workflow_id is null")
  int bind(String t, String id, String workflow);

  @Update(
      "update agency_assessment_corrections set status=#{status},result_note=#{note} where"
          + " tenant_id=#{t} and id=#{id} and status='processing' and workflow_id=#{workflow}")
  int complete(String t, String id, String workflow, String status, String note);
}
