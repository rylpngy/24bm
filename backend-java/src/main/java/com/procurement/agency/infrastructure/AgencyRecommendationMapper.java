package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyRecommendationRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyRecommendationMapper {
  @Insert(
      "insert into agency_report_contributors(tenant_id,report_id,user_id)"
          + " values(#{t},#{id},#{user}) on conflict do nothing")
  void contributor(String t, String id, String user);

  @Select(
      "select user_id from agency_report_contributors where tenant_id=#{t} and report_id=#{id}"
          + " order by user_id")
  List<String> contributors(String t, String id);

  @Select(
      "select * from agency_recommendations where tenant_id=#{t} and session_id=#{s} order by"
          + " ordinal desc")
  List<Recommendation> recommendations(String t, String s);

  @Select("select * from agency_recommendations where tenant_id=#{t} and id=#{id}")
  Recommendation recommendation(String t, String id);

  @Insert(
      "insert into"
          + " agency_recommendations(id,tenant_id,package_id,session_id,round_id,ordinal,source_fingerprint,snapshot_json,frozen_hash,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.sessionId},#{r.roundId},#{r.ordinal},#{r.sourceFingerprint},cast(#{r.snapshotJson}"
          + " as jsonb),#{r.frozenHash},#{r.createdBy})")
  void createRecommendation(@Param("r") Recommendation r);

  @Select(
      "select * from agency_evaluation_reports where tenant_id=#{t} and session_id=#{s} order by"
          + " created_at desc,id")
  List<Report> reports(String t, String s);

  @Select("select * from agency_evaluation_reports where tenant_id=#{t} and id=#{id}")
  Report report(String t, String id);

  @Insert(
      "insert into"
          + " agency_evaluation_reports(id,tenant_id,package_id,session_id,recommendation_id,narrative_json,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.sessionId},#{r.recommendationId},cast(#{r.narrativeJson}"
          + " as jsonb),#{r.createdBy})")
  void createReport(@Param("r") Report r);

  @Update(
      "update agency_evaluation_reports set narrative_json=cast(#{json} as"
          + " jsonb),version=version+1,status='draft' where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status in ('draft','rejected')")
  int saveReport(String t, String id, long v, String json);

  @Update(
      "update agency_evaluation_reports set"
          + " artifact_version_id=#{file},artifact_hash=#{hash},artifact_basis_version=#{v} where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status in ('draft','rejected')")
  int artifact(String t, String id, long v, String file, String hash);

  @Insert(
      "insert into"
          + " agency_report_artifacts(id,tenant_id,report_id,report_version,file_version_id,file_hash,source_fingerprint,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.reportId},#{a.reportVersion},#{a.fileVersionId},#{a.fileHash},#{a.sourceFingerprint},#{a.createdBy})")
  void createArtifact(@Param("a") Artifact a);

  @Select(
      "select a.* from agency_report_artifacts a join agency_evaluation_reports r on"
          + " r.tenant_id=a.tenant_id and r.id=a.report_id where a.tenant_id=#{t} and"
          + " r.session_id=#{s} order by a.created_at desc,a.id")
  List<Artifact> artifacts(String t, String s);

  @Select(
      "select r.* from agency_evaluation_reports r join agency_report_artifacts a on"
          + " a.tenant_id=r.tenant_id and a.report_id=r.id join agency_file_versions v on"
          + " v.tenant_id=a.tenant_id and v.id=a.file_version_id where r.tenant_id=#{t} and"
          + " v.file_id=#{file} limit 1")
  Report fileReport(String t, String file);

  @Insert(
      "insert into"
          + " agency_report_submissions(id,tenant_id,report_id,report_version,source_fingerprint,snapshot_json,frozen_hash,created_by)"
          + " values(#{s.id},#{s.tenantId},#{s.reportId},#{s.reportVersion},#{s.sourceFingerprint},cast(#{s.snapshotJson}"
          + " as jsonb),#{s.frozenHash},#{s.createdBy})")
  void createSubmission(@Param("s") Submission s);

  @Select("select * from agency_report_submissions where tenant_id=#{t} and id=#{id}")
  Submission submission(String t, String id);

  @Select(
      "select s.* from agency_report_submissions s join agency_evaluation_reports r on"
          + " r.tenant_id=s.tenant_id and r.id=s.report_id where s.tenant_id=#{t} and"
          + " r.session_id=#{session} order by s.created_at desc,s.id")
  List<Submission> submissions(String t, String session);

  @Update(
      "update agency_report_submissions set workflow_id=#{workflow} where tenant_id=#{t} and"
          + " id=#{id} and workflow_id is null and status='processing'")
  int bind(String t, String id, String workflow);

  @Update(
      "update agency_evaluation_reports set status=#{after},version=version+1 where tenant_id=#{t}"
          + " and id=#{id} and version=#{v} and status=#{before}")
  int state(String t, String id, long v, String before, String after);

  @Update(
      "update agency_report_submissions set status=#{status},result_note=#{note} where"
          + " tenant_id=#{t} and id=#{id} and workflow_id=#{workflow} and status='processing'")
  int complete(String t, String id, String workflow, String status, String note);

  @Update(
      "update agency_report_artifacts set file_hash=#{hash} where tenant_id=#{t} and id=#{id} and"
          + " file_hash=''")
  int artifactHash(String t, String id, String hash);
}
