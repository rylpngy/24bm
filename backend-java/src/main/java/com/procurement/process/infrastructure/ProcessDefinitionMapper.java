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
      select id, tenant_id, name, description, icon, status, business_type, active_version_id,
             form_schema::text as form_schema, flow_schema::text as flow_schema, published_at, updated_at
      from process_definitions
      where tenant_id = #{tenantId}
      order by updated_at desc
      """)
  List<ProcessDefinition> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, name, description, icon, status, business_type, active_version_id,
             form_schema::text as form_schema, flow_schema::text as flow_schema, published_at, updated_at
      from process_definitions
      where tenant_id = #{tenantId} and id = #{id}
      """)
  ProcessDefinition findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, name, description, icon, status, business_type, active_version_id,
             form_schema::text as form_schema, flow_schema::text as flow_schema, published_at, updated_at
      from process_definitions
      where tenant_id = #{tenantId} and id = #{id}
      for update
      """)
  ProcessDefinition findByTenantAndIdForUpdate(
      @Param("tenantId") String tenantId,
      @Param("id") String id);

  @Select("""
      select id, tenant_id, name, description, icon, status, business_type, active_version_id,
             form_schema::text as form_schema, flow_schema::text as flow_schema, published_at, updated_at
      from process_definitions
      where tenant_id = #{tenantId} and business_type = #{businessType}
      order by updated_at desc
      limit 1
      """)
  ProcessDefinition findByTenantAndBusinessType(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType);

  @Insert("""
      insert into process_definitions (id, tenant_id, name, description, icon, status, business_type)
      values (#{id}, #{tenantId}, #{name}, #{description}, #{icon}, 'draft', #{businessType,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("description") String description,
      @Param("icon") String icon,
      @Param("businessType") String businessType);

  @Update("""
      update process_definitions
      set name = #{name},
          description = #{description},
          status = #{status},
          business_type = #{businessType,jdbcType=VARCHAR},
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
      @Param("businessType") String businessType,
      @Param("formSchema") String formSchema,
      @Param("flowSchema") String flowSchema);

  @Update("""
      update process_definitions
      set status = 'enabled',
          active_version_id = #{activeVersionId},
          published_at = now(),
          published_by = #{publishedBy,jdbcType=VARCHAR},
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markPublished(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("activeVersionId") String activeVersionId,
      @Param("publishedBy") String publishedBy);

  @Update("""
      update process_definitions
      set status = 'disabled',
          active_version_id = null,
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int disable(@Param("tenantId") String tenantId, @Param("id") String id);
}
