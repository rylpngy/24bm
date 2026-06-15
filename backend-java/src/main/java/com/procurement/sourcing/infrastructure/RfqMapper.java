package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.Rfq;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface RfqMapper {

  @Select("""
      select id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at
      from rfqs
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  @Results(id = "rfqResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "deadline_at", property = "deadlineAt"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "awarded_supplier_id", property = "awardedSupplierId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Rfq> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at
      from rfqs
      where tenant_id = #{tenantId} and id = #{id}
      """)
  @Results(id = "singleRfqResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "deadline_at", property = "deadlineAt"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "awarded_supplier_id", property = "awardedSupplierId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  Rfq findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select r.id, r.tenant_id, r.title, r.status, r.deadline_at, r.owner_id, r.awarded_supplier_id, r.created_at, r.updated_at
      from rfqs r
      join rfq_invites i on i.tenant_id = r.tenant_id and i.rfq_id = r.id
      where r.id = #{rfqId}
        and i.supplier_id = #{supplierId}
        and i.invite_status = '已邀请'
      """)
  @Results(id = "supplierRfqResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "deadline_at", property = "deadlineAt"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "awarded_supplier_id", property = "awardedSupplierId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  Rfq findBySupplierInvite(@Param("rfqId") String rfqId, @Param("supplierId") String supplierId);

  @Select("""
      select r.id, r.tenant_id, r.title, r.status, r.deadline_at, r.owner_id, r.awarded_supplier_id, r.created_at, r.updated_at
      from rfqs r
      join rfq_invites i on i.tenant_id = r.tenant_id and i.rfq_id = r.id
      where i.supplier_id = #{supplierId}
        and i.invite_status = '已邀请'
      order by r.created_at desc
      """)
  @Results(id = "supplierRfqListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "deadline_at", property = "deadlineAt"),
      @Result(column = "owner_id", property = "ownerId"),
      @Result(column = "awarded_supplier_id", property = "awardedSupplierId"),
      @Result(column = "created_at", property = "createdAt"),
      @Result(column = "updated_at", property = "updatedAt")
  })
  List<Rfq> listBySupplierInvite(@Param("supplierId") String supplierId);

  @Insert("""
      insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id)
      values (#{id}, #{tenantId}, #{title}, #{status}, #{deadlineAt}, #{ownerId})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("title") String title,
      @Param("status") String status,
      @Param("deadlineAt") OffsetDateTime deadlineAt,
      @Param("ownerId") String ownerId);

  @Update("""
      update rfqs
      set status = #{status},
          awarded_supplier_id = #{awardedSupplierId},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateAward(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status,
      @Param("awardedSupplierId") String awardedSupplierId);

  @Update("""
      update rfqs
      set status = #{status},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status);
}
