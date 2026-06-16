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
      insert into audit_logs (id, tenant_id, actor_id, action, target_type, target_id)
      values (#{id}, #{tenantId}, #{actorId}, #{action}, #{targetType}, #{targetId})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("actorId") String actorId,
      @Param("action") String action,
      @Param("targetType") String targetType,
      @Param("targetId") String targetId);

  @Select("""
      select id, tenant_id, actor_id, action, target_type, target_id, created_at
      from audit_logs
      where tenant_id = #{tenantId}
      order by created_at desc
      limit #{limit}
      """)
  List<AuditLog> listByTenant(@Param("tenantId") String tenantId, @Param("limit") int limit);

  @Select("""
      <script>
      select id, tenant_id, actor_id, action, target_type, target_id, created_at
      from audit_logs
      where tenant_id = #{tenantId}
        and target_type = #{targetType}
        and target_id = #{targetId}
        and action in
        <foreach collection="actions" item="action" open="(" separator="," close=")">
          #{action}
        </foreach>
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
