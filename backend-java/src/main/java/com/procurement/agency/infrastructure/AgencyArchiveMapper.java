package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyArchiveRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyArchiveMapper {
  @Select(
      "select * from agency_archive_checklist where tenant_id=#{t} and package_id=#{p} order by"
          + " item_key")
  List<Checklist> checklist(String t, String p);

  @Insert(
      "insert into"
          + " agency_archive_checklist(tenant_id,package_id,item_key,disposition,snapshot_json,updated_by)"
          + " values(#{t},#{p},#{key},#{d},cast(#{raw} as jsonb),#{actor})")
  void createChecklist(String t, String p, String key, String d, String raw, String actor);

  @Update(
      "update agency_archive_checklist set"
          + " version=version+1,disposition=#{d},snapshot_json=cast(#{raw} as"
          + " jsonb),updated_by=#{actor},updated_at=now() where tenant_id=#{t} and package_id=#{p}"
          + " and item_key=#{key} and version=#{v}")
  int updateChecklist(String t, String p, String key, long v, String d, String raw, String actor);

  @Select(
      "select * from agency_archive_snapshots where tenant_id=#{t} and package_id=#{p} order by"
          + " ordinal desc")
  List<Snapshot> snapshots(String t, String p);

  @Select("select * from agency_archive_snapshots where tenant_id=#{t} and id=#{id}")
  Snapshot snapshot(String t, String id);

  @Insert(
      "insert into"
          + " agency_archive_snapshots(id,tenant_id,package_id,ordinal,previous_id,snapshot_json,frozen_hash,source_fingerprint,complete,reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.ordinal},#{a.previousId},cast(#{a.snapshotJson}"
          + " as jsonb),#{a.frozenHash},#{a.sourceFingerprint},#{a.complete},#{a.reason},#{a.createdBy})")
  void createSnapshot(@Param("a") Snapshot a);

  @Insert(
      "insert into agency_completion_states(tenant_id,package_id,updated_by)"
          + " values(#{t},#{p},#{actor}) on conflict do nothing")
  void ensure(String t, String p, String actor);

  @Select("select * from agency_completion_states where tenant_id=#{t} and package_id=#{p}")
  Completion completion(String t, String p);

  @Update(
      "update agency_completion_states set version=version+1,business_note=case when"
          + " #{dim}='business' then #{note} else business_note end,financial_note=case when"
          + " #{dim}='financial' then #{note} else financial_note end,archive_note=case when"
          + " #{dim}='archive' then #{note} else archive_note"
          + " end,retention_years=#{years},updated_by=#{actor},updated_at=now() where"
          + " tenant_id=#{t} and package_id=#{p} and version=#{v}")
  int state(String t, String p, long v, String dim, String note, int years, String actor);

  @Update(
      "update agency_packages set business_status=case when #{dim}='business' then #{status} else"
          + " business_status end,financial_status=case when #{dim}='financial' then #{status} else"
          + " financial_status end,archive_completion=case when #{dim}='archive' then #{status}"
          + " else archive_completion end where tenant_id=#{t} and id=#{p}")
  int flags(String t, String p, String dim, String status);

  @Insert(
      "insert into"
          + " agency_completion_events(id,tenant_id,package_id,dimension,snapshot_json,frozen_hash,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.dimension},cast(#{a.snapshotJson} as"
          + " jsonb),#{a.frozenHash},#{a.createdBy})")
  void event(@Param("a") CompletionEvent a);

  @Select(
      "select * from agency_completion_events where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<CompletionEvent> events(String t, String p);
}
