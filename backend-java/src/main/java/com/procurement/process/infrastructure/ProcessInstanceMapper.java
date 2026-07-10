package com.procurement.process.infrastructure;

import com.procurement.process.domain.ProcessInstance;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ProcessInstanceMapper {

  String COLS =
      "id, tenant_id, process_id, process_name, amount, form_data::text as form_data, "
          + "resolved_path::text as resolved_path, current_index, status, initiator_id, created_at, updated_at";

  @Select("select " + COLS + " from process_instances where tenant_id = #{tenantId}"
      + " and process_id = #{processId} order by created_at desc")
  List<ProcessInstance> listByTenantAndProcess(
      @Param("tenantId") String tenantId, @Param("processId") String processId);

  @Select("select " + COLS + " from process_instances where tenant_id = #{tenantId} and id = #{id}")
  ProcessInstance findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into process_instances
        (id, tenant_id, process_id, process_name, amount, form_data, resolved_path,
         current_index, status, initiator_id)
      values
        (#{id}, #{tenantId}, #{processId}, #{processName}, #{amount}, #{formData}::jsonb,
         #{resolvedPath}::jsonb, #{currentIndex}, #{status}, #{initiatorId})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("processId") String processId,
      @Param("processName") String processName,
      @Param("amount") BigDecimal amount,
      @Param("formData") String formData,
      @Param("resolvedPath") String resolvedPath,
      @Param("currentIndex") int currentIndex,
      @Param("status") String status,
      @Param("initiatorId") String initiatorId);

  @Update("""
      update process_instances
      set current_index = #{currentIndex}, status = #{status}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int updateProgress(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentIndex") int currentIndex,
      @Param("status") String status);
}
