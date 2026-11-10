package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyDiscussionRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyDiscussionMapper {
  @Select("select * from agency_discussion_plans where tenant_id=#{t} and session_id=#{session}")
  Plan plan(String t, String session);

  @Insert(
      "insert into"
          + " agency_discussion_plans(tenant_id,session_id,package_id,mode,subjects_json,basis_json,frozen_hash,created_by)"
          + " values(#{a.tenantId},#{a.sessionId},#{a.packageId},'active',cast(#{a.subjectsJson} as"
          + " jsonb),cast(#{a.basisJson} as jsonb),#{a.frozenHash},#{a.createdBy})")
  void createPlan(@Param("a") Plan a);

  @Update(
      "update agency_discussion_plans set"
          + " mode='active',version=version+1,subjects_json=cast(#{subjects} as"
          + " jsonb),basis_json=cast(#{basis} as"
          + " jsonb),frozen_hash=#{hash},created_by=#{actor},created_at=now() where tenant_id=#{t}"
          + " and session_id=#{session} and version=#{v} and mode='legacy'")
  int activate(
      String t, String session, long v, String subjects, String basis, String hash, String actor);

  @Select(
      "select * from agency_supplier_discussions where tenant_id=#{t} and session_id=#{session}"
          + " order by ordinal desc,created_at desc,id")
  List<Row> records(String t, String session);

  @Select(
      "select * from agency_supplier_discussions where tenant_id=#{t} and session_id=#{session} and"
          + " participation_id=#{participant} order by ordinal desc")
  List<Row> supplier(String t, String session, String participant);

  @Select("select * from agency_supplier_discussions where tenant_id=#{t} and id=#{id}")
  Row row(String t, String id);

  @Insert(
      "insert into"
          + " agency_supplier_discussions(id,tenant_id,session_id,participation_id,ordinal,previous_id,content_json,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.participationId},#{a.ordinal},#{a.previousId},cast(#{a.contentJson}"
          + " as jsonb),#{a.createdBy})")
  void create(@Param("a") Row a);

  @Update(
      "update agency_supplier_discussions set content_json=cast(#{json} as jsonb),version=version+1"
          + " where tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int save(String t, String id, long v, String json);

  @Update(
      "update agency_supplier_discussions set"
          + " status='confirmed',version=version+1,frozen_json=cast(#{json} as"
          + " jsonb),frozen_hash=#{hash},confirmed_by=#{actor},confirmed_at=now() where"
          + " tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int confirm(String t, String id, long v, String json, String hash, String actor);

  @Update(
      "update agency_supplier_discussions set status='void',version=version+1,void_reason=#{reason}"
          + " where tenant_id=#{t} and id=#{id} and version=#{v} and status='draft'")
  int voidDraft(String t, String id, long v, String reason);
}
