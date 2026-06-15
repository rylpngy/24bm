package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.AuthenticatedUser;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuthenticationUserMapper {

  @Select("""
      select u.id as user_id, u.tenant_id, u.supplier_id, u.name as display_name
      from users u
      where u.status = 'active'
        and (u.email = #{account} or u.mobile = #{account} or u.id = #{account})
        and (
          (#{scope} = 'PLATFORM' and u.tenant_id is null and u.supplier_id is null)
          or (#{scope} = 'BUYER' and u.tenant_id = #{tenantId} and u.supplier_id is null)
          or (#{scope} = 'SUPPLIER' and u.supplier_id = #{supplierId} and u.tenant_id is null)
        )
      limit 1
      """)
  @Results(id = "authenticatedUserResults", value = {
      @Result(column = "user_id", property = "userId"),
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "display_name", property = "displayName")
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
