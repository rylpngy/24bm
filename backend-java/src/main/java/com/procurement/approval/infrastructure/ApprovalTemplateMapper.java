package com.procurement.approval.infrastructure;

import com.procurement.approval.domain.ApprovalTemplate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ApprovalTemplateMapper {

  @Select("""
      select template_code, tenant_id, biz_type, name, default_approver_role_id, status
      from approval_templates
      where tenant_id = #{tenantId}
      order by sort_order asc, template_code asc
      """)
  @Results(id = "approvalTemplateResults", value = {
      @Result(column = "template_code", property = "templateCode"),
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "default_approver_role_id", property = "defaultApproverRoleId")
  })
  List<ApprovalTemplate> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select template_code, tenant_id, biz_type, name, default_approver_role_id, status
      from approval_templates
      where tenant_id = #{tenantId}
        and template_code = #{templateCode}
      """)
  @ResultMap("approvalTemplateResults")
  ApprovalTemplate findByTenantAndCode(
      @Param("tenantId") String tenantId,
      @Param("templateCode") String templateCode);

  @Select("""
      select exists(
        select 1
        from roles
        where tenant_id = #{tenantId}
          and id = #{roleId}
          and scope = 'buyer'
      )
      """)
  boolean existsBuyerRoleByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("roleId") String roleId);

  @Update("""
      update approval_templates
      set default_approver_role_id = #{defaultApproverRoleId},
          status = #{status},
          updated_at = now()
      where tenant_id = #{tenantId}
        and template_code = #{templateCode}
      """)
  int updateTemplateConfig(
      @Param("tenantId") String tenantId,
      @Param("templateCode") String templateCode,
      @Param("defaultApproverRoleId") String defaultApproverRoleId,
      @Param("status") String status);
}
