package com.procurement.ludongpoc.infrastructure;

import com.procurement.ludongpoc.domain.LudongPocApplication;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface LudongPocApplicationMapper {
  @Select("""
      select v.form_schema::text from workflow_business_instances w
      join workflow_definition_versions v on v.tenant_id=w.tenant_id and v.id=w.definition_version_id
      where w.tenant_id=#{tenantId} and w.business_type='ludong_project_application' and w.business_id=#{id}
      order by w.created_at desc, w.id desc limit 1
      """)
  String latestWorkflowFormSchema(@Param("tenantId") String tenantId, @Param("id") String id);
  String COLUMNS = """
      id, tenant_id, application_no, project_name, applicant_unit, department_id,
      budget_amount, status, form_data::text as form_data_json, items::text as items_json,
      created_by, submitted_by, submitted_at, approved_at, archived_at, created_at, updated_at
      """;

  @Select("select " + COLUMNS + " from ludong_poc_applications where tenant_id = #{tenantId} order by updated_at desc")
  List<LudongPocApplication> listByTenant(@Param("tenantId") String tenantId);

  @Select("select " + COLUMNS + " from ludong_poc_applications where tenant_id = #{tenantId} and id = #{id}")
  LudongPocApplication findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("select " + COLUMNS + " from ludong_poc_applications where tenant_id = #{tenantId} and id = #{id} for update")
  LudongPocApplication findByTenantAndIdForUpdate(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into ludong_poc_applications (
        id, tenant_id, application_no, project_name, applicant_unit, department_id,
        budget_amount, status, form_data, items, created_by
      ) values (
        #{id}, #{tenantId}, #{applicationNo}, #{projectName}, #{applicantUnit},
        #{departmentId,jdbcType=VARCHAR}, #{budgetAmount}, 'draft',
        #{formDataJson}::jsonb, #{itemsJson}::jsonb, #{createdBy}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("applicationNo") String applicationNo,
      @Param("projectName") String projectName,
      @Param("applicantUnit") String applicantUnit,
      @Param("departmentId") String departmentId,
      @Param("budgetAmount") BigDecimal budgetAmount,
      @Param("formDataJson") String formDataJson,
      @Param("itemsJson") String itemsJson,
      @Param("createdBy") String createdBy);

  @Update("""
      update ludong_poc_applications
      set project_name = #{projectName}, applicant_unit = #{applicantUnit},
          department_id = #{departmentId,jdbcType=VARCHAR}, budget_amount = #{budgetAmount},
          form_data = #{formDataJson}::jsonb, items = #{itemsJson}::jsonb, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status in ('draft', 'rejected')
      """)
  int updateDraft(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("projectName") String projectName,
      @Param("applicantUnit") String applicantUnit,
      @Param("departmentId") String departmentId,
      @Param("budgetAmount") BigDecimal budgetAmount,
      @Param("formDataJson") String formDataJson,
      @Param("itemsJson") String itemsJson);

  @Update("""
      update ludong_poc_applications
      set status = 'in_approval', submitted_by = #{userId}, submitted_at = now(), updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status in ('draft', 'rejected')
      """)
  int markSubmitted(@Param("tenantId") String tenantId, @Param("id") String id, @Param("userId") String userId);

  @Update("""
      update ludong_poc_applications
      set status = #{status}, approved_at = case when #{status} = 'approved' then now() else approved_at end,
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status = 'in_approval'
      """)
  int complete(@Param("tenantId") String tenantId, @Param("id") String id, @Param("status") String status);

  @Update("""
      update ludong_poc_applications
      set status = 'archived', archived_at = now(), updated_at = now()
      where tenant_id = #{tenantId} and id = #{id} and status in ('approved', 'archived')
      """)
  int markArchived(@Param("tenantId") String tenantId, @Param("id") String id);
}
