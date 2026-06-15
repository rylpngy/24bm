package com.procurement.identity.infrastructure;

import com.procurement.identity.domain.BuyerUser;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BuyerUserMapper {

  @Select("""
      select id, tenant_id, name, mobile, email, status
      from users
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  @Results(id = "buyerUserResults", value = {
      @Result(column = "tenant_id", property = "tenantId")
  })
  List<BuyerUser> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, name, mobile, email, status
      from users
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singleBuyerUserResults", value = {
      @Result(column = "tenant_id", property = "tenantId")
  })
  BuyerUser findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select count(1)
      from users
      where tenant_id = #{tenantId}
      """)
  int countByTenant(@Param("tenantId") String tenantId);

  @Insert("""
      insert into users (id, tenant_id, name, mobile, email, status)
      values (#{id}, #{tenantId}, #{name}, #{mobile}, #{email}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("status") String status);
}
