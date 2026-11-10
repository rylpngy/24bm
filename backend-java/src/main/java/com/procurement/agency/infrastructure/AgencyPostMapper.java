package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyPostRecords.*;
import com.procurement.agency.domain.AgencyPostRecords.Result;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyPostMapper {
  @Select("select * from agency_post_controls where tenant_id=#{t} and package_id=#{p}")
  Control control(String t, String p);

  @Insert(
      "insert into"
          + " agency_post_controls(tenant_id,package_id,state,evidence_hash,authority_note,updated_by)"
          + " values(#{t},#{p},#{state},#{hash},#{note},#{actor}) on conflict(tenant_id,package_id)"
          + " do update set"
          + " state=excluded.state,version=agency_post_controls.version+1,evidence_hash=excluded.evidence_hash,authority_note=excluded.authority_note,updated_by=excluded.updated_by,updated_at=now()")
  void controlState(String t, String p, String state, String hash, String note, String actor);

  @Select(
      "select * from agency_post_results where tenant_id=#{t} and package_id=#{p} order by ordinal"
          + " desc")
  List<Result> results(String t, String p);

  @Select("select * from agency_post_results where tenant_id=#{t} and id=#{id}")
  Result result(String t, String id);

  @Insert(
      "insert into"
          + " agency_post_results(id,tenant_id,package_id,session_id,ordinal,previous_id,kind,report_id,source_fingerprint,snapshot_json,frozen_hash,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.sessionId},#{r.ordinal},#{r.previousId},#{r.kind},#{r.reportId},#{r.sourceFingerprint},cast(#{r.snapshotJson}"
          + " as jsonb),#{r.frozenHash},#{r.createdBy})")
  void createResult(@Param("r") Result r);

  @Select(
      "select * from agency_post_documents where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<Document> documents(String t, String p);

  @Select("select * from agency_post_documents where tenant_id=#{t} and id=#{id}")
  Document document(String t, String id);

  @Insert(
      "insert into"
          + " agency_post_documents(id,tenant_id,package_id,result_id,kind,snapshot_json,frozen_hash,file_version_id,file_hash,created_by)"
          + " values(#{d.id},#{d.tenantId},#{d.packageId},#{d.resultId},#{d.kind},cast(#{d.snapshotJson}"
          + " as jsonb),#{d.frozenHash},#{d.fileVersionId},#{d.fileHash},#{d.createdBy})")
  void createDocument(@Param("d") Document d);

  @Update(
      "update agency_post_documents set status=#{after},version=version+1,workflow_id=#{wf} where"
          + " tenant_id=#{t} and id=#{id} and status=#{before} and version=#{v}")
  int state(String t, String id, long v, String before, String after, String wf);

  @Insert(
      "insert into"
          + " agency_post_events(id,tenant_id,package_id,object_id,kind,snapshot_json,frozen_hash,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.objectId},#{r.kind},cast(#{r.snapshotJson}"
          + " as jsonb),#{r.frozenHash},#{r.createdBy})")
  void event(@Param("r") Event r);

  @Select(
      "select * from agency_post_events where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<Event> events(String t, String p);

  @Select(
      "select * from agency_post_issues where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<Issue> issues(String t, String p);

  @Select("select * from agency_post_issues where tenant_id=#{t} and id=#{id}")
  Issue issue(String t, String id);

  @Insert(
      "insert into agency_post_issues(id,tenant_id,package_id,snapshot_json,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},cast(#{r.snapshotJson} as"
          + " jsonb),#{r.createdBy})")
  void createIssue(@Param("r") Issue r);

  @Update(
      "update agency_post_issues set version=version+1,status=#{status},snapshot_json=cast(#{raw}"
          + " as jsonb) where tenant_id=#{t} and id=#{id} and version=#{v}")
  int updateIssue(String t, String id, long v, String status, String raw);
}
