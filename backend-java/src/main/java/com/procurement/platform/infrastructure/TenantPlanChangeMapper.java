package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.TenantPlanChange;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TenantPlanChangeMapper {

  @Insert("""
      insert into tenant_plan_changes
        (id, tenant_id, from_plan, to_plan, from_user_limit, to_user_limit, changed_by)
      values
        (#{id}, #{tenantId}, #{fromPlan}, #{toPlan}, #{fromUserLimit}, #{toUserLimit},
         #{changedBy,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("fromPlan") String fromPlan,
      @Param("toPlan") String toPlan,
      @Param("fromUserLimit") int fromUserLimit,
      @Param("toUserLimit") int toUserLimit,
      @Param("changedBy") String changedBy);

  @Select("""
      select id, tenant_id, from_plan, to_plan, from_user_limit, to_user_limit, changed_by, changed_at
      from tenant_plan_changes
      where tenant_id = #{tenantId}
      order by changed_at desc
      """)
  List<TenantPlanChange> listByTenant(@Param("tenantId") String tenantId);
}
