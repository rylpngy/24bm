package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyOfficeEditRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyOfficeEditMapper {
  @Select(
      "select * from agency_office_sessions where tenant_id=#{t} and document_id=#{doc} order by"
          + " created_at desc,id")
  List<Session> sessions(String t, String doc);

  @Select("select * from agency_office_sessions where tenant_id=#{t} and id=#{id}")
  Session session(String t, String id);

  @Select("select * from agency_office_sessions where tenant_id=#{t} and id=#{id} for update")
  Session lock(String t, String id);

  @Insert(
      "insert into"
          + " agency_office_sessions(id,tenant_id,package_id,document_id,source_revision_id,source_file_version_id,source_hash,base_version,basis_hash,document_key,source_ticket_hash,expires_at,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.documentId},#{r.sourceRevisionId},#{r.sourceFileVersionId},#{r.sourceHash},#{r.baseVersion},#{r.basisHash},#{r.documentKey},#{r.sourceTicketHash},#{r.expiresAt},#{r.createdBy})")
  void create(@Param("r") Session r);

  @Select(
      "select * from agency_office_saves where tenant_id=#{t} and session_id=#{id} order by ordinal"
          + " desc")
  List<Save> saves(String t, String id);

  @Insert(
      "insert into"
          + " agency_office_saves(id,tenant_id,session_id,ordinal,file_version_id,file_hash,callback_hash,callback_status)"
          + " values(#{r.id},#{r.tenantId},#{r.sessionId},#{r.ordinal},#{r.fileVersionId},#{r.fileHash},#{r.callbackHash},#{r.callbackStatus})")
  void save(@Param("r") Save r);

  @Update(
      "update agency_office_sessions set"
          + " state=#{state},version=version+1,last_error=#{error},adopted_revision_id=#{revision}"
          + " where tenant_id=#{t} and id=#{id} and version=#{v}")
  int state(String t, String id, long v, String state, String error, String revision);

  @Update(
      "update agency_office_sessions set"
          + " state='expired',version=version+1,last_error='编辑会话已过期，已保存副本仍保留' where tenant_id=#{t}"
          + " and document_id=#{doc} and state in ('active','ready') and expires_at<now()")
  void expire(String t, String doc);

  @Select(
      "select count(*) from agency_office_events where tenant_id=#{t} and session_id=#{id} and"
          + " callback_hash=#{hash}")
  int seen(String t, String id, String hash);

  @Insert(
      "insert into agency_office_events(id,tenant_id,session_id,callback_hash,status,note)"
          + " values(#{id},#{t},#{session},#{hash},#{status},#{note})")
  void event(String t, String id, String session, String hash, int status, String note);
}
