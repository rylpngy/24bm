package com.procurement.process.infrastructure;

import com.procurement.process.domain.ProcessDefinition;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ProcessDefinitionMapper {

  @Select("""
      select id, tenant_id, name, description, icon, status,
             form_schema::text as form_schema, flow_schema::text as flow_schema, updated_at
      from process_definitions
      where tenant_id = #{tenantId}
      order by updated_at desc
      """)
  List<ProcessDefinition> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, name, description, icon, status,
             form_schema::text as form_schema, flow_schema::text as flow_schema, updated_at
      from process_definitions
      where tenant_id = #{tenantId} and id = #{id}
      """)
  ProcessDefinition findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into process_definitions (id, tenant_id, name, description, icon, status)
      values (#{id}, #{tenantId}, #{name}, #{description}, #{icon}, 'draft')
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("description") String description,
      @Param("icon") String icon);

  @Update("""
      update process_definitions
      set name = #{name},
          description = #{description},
          status = #{status},
          form_schema = #{formSchema}::jsonb,
          flow_schema = #{flowSchema}::jsonb,
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int update(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("name") String name,
      @Param("description") String description,
      @Param("status") String status,
      @Param("formSchema") String formSchema,
      @Param("flowSchema") String flowSchema);
}
