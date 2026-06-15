package com.procurement.audit.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

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
}
