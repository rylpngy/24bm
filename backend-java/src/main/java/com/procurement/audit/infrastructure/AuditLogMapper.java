package com.procurement.audit.infrastructure;

import com.procurement.audit.domain.AuditLog;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuditLogMapper {

  @Insert("""
      insert into audit_logs (id, tenant_id, actor_id, action, target_type, target_id, detail)
      values (#{id}, #{tenantId}, #{actorId}, #{action}, #{targetType}, #{targetId}, #{detail})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("actorId") String actorId,
      @Param("action") String action,
      @Param("targetType") String targetType,
      @Param("targetId") String targetId,
      @Param("detail") String detail);

  @Select("""
      select id, tenant_id, actor_id, action, target_type, target_id, detail, created_at
      from audit_logs
      where tenant_id = #{tenantId}
      order by created_at desc
      limit #{limit}
      """)
  List<AuditLog> listByTenant(@Param("tenantId") String tenantId, @Param("limit") int limit);

  @Select("""
      <script>
      select id, tenant_id, actor_id, action, target_type, target_id, detail, created_at
      from audit_logs
      where tenant_id = #{tenantId}
        and target_type = #{targetType}
        and target_id = #{targetId}
        <if test="actions != null and !actions.isEmpty()">
        and action in
        <foreach collection="actions" item="action" open="(" separator="," close=")">
          #{action}
        </foreach>
        </if>
      order by created_at desc
      limit #{limit}
      </script>
      """)
  List<AuditLog> listByTenantTargetActions(
      @Param("tenantId") String tenantId,
      @Param("targetType") String targetType,
      @Param("targetId") String targetId,
      @Param("actions") List<String> actions,
      @Param("limit") int limit);
}
