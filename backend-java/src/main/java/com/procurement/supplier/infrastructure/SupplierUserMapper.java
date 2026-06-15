package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierUser;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SupplierUserMapper {

  @Select("""
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId}
        and u.tenant_id is null
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, u.created_at
      order by u.created_at desc
      """)
  @Results(id = "supplierUserResults", value = {
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "role_id", property = "roleId")
  })
  List<SupplierUser> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId}
        and u.tenant_id is null
        and (#{status} is null or u.status = #{status})
        and (
          #{keyword} is null
          or u.name ilike concat('%', #{keyword}, '%')
          or u.mobile ilike concat('%', #{keyword}, '%')
          or u.email ilike concat('%', #{keyword}, '%')
        )
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, u.created_at
      order by u.created_at desc
      """)
  @Results(id = "supplierUserFilteredResults", value = {
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "role_id", property = "roleId")
  })
  List<SupplierUser> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select("""
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId}
        and u.tenant_id is null
        and u.id = #{id}
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status
      """)
  @Results(id = "singleSupplierUserResults", value = {
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "role_id", property = "roleId")
  })
  SupplierUser findBySupplierAndId(
      @Param("supplierId") String supplierId,
      @Param("id") String id);

  @Select("""
      select exists(
        select 1
        from users
        where supplier_id = #{supplierId}
          and tenant_id is null
          and id = #{id}
      )
      """)
  boolean existsBySupplierAndId(
      @Param("supplierId") String supplierId,
      @Param("id") String id);

  @Select("""
      select r.id
      from roles r
      where r.scope = 'supplier'
        and r.tenant_id is null
        and exists (
          select 1
          from users u
          where u.supplier_id = #{supplierId}
            and u.tenant_id is null
        )
      order by r.id
      limit 1
      """)
  String findDefaultSupplierRoleId(@Param("supplierId") String supplierId);

  @Insert("""
      insert into users (id, tenant_id, supplier_id, name, mobile, email, status, department_id, password_hash)
      values (#{id}, null, #{supplierId}, #{name}, #{mobile}, #{email}, #{status}, null, #{passwordHash})
      """)
  void insert(
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("name") String name,
      @Param("mobile") String mobile,
      @Param("email") String email,
      @Param("status") String status,
      @Param("passwordHash") String passwordHash);

  @Insert("""
      insert into user_roles (user_id, role_id)
      values (#{userId}, #{roleId})
      """)
  void assignRole(
      @Param("userId") String userId,
      @Param("roleId") String roleId);

  @Update("""
      update users
      set password_hash = #{passwordHash},
          updated_at = now()
      where supplier_id = #{supplierId}
        and tenant_id is null
        and id = #{userId}
      """)
  void updatePasswordHash(
      @Param("supplierId") String supplierId,
      @Param("userId") String userId,
      @Param("passwordHash") String passwordHash);

  @Update("""
      update users
      set status = #{status},
          updated_at = now()
      where supplier_id = #{supplierId}
        and tenant_id is null
        and id = #{userId}
      """)
  void updateStatus(
      @Param("supplierId") String supplierId,
      @Param("userId") String userId,
      @Param("status") String status);
}
