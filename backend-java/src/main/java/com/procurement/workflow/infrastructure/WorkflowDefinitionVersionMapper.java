package com.procurement.workflow.infrastructure;

import com.procurement.workflow.domain.WorkflowDefinitionVersion;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface WorkflowDefinitionVersionMapper {

  @Select("""
      select id, tenant_id, process_definition_id, business_type, version_no, status,
             form_schema::text as form_schema, flow_schema::text as flow_schema,
             flowable_process_key, flowable_process_definition_id, flowable_deployment_id,
             published_by, published_at, created_at
      from workflow_definition_versions
      where tenant_id = #{tenantId}
        and business_type = #{businessType}
        and status = 'published'
      order by version_no desc
      limit 1
      """)
  WorkflowDefinitionVersion findPublishedByTenantAndBusinessType(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType);

  @Select("""
      select id, tenant_id, process_definition_id, business_type, version_no, status,
             form_schema::text as form_schema, flow_schema::text as flow_schema,
             flowable_process_key, flowable_process_definition_id, flowable_deployment_id,
             published_by, published_at, created_at
      from workflow_definition_versions
      where tenant_id = #{tenantId}
        and process_definition_id = #{processDefinitionId}
      order by version_no desc
      """)
  List<WorkflowDefinitionVersion> listByTenantAndProcessDefinition(
      @Param("tenantId") String tenantId,
      @Param("processDefinitionId") String processDefinitionId);

  @Select("""
      select id, tenant_id, process_definition_id, business_type, version_no, status,
             form_schema::text as form_schema, flow_schema::text as flow_schema,
             flowable_process_key, flowable_process_definition_id, flowable_deployment_id,
             published_by, published_at, created_at
      from workflow_definition_versions
      where tenant_id = #{tenantId} and id = #{id}
      """)
  WorkflowDefinitionVersion findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("id") String id);

  @Select("""
      select coalesce(max(version_no), 0) + 1
      from workflow_definition_versions
      where tenant_id = #{tenantId} and process_definition_id = #{processDefinitionId}
      """)
  int nextVersionNo(
      @Param("tenantId") String tenantId,
      @Param("processDefinitionId") String processDefinitionId);

  @Insert("""
      insert into workflow_definition_versions (
        id, tenant_id, process_definition_id, business_type, version_no, status,
        form_schema, flow_schema, flowable_process_key, flowable_process_definition_id,
        flowable_deployment_id, published_by
      ) values (
        #{id}, #{tenantId}, #{processDefinitionId}, #{businessType}, #{versionNo}, #{status},
        #{formSchema}::jsonb, #{flowSchema}::jsonb, #{flowableProcessKey}, #{flowableProcessDefinitionId},
        #{flowableDeploymentId}, #{publishedBy,jdbcType=VARCHAR}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("processDefinitionId") String processDefinitionId,
      @Param("businessType") String businessType,
      @Param("versionNo") int versionNo,
      @Param("status") String status,
      @Param("formSchema") String formSchema,
      @Param("flowSchema") String flowSchema,
      @Param("flowableProcessKey") String flowableProcessKey,
      @Param("flowableProcessDefinitionId") String flowableProcessDefinitionId,
      @Param("flowableDeploymentId") String flowableDeploymentId,
      @Param("publishedBy") String publishedBy);

  @Update("""
      update workflow_definition_versions
      set status = 'superseded'
      where tenant_id = #{tenantId}
        and business_type = #{businessType}
        and status = 'published'
      """)
  int supersedePublishedByBusinessType(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType);
}
