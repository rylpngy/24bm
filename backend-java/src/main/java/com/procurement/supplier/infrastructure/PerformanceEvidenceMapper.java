package com.procurement.supplier.infrastructure;

import com.procurement.supplier.api.PerformanceEvidenceResponse;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PerformanceEvidenceMapper {
  @Select("select count(*) from supplier_performance_task_events where task_id=#{taskId} and action in ('remediation_requested','remediation_rejected')")
  int round(String taskId);

  @Select("select id,round,file_name,size,sha256,uploader_name,created_at from supplier_performance_evidence where task_id=#{taskId} and task_version <= #{maxVersion} order by round,created_at,id")
  List<PerformanceEvidenceResponse> list(@Param("taskId") String taskId, @Param("maxVersion") long maxVersion);

  @Select("select storage_key from supplier_performance_evidence where task_id=#{taskId} and id=#{id}")
  String key(@Param("taskId") String taskId, @Param("id") String id);

  @Insert("""
      insert into supplier_performance_evidence(id,task_id,task_version,round,file_name,storage_key,size,sha256,uploaded_by,uploader_name)
      values(#{id},#{taskId},#{version},#{round},#{name},#{key},#{size},#{hash},#{user},#{actor})
      """)
  void insert(@Param("id") String id, @Param("taskId") String taskId, @Param("version") long version,
      @Param("round") int round, @Param("name") String name, @Param("key") String key,
      @Param("size") long size, @Param("hash") String hash, @Param("user") String user, @Param("actor") String actor);
}
