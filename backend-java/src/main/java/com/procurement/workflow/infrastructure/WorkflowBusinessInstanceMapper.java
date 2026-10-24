package com.procurement.workflow.infrastructure;

import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface WorkflowBusinessInstanceMapper {

  @Insert("""
      insert into workflow_business_instances (
        id, tenant_id, business_type, business_id, definition_version_id,
        flowable_process_instance_id, status, initiator_id, department_id, amount,
        form_data, business_snapshot
      ) values (
        #{id}, #{tenantId}, #{businessType}, #{businessId}, #{definitionVersionId},
        #{flowableProcessInstanceId}, #{status}, #{initiatorId}, #{departmentId,jdbcType=VARCHAR}, #{amount},
        #{formData}::jsonb, #{businessSnapshot}::jsonb
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType,
      @Param("businessId") String businessId,
      @Param("definitionVersionId") String definitionVersionId,
      @Param("flowableProcessInstanceId") String flowableProcessInstanceId,
      @Param("status") String status,
      @Param("initiatorId") String initiatorId,
      @Param("departmentId") String departmentId,
      @Param("amount") BigDecimal amount,
      @Param("formData") String formData,
      @Param("businessSnapshot") String businessSnapshot);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId} and id = #{id}
      """)
  WorkflowBusinessInstance findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("id") String id);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId} and id = #{id}
      for update
      """)
  WorkflowBusinessInstance findByTenantAndIdForUpdate(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId} and flowable_process_instance_id = #{flowableProcessInstanceId}
      for update
      """)
  WorkflowBusinessInstance findByTenantAndFlowableProcessInstanceId(
      @Param("tenantId") String tenantId,
      @Param("flowableProcessInstanceId") String flowableProcessInstanceId);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
        and business_type = #{businessType}
        and business_id = #{businessId}
        and status = 'processing'
      order by created_at desc
      limit 1
      """)
  WorkflowBusinessInstance findActiveByBusiness(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType,
      @Param("businessId") String businessId);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
        and business_type = #{businessType}
        and business_id = #{businessId}
      order by created_at desc
      limit 1
      """)
  WorkflowBusinessInstance findLatestByBusiness(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType,
      @Param("businessId") String businessId);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
        and business_type = #{businessType}
        and business_snapshot ->> #{referenceField} = #{referenceValue}
      order by created_at desc
      limit 1
      """)
  WorkflowBusinessInstance findLatestByBusinessReference(
      @Param("tenantId") String tenantId,
      @Param("businessType") String businessType,
      @Param("referenceField") String referenceField,
      @Param("referenceValue") String referenceValue);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             null::text as form_data, null::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId} and business_type = #{businessType} and business_id = #{businessId}
      order by created_at desc, id desc
      limit #{limit}
      """)
  List<WorkflowBusinessInstance> listByBusiness(@Param("tenantId") String tenantId,
      @Param("businessType") String businessType, @Param("businessId") String businessId, @Param("limit") int limit);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
      order by updated_at desc
      limit #{limit}
      """)
  List<WorkflowBusinessInstance> listByTenant(
      @Param("tenantId") String tenantId,
      @Param("limit") int limit);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
        and initiator_id = #{initiatorId}
      order by updated_at desc
      limit #{limit}
      """)
  List<WorkflowBusinessInstance> listByTenantAndInitiator(
      @Param("tenantId") String tenantId,
      @Param("initiatorId") String initiatorId,
      @Param("limit") int limit);

  @Select("""
      select w.id, w.tenant_id, w.business_type, w.business_id, w.definition_version_id,
             w.flowable_process_instance_id, w.status, w.initiator_id, w.department_id, w.amount,
             w.form_data::text as form_data, w.business_snapshot::text as business_snapshot,
             w.completed_by, w.completed_at, w.created_at, w.updated_at
      from workflow_business_instances w
      where w.tenant_id = #{tenantId}
        and exists (
          select 1
          from workflow_task_events e
          where e.workflow_instance_id = w.id
            and e.tenant_id = w.tenant_id
            and e.actor_id = #{actorId}
            and e.action in ('approved', 'rejected')
        )
      order by w.updated_at desc
      limit #{limit}
      """)
  List<WorkflowBusinessInstance> listActedByTenantUser(
      @Param("tenantId") String tenantId,
      @Param("actorId") String actorId,
      @Param("limit") int limit);

  @Select("""
      select id, tenant_id, business_type, business_id, definition_version_id,
             flowable_process_instance_id, status, initiator_id, department_id, amount,
             form_data::text as form_data, business_snapshot::text as business_snapshot,
             completed_by, completed_at, created_at, updated_at
      from workflow_business_instances
      where tenant_id = #{tenantId}
        and status = #{status}
      order by updated_at desc
      limit #{limit}
      """)
  List<WorkflowBusinessInstance> listByTenantAndStatus(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("limit") int limit);

  @Update("""
      update workflow_business_instances
      set status = #{nextStatus},
          completed_by = #{completedBy,jdbcType=VARCHAR},
          completed_at = now(),
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = 'processing'
      """)
  int complete(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("nextStatus") String nextStatus,
      @Param("completedBy") String completedBy);
}
