package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.PlatformTenant;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface PlatformTenantMapper {

  @Insert("""
      insert into tenants (id, name, plan, status, enabled_features, user_limit)
      values (#{id}, #{name}, #{plan}, #{status}, #{enabledFeaturesJson}::jsonb, #{userLimit})
      """)
  void insertTenant(
      @Param("id") String id,
      @Param("name") String name,
      @Param("plan") String plan,
      @Param("status") String status,
      @Param("enabledFeaturesJson") String enabledFeaturesJson,
      @Param("userLimit") Integer userLimit);

  @Insert("""
      insert into enterprises (id, name, type, industry, verified)
      values (#{id}, #{name}, 'buyer', #{industry}, #{verified})
      """)
  void insertBuyerEnterprise(
      @Param("id") String id,
      @Param("name") String name,
      @Param("industry") String industry,
      @Param("verified") Boolean verified);

  @Insert("""
      insert into roles (id, tenant_id, scope, name, permissions)
      values (#{id}, #{tenantId}, 'buyer', #{name}, #{permissionsJson}::jsonb)
      """)
  void insertBuyerAdminRole(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("permissionsJson") String permissionsJson);

  @Insert("""
      insert into users (id, tenant_id, name, mobile, email, status, department_id, password_hash)
      values (#{id}, #{tenantId}, #{name}, #{mobile}, #{email}, #{status}, null, #{passwordHash})
      """)
  void insertInitialBuyerAdminUser(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("status") String status,
      @Param("passwordHash") String passwordHash);

  @Insert("""
      insert into user_roles (user_id, role_id)
      values (#{userId}, #{roleId})
      """)
  void assignUserRole(
      @Param("userId") String userId,
      @Param("roleId") String roleId);

  @Insert("""
      insert into approval_templates (
        template_code, tenant_id, biz_type, name, default_approver_role_id, status, sort_order
      )
      values (
        #{templateCode}, #{tenantId}, #{bizType}, #{name}, #{defaultApproverRoleId}, #{status}, #{sortOrder}
      )
      """)
  void insertApprovalTemplate(
      @Param("templateCode") String templateCode,
      @Param("tenantId") String tenantId,
      @Param("bizType") String bizType,
      @Param("name") String name,
      @Param("defaultApproverRoleId") String defaultApproverRoleId,
      @Param("status") String status,
      @Param("sortOrder") Integer sortOrder);

  @Select("""
      select id, name, plan, status, enabled_features::text as enabled_features_json, user_limit
      from tenants
      order by created_at desc
      """)
  List<PlatformTenant> listAll();

  @Select("""
      select count(1)
      from tenants
      """)
  int countAll();

  @Select("""
      select id, name, plan, status, enabled_features::text as enabled_features_json, user_limit
      from tenants
      where id = #{tenantId}
      """)
  PlatformTenant findById(@Param("tenantId") String tenantId);

  @Update("""
      update tenants
      set enabled_features = #{enabledFeaturesJson}::jsonb,
          updated_at = now()
      where id = #{tenantId}
      """)
  int updateEnabledFeatures(
      @Param("tenantId") String tenantId,
      @Param("enabledFeaturesJson") String enabledFeaturesJson);

  @Update("""
      update tenants
      set plan = #{plan},
          user_limit = #{userLimit},
          updated_at = now()
      where id = #{tenantId}
      """)
  int updatePlan(
      @Param("tenantId") String tenantId,
      @Param("plan") String plan,
      @Param("userLimit") Integer userLimit);

  @Update("""
      update tenants
      set status = #{status},
          updated_at = now()
      where id = #{tenantId}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("status") String status);
}
