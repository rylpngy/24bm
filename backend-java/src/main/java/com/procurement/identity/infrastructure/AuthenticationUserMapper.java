package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.AuthenticatedUser;
import java.util.List;
import org.apache.ibatis.annotations.Arg;
import org.apache.ibatis.annotations.ConstructorArgs;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthenticationUserMapper {

  @Select("""
      select u.id as user_id, u.tenant_id, u.supplier_id, u.name as display_name, u.password_hash
      from users u
      where u.status = 'active'
        and u.password_hash is not null
        and (
          u.email = #{account}
          or u.mobile = #{account}
          or u.id = #{account}
          or upper(u.employee_no) = upper(trim(#{account}))
        )
        and (
          (#{scope} = 'PLATFORM' and u.tenant_id is null and u.supplier_id is null)
          or (#{scope} = 'BUYER' and u.tenant_id = #{tenantId} and u.supplier_id is null)
          or (#{scope} = 'SUPPLIER' and u.supplier_id = #{supplierId,jdbcType=VARCHAR} and u.tenant_id is null)
        )
      limit 1
      """)
  @ConstructorArgs({
      @Arg(column = "user_id", javaType = String.class),
      @Arg(column = "tenant_id", javaType = String.class),
      @Arg(column = "supplier_id", javaType = String.class),
      @Arg(column = "display_name", javaType = String.class),
      @Arg(column = "password_hash", javaType = String.class)
  })
  AuthenticatedUser findActiveUser(
      @Param("account") String account,
      @Param("scope") String scope,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId);

  @Select("""
      select distinct case r.scope
        when 'platform' then 'PLATFORM_ADMIN'
        when 'buyer' then 'BUYER_OWNER'
        when 'supplier' then 'SUPPLIER_SALES'
      end as security_role
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = #{userId}
        and (
          (#{scope} = 'BUYER' and r.scope = 'buyer' and r.tenant_id = #{tenantId})
          or (#{scope} = 'SUPPLIER' and r.scope = 'supplier' and r.tenant_id is null)
          or (#{scope} = 'PLATFORM' and r.scope = 'platform' and r.tenant_id is null)
        )
      order by security_role
      """)
  List<String> listSecurityRoles(
      @Param("userId") String userId,
      @Param("scope") String scope,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId);
}
