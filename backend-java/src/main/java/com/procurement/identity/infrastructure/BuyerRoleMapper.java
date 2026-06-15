package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerRole;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BuyerRoleMapper {

  @Select("""
      select id, tenant_id, name, permissions
      from roles
      where tenant_id = #{tenantId}
        and scope = 'buyer'
      order by name asc
      """)
  @Results(id = "buyerRoleResults", value = {
      @Result(column = "tenant_id", property = "tenantId")
  })
  List<BuyerRole> listBuyerRolesByTenant(@Param("tenantId") String tenantId);
}
