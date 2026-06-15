package com.procurement.approval.infrastructure;

import com.procurement.approval.domain.ApprovalTask;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ApprovalTaskMapper {

  @Insert("""
      insert into approval_tasks (id, tenant_id, biz_type, biz_id, assignee_id, status)
      values (#{id}, #{tenantId}, #{bizType}, #{bizId}, #{assigneeId}, #{status})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("bizType") String bizType,
      @Param("bizId") String bizId,
      @Param("assigneeId") String assigneeId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, biz_type, biz_id, assignee_id, status, created_at, acted_at
      from approval_tasks
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "approvalTaskResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "biz_id", property = "bizId"),
      @Result(column = "assignee_id", property = "assigneeId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "acted_at", property = "actedAt")
  })
  ApprovalTask findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, biz_type, biz_id, assignee_id, status, created_at, acted_at
      from approval_tasks
      where tenant_id = #{tenantId}
        and biz_type = #{bizType}
        and biz_id = #{bizId}
        and status = #{status}
      order by created_at desc
      limit 1
      """)
  @Results(id = "pendingApprovalTaskResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "biz_id", property = "bizId"),
      @Result(column = "assignee_id", property = "assigneeId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "acted_at", property = "actedAt")
  })
  ApprovalTask findPendingByBiz(
      @Param("tenantId") String tenantId,
      @Param("bizType") String bizType,
      @Param("bizId") String bizId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, biz_type, biz_id, assignee_id, status, created_at, acted_at
      from approval_tasks
      where tenant_id = #{tenantId}
        and status = #{status}
      order by created_at desc
      """)
  @Results(id = "approvalTaskListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "biz_id", property = "bizId"),
      @Result(column = "assignee_id", property = "assigneeId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "acted_at", property = "actedAt")
  })
  List<ApprovalTask> listByTenantAndStatus(
      @Param("tenantId") String tenantId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, biz_type, biz_id, assignee_id, status, created_at, acted_at
      from approval_tasks
      where tenant_id = #{tenantId}
        and status in ('已通过', '已驳回')
      order by acted_at desc nulls last, created_at desc
      limit #{limit}
      """)
  @Results(id = "recentReviewedApprovalTaskResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "biz_type", property = "bizType"),
      @Result(column = "biz_id", property = "bizId"),
      @Result(column = "assignee_id", property = "assigneeId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "acted_at", property = "actedAt")
  })
  List<ApprovalTask> listRecentReviewedByTenant(
      @Param("tenantId") String tenantId,
      @Param("limit") int limit);

  @Update("""
      update approval_tasks
      set status = #{status},
          assignee_id = #{assigneeId},
          acted_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status,
      @Param("assigneeId") String assigneeId);
}
