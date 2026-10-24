package com.procurement.contract.infrastructure;

import com.procurement.contract.domain.ContractAmendment;
import com.procurement.contract.domain.ContractLedger;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ContractMapper {

  @Select("""
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at,
             sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
      from contracts where tenant_id = #{tenantId} and related_order_id = #{orderId} for update
      """)
  ContractLedger lockByOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at,
             sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
      from contracts where tenant_id=#{tenantId} and related_order_id=#{orderId}
      """)
  ContractLedger findByTenantAndOrderId(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("select id from contracts where tenant_id = #{tenantId} and id = #{id} for update")
  String lockById(@Param("tenantId") String tenantId, @Param("id") String id);

  String VISIBLE_ORDERS = """
      select po.id from purchase_orders po
      where po.tenant_id=#{tenantId} and po.rfq_id in (
      """ + com.procurement.common.data.ProcurementScopeSql.RFQS + ")";

  // Preserve existing callers while routing every contract surface through one whole-order predicate.
  static com.procurement.identity.domain.DataScope recordScope(List<String> departments, String requester) {
    if (departments != null && requester != null) {
      return com.procurement.identity.domain.DataScope.departments(List.of());
    }
    if (requester != null) return com.procurement.identity.domain.DataScope.self(requester);
    return departments == null ? com.procurement.identity.domain.DataScope.unrestricted()
        : com.procurement.identity.domain.DataScope.departments(departments);
  }

  default boolean canAccessAttachment(String tenantId, String id, List<String> departmentIds, String requesterId) {
    return canAccessContractInScope(tenantId, id, recordScope(departmentIds, requesterId));
  }

  @Select("<script>select exists(select 1 from contracts c where c.tenant_id=#{tenantId} and c.id=#{id}"
      + " and c.related_order_id in (" + VISIBLE_ORDERS + "))</script>")
  boolean canAccessContractInScope(@Param("tenantId") String tenantId, @Param("id") String id,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  default boolean canAccessOrder(String tenantId, String id, List<String> departmentIds, String requesterId) {
    return canAccessOrderInScope(tenantId, id, recordScope(departmentIds, requesterId));
  }

  @Select("<script>select exists(select 1 from (" + VISIBLE_ORDERS + ") visible where visible.id=#{id})</script>")
  boolean canAccessOrderInScope(@Param("tenantId") String tenantId, @Param("id") String id,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  default List<ContractLedger> listByTenantFiltered(String tenantId, String status, String archiveStatus,
      String supplierId, List<String> scopeDepartmentIds, String requesterId) {
    return listVisible(tenantId, status, archiveStatus, supplierId, recordScope(scopeDepartmentIds, requesterId));
  }

  @Select("""
      <script>
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at,
             sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
      from contracts
      where tenant_id = #{tenantId}
        <if test="status != null and status != ''">and status = #{status}</if>
        <if test="archiveStatus != null and archiveStatus != ''">and archive_status = #{archiveStatus}</if>
        <if test="supplierId != null and supplierId != ''">and supplier_id = #{supplierId}</if>
        and related_order_id in (
      """ + VISIBLE_ORDERS + """
        )
      order by updated_at desc, created_at desc
      </script>
      """)
  List<ContractLedger> listVisible(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("archiveStatus") String archiveStatus,
      @Param("supplierId") String supplierId,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Select("""
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at,
             sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
      from contracts
      where tenant_id = #{tenantId}
        and id = #{contractId}
      """)
  ContractLedger findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  // 到期提醒:截止日 ≤ 阈值、未归档、尚未发起续签的在册合同。
  @Select("""
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at,
             sign_date, expiry_date, payment_terms, warranty_terms, renewal_status
      from contracts
      where tenant_id = #{tenantId}
        and expiry_date is not null
        and expiry_date <= #{withinDate}
        and archive_status <> '已归档'
        and (renewal_status is null or renewal_status = '')
      order by expiry_date asc
      """)
  List<ContractLedger> listExpiringWithin(
      @Param("tenantId") String tenantId,
      @Param("withinDate") java.time.LocalDate withinDate);

  @Select("""
      select count(*)
      from contract_closeout_checks
      where tenant_id = #{tenantId} and contract_id = #{contractId}
        and blocking_reason is not null
      """)
  int countArchiveBlockers(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Select("select blocking_reason from contract_closeout_checks where tenant_id=#{tenantId} and contract_id=#{contractId}")
  String archiveBlockingReason(@Param("tenantId") String tenantId, @Param("contractId") String contractId);

  @Insert("""
      insert into contracts (
        id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
        amount, status, archive_status, fulfillment_progress, effective_date,
        sign_date, expiry_date, payment_terms, warranty_terms
      )
      values (
        #{id}, #{tenantId}, #{contractNo}, #{contractName}, #{relatedOrderId}, #{supplierId},
        #{amount}, #{status}, #{archiveStatus}, #{fulfillmentProgress}, #{effectiveDate},
        #{signDate,jdbcType=DATE}, #{expiryDate,jdbcType=DATE}, #{paymentTerms}, #{warrantyTerms}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("contractNo") String contractNo,
      @Param("contractName") String contractName,
      @Param("relatedOrderId") String relatedOrderId,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("status") String status,
      @Param("archiveStatus") String archiveStatus,
      @Param("fulfillmentProgress") String fulfillmentProgress,
      @Param("effectiveDate") LocalDate effectiveDate,
      @Param("signDate") LocalDate signDate,
      @Param("expiryDate") LocalDate expiryDate,
      @Param("paymentTerms") String paymentTerms,
      @Param("warrantyTerms") String warrantyTerms);

  @Update("""
      update contracts
      set contract_no = #{contractNo},
          contract_name = #{contractName},
          amount = #{amount},
          status = #{status},
          fulfillment_progress = #{fulfillmentProgress},
          effective_date = #{effectiveDate},
          sign_date = #{signDate,jdbcType=DATE},
          expiry_date = #{expiryDate,jdbcType=DATE},
          payment_terms = #{paymentTerms},
          warranty_terms = #{warrantyTerms},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{contractId}
      """)
  int updateDetails(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("contractNo") String contractNo,
      @Param("contractName") String contractName,
      @Param("amount") BigDecimal amount,
      @Param("status") String status,
      @Param("fulfillmentProgress") String fulfillmentProgress,
      @Param("effectiveDate") LocalDate effectiveDate,
      @Param("signDate") LocalDate signDate,
      @Param("expiryDate") LocalDate expiryDate,
      @Param("paymentTerms") String paymentTerms,
      @Param("warrantyTerms") String warrantyTerms);

  @Update("""
      update contracts
      set status = #{status},
          fulfillment_progress = #{fulfillmentProgress},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{contractId}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status,
      @Param("fulfillmentProgress") String fulfillmentProgress);

  // 续签:置续签状态(幂等,未续签 → 已发起续签)。
  @Update("""
      update contracts
      set renewal_status = #{renewalStatus}, updated_at = now()
      where tenant_id = #{tenantId} and id = #{contractId}
        and (renewal_status is null or renewal_status = '')
      """)
  int markRenewal(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("renewalStatus") String renewalStatus);

  @Update("""
      update contracts
      set archive_status = #{archiveStatus},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{contractId}
        and archive_status = #{currentArchiveStatus}
      """)
  int updateArchiveStatus(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("currentArchiveStatus") String currentArchiveStatus,
      @Param("archiveStatus") String archiveStatus);

  // 合同变更/补充协议:留痕 + 列表 + 下一序号 + 应用金额/工期到主合同。
  @Select("""
      select coalesce(max(seq), 0)
      from contract_amendments
      where tenant_id = #{tenantId} and contract_id = #{contractId}
      """)
  int maxAmendmentSeq(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Insert("""
      insert into contract_amendments
        (id, tenant_id, contract_id, seq, change_type, old_amount, new_amount,
         old_expiry_date, new_expiry_date, reason, actor_id)
      values
        (#{id}, #{tenantId}, #{contractId}, #{seq}, #{changeType}, #{oldAmount}, #{newAmount},
         #{oldExpiryDate}, #{newExpiryDate}, #{reason}, #{actorId})
      """)
  void insertAmendment(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("seq") int seq,
      @Param("changeType") String changeType,
      @Param("oldAmount") BigDecimal oldAmount,
      @Param("newAmount") BigDecimal newAmount,
      @Param("oldExpiryDate") LocalDate oldExpiryDate,
      @Param("newExpiryDate") LocalDate newExpiryDate,
      @Param("reason") String reason,
      @Param("actorId") String actorId);

  @Select("""
      select id, tenant_id, contract_id, seq, change_type, old_amount, new_amount,
             old_expiry_date, new_expiry_date, reason, actor_id, created_at
      from contract_amendments
      where tenant_id = #{tenantId} and contract_id = #{contractId}
      order by seq desc
      """)
  List<ContractAmendment> listAmendments(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Update("""
      update contracts
      set amount = #{amount},
          expiry_date = #{expiryDate},
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{contractId}
      """)
  int updateAmountAndExpiry(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId,
      @Param("amount") BigDecimal amount,
      @Param("expiryDate") LocalDate expiryDate);
}
