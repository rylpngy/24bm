package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.Rfq;
import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface RfqMapper {

  @Select("""
      select id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at, quote_requirement, delivery_requirement, evaluation_method, opened_at, current_round, final_round
      from rfqs
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<Rfq> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      <script>
      select id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at, quote_requirement, delivery_requirement, evaluation_method, opened_at, current_round, final_round
      from rfqs
      where tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="keyword != null and keyword != ''">
        and title ilike concat('%', #{keyword}, '%')
        </if>
      order by created_at desc
      </script>
      """)
  List<Rfq> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select("""
      select id, tenant_id, title, status, deadline_at, owner_id, awarded_supplier_id, created_at, updated_at, quote_requirement, delivery_requirement, evaluation_method, opened_at, current_round, final_round
      from rfqs
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Rfq findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select r.id, r.tenant_id, r.title, r.status, r.deadline_at, r.owner_id, r.awarded_supplier_id, r.created_at, r.updated_at, r.quote_requirement, r.delivery_requirement, r.evaluation_method, r.opened_at, r.current_round, r.final_round
      from rfqs r
      join rfq_invites i on i.tenant_id = r.tenant_id and i.rfq_id = r.id
      where r.id = #{rfqId}
        and i.supplier_id = #{supplierId}
        and i.invite_status = '已邀请'
      """)
  Rfq findBySupplierInvite(@Param("rfqId") String rfqId, @Param("supplierId") String supplierId);

  @Select("""
      select r.id, r.tenant_id, r.title, r.status, r.deadline_at, r.owner_id, r.awarded_supplier_id, r.created_at, r.updated_at, r.quote_requirement, r.delivery_requirement, r.evaluation_method, r.opened_at, r.current_round, r.final_round
      from rfqs r
      join rfq_invites i on i.tenant_id = r.tenant_id and i.rfq_id = r.id
      where i.supplier_id = #{supplierId}
        and i.invite_status = '已邀请'
      order by r.created_at desc
      """)
  List<Rfq> listBySupplierInvite(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select r.id, r.tenant_id, r.title, r.status, r.deadline_at, r.owner_id, r.awarded_supplier_id, r.created_at, r.updated_at, r.quote_requirement, r.delivery_requirement, r.evaluation_method, r.opened_at, r.current_round, r.final_round
      from rfqs r
      join rfq_invites i on i.tenant_id = r.tenant_id and i.rfq_id = r.id
      where i.supplier_id = #{supplierId}
        and i.invite_status = '已邀请'
        <if test="status != null and status != ''">
        and r.status = #{status}
        </if>
        <if test="keyword != null and keyword != ''">
        and r.title ilike concat('%', #{keyword}, '%')
        </if>
      order by r.created_at desc
      </script>
      """)
  List<Rfq> listBySupplierInviteFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Insert("""
      insert into rfqs (id, tenant_id, title, status, deadline_at, owner_id,
                        quote_requirement, delivery_requirement, evaluation_method)
      values (#{id}, #{tenantId}, #{title}, #{status}, #{deadlineAt}, #{ownerId},
              #{quoteRequirement}, #{deliveryRequirement}, #{evaluationMethod})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("title") String title,
      @Param("status") String status,
      @Param("deadlineAt") OffsetDateTime deadlineAt,
      @Param("ownerId") String ownerId,
      @Param("quoteRequirement") String quoteRequirement,
      @Param("deliveryRequirement") String deliveryRequirement,
      @Param("evaluationMethod") String evaluationMethod);

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

  @Update("""
      update rfqs
      set title = #{title},
          deadline_at = #{deadlineAt},
          quote_requirement = #{quoteRequirement},
          delivery_requirement = #{deliveryRequirement},
          evaluation_method = #{evaluationMethod},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = '报价中'
      """)
  int updateQuotingDetails(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("title") String title,
      @Param("deadlineAt") OffsetDateTime deadlineAt,
      @Param("quoteRequirement") String quoteRequirement,
      @Param("deliveryRequirement") String deliveryRequirement,
      @Param("evaluationMethod") String evaluationMethod);

  @Update("""
      update rfqs
      set status = #{status},
          opened_at = now(),
          opened_by = #{openedBy},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int openBids(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status,
      @Param("openedBy") String openedBy);

  // 再次报价:已开标 → 报价中,轮次+1、重新封存、设新截止(可标记最终轮 BAFO)。
  @Update("""
      update rfqs
      set status = '报价中',
          current_round = current_round + 1,
          final_round = #{finalRound},
          deadline_at = #{deadlineAt},
          opened_at = null,
          opened_by = null,
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = '已开标'
      """)
  int startNewRound(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("deadlineAt") OffsetDateTime deadlineAt,
      @Param("finalRound") boolean finalRound);
}
