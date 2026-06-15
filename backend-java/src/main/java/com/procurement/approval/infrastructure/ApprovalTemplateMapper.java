package com.procurement.approval.infrastructure;

import com.procurement.approval.domain.ApprovalTemplate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ApprovalTemplateMapper {

  @Select("""
      select template_code, tenant_id, biz_type, name, default_approver_role_id, status
      from approval_templates
      where tenant_id = #{tenantId}
        and status = 'active'
      order by sort_order asc, template_code asc
      """)
  @Results(id = "approvalTemplateResults", value = {
      @Result(column = "template_code", property = "templateCode"),
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "default_approver_role_id", property = "defaultApproverRoleId")
  })
  List<ApprovalTemplate> listActiveByTenant(@Param("tenantId") String tenantId);
}
