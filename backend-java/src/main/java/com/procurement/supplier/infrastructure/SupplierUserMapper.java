package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierUser;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SupplierUserMapper {

  @Select("""
      select exists(select 1 from users where supplier_id = #{supplierId} and tenant_id is null
        and id != #{excludedId}
        and (lower(btrim(email)) in (lower(#{mobile,jdbcType=VARCHAR}), lower(#{email,jdbcType=VARCHAR}))
          or btrim(mobile) in (#{mobile,jdbcType=VARCHAR}, #{email,jdbcType=VARCHAR})
          or lower(id) in (lower(#{mobile,jdbcType=VARCHAR}), lower(#{email,jdbcType=VARCHAR}))
          or lower(btrim(employee_no)) in (lower(#{mobile,jdbcType=VARCHAR}), lower(#{email,jdbcType=VARCHAR}))))
      """)
  boolean hasLoginConflict(@Param("supplierId") String supplierId, @Param("excludedId") String excludedId,
      @Param("mobile") String mobile, @Param("email") String email);

  @Update("""
      update users set name = #{name}, mobile = #{mobile,jdbcType=VARCHAR}, email = #{email,jdbcType=VARCHAR},
        session_version = session_version + 1, updated_at = now()
      where supplier_id = #{supplierId} and tenant_id is null and id = #{userId}
      """)
  void updateProfile(@Param("supplierId") String supplierId, @Param("userId") String userId,
      @Param("name") String name, @Param("mobile") String mobile, @Param("email") String email);

  @Select("""
      select exists(select 1 from roles where id = #{roleId}
        and scope = 'supplier' and tenant_id is null
        and exists(select 1 from users where supplier_id = #{supplierId} and tenant_id is null))
      """)
  boolean existsSupplierRole(@Param("supplierId") String supplierId, @Param("roleId") String roleId);

  @Delete("""
      delete from user_roles where user_id = #{userId}
        and exists(select 1 from users where id = #{userId}
          and supplier_id = #{supplierId} and tenant_id is null)
      """)
  void clearUserRoles(@Param("supplierId") String supplierId, @Param("userId") String userId);

  @Update("""
      update users set session_version = session_version + 1, updated_at = now()
      where id = #{userId} and supplier_id = #{supplierId} and tenant_id is null
      """)
  void invalidateSessions(@Param("supplierId") String supplierId, @Param("userId") String userId);

  @Select("select id from enterprises where id = #{supplierId} and type = 'supplier' for update")
  @Options(flushCache = Options.FlushCachePolicy.TRUE)
  String lockSupplier(@Param("supplierId") String supplierId);

  @Select("""
      select count(*) from users u
      where u.supplier_id = #{supplierId} and u.tenant_id is null and u.status = 'active'
        and u.id != #{excludedUserId}
        and exists (select 1 from user_roles ur join roles r on r.id = ur.role_id
          where ur.user_id = u.id and r.scope = 'supplier' and r.tenant_id is null
            and (r.supplier_id is null or r.supplier_id = u.supplier_id)
            and r.permissions @> '["supplier:*"]'::jsonb)
      """)
  int countOtherActiveAdmins(@Param("supplierId") String supplierId, @Param("excludedUserId") String excludedUserId);

  @Select("""
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
        and u.tenant_id is null
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, u.created_at
      order by u.created_at desc
      """)
  List<SupplierUser> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
        and u.tenant_id is null
        <if test="status != null and status != ''">
        and u.status = #{status}
        </if>
        <if test="keyword != null and keyword != ''">
        and (
          u.name ilike concat('%', #{keyword}, '%')
          or u.mobile ilike concat('%', #{keyword}, '%')
          or u.email ilike concat('%', #{keyword}, '%')
        )
        </if>
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, u.created_at
      order by u.created_at desc
      </script>
      """)
  List<SupplierUser> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select("""
      select u.id, u.supplier_id, u.name, u.mobile, u.email, u.status, min(r.id) as role_id
      from users u
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id and r.scope = 'supplier'
      where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
        and u.tenant_id is null
        and u.id = #{id}
      group by u.id, u.supplier_id, u.name, u.mobile, u.email, u.status
      """)
  SupplierUser findBySupplierAndId(
      @Param("supplierId") String supplierId,
      @Param("id") String id);

  @Select("""
      select exists(
        select 1
        from users
        where supplier_id = #{supplierId,jdbcType=VARCHAR}
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
        and r.id = 'role-system-supplier-member'
        and r.tenant_id is null
        and exists (
          select 1
          from users u
          where u.supplier_id = #{supplierId,jdbcType=VARCHAR}
            and u.tenant_id is null
        )
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
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
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
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and tenant_id is null
        and id = #{userId}
      """)
  void updateStatus(
      @Param("supplierId") String supplierId,
      @Param("userId") String userId,
      @Param("status") String status);
}
