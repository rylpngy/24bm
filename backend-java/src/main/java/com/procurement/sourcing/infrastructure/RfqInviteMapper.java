package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.RfqInvitation;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface RfqInviteMapper {

  @Select("""
      select supplier_id
      from rfq_invites
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
      order by id
      """)
  List<String> listSupplierIds(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("""
      select count(1)
      from rfq_invites
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId}
        and supplier_id = #{supplierId}
      """)
  int isSupplierInvited(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Insert("""
      insert into rfq_invites (id, tenant_id, rfq_id, supplier_id, invite_status)
      values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{inviteStatus})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("inviteStatus") String inviteStatus);

  @Delete("""
      delete from rfq_invites
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
      """)
  void deleteByRfq(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("""
      select supplier_id, invite_status, viewed_at, decline_reason
      from rfq_invites
      where tenant_id = #{tenantId} and rfq_id = #{rfqId}
      order by id
      """)
  List<RfqInvitation> listByRfq(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("""
      select supplier_id, invite_status, viewed_at, decline_reason
      from rfq_invites
      where tenant_id = #{tenantId} and rfq_id = #{rfqId} and supplier_id = #{supplierId}
      """)
  RfqInvitation findBySupplier(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  // 已读回执:仅首次查看时落时间戳。
  @Update("""
      update rfq_invites
      set viewed_at = now()
      where tenant_id = #{tenantId} and rfq_id = #{rfqId} and supplier_id = #{supplierId}
        and viewed_at is null
      """)
  int markViewed(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId);

  @Update("""
      update rfq_invites
      set invite_status = '已拒绝', decline_reason = #{reason}
      where tenant_id = #{tenantId} and rfq_id = #{rfqId} and supplier_id = #{supplierId}
        and invite_status = '已邀请'
      """)
  int decline(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("reason") String reason);
}
