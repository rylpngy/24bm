package com.procurement.agency.infrastructure;

import java.time.OffsetDateTime;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyDocumentPreviewMapper {
  record Preview(
      String id,
      String tenantId,
      String packageId,
      String revisionId,
      String sourceHash,
      String fileVersionId,
      String fileHash,
      String jobId,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Select(
      "select * from agency_document_previews where tenant_id=#{t} and revision_id=#{r} order by"
          + " created_at desc")
  List<Preview> previews(String t, String r);

  @Insert(
      "insert into"
          + " agency_document_previews(id,tenant_id,package_id,revision_id,source_hash,file_version_id,file_hash,job_id,created_by)"
          + " values(#{p.id},#{p.tenantId},#{p.packageId},#{p.revisionId},#{p.sourceHash},#{p.fileVersionId},#{p.fileHash},#{p.jobId},#{p.createdBy})")
  void create(@Param("p") Preview p);
}
