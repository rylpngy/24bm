package com.procurement.contract.infrastructure;

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
      <script>
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at
      from contracts
      where tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="archiveStatus != null and archiveStatus != ''">
        and archive_status = #{archiveStatus}
        </if>
        <if test="supplierId != null and supplierId != ''">
        and supplier_id = #{supplierId}
        </if>
      order by updated_at desc, created_at desc
      </script>
      """)
  List<ContractLedger> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("archiveStatus") String archiveStatus,
      @Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
             amount, status, archive_status, fulfillment_progress, effective_date, created_at, updated_at
      from contracts
      where tenant_id = #{tenantId}
        and id = #{contractId}
      """)
  ContractLedger findByTenantAndId(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Select("""
      select count(*)
      from contracts contract
      join purchase_orders purchase_order
        on purchase_order.id = contract.related_order_id
       and purchase_order.tenant_id = contract.tenant_id
      left join invoices invoice
        on invoice.order_id = purchase_order.id
       and invoice.tenant_id = contract.tenant_id
      where contract.tenant_id = #{tenantId}
        and contract.id = #{contractId}
        and (
          purchase_order.status not in ('已收货', '已完成')
          or coalesce(invoice.payment_status, '待开票') <> '已付款'
        )
      """)
  int countArchiveBlockers(
      @Param("tenantId") String tenantId,
      @Param("contractId") String contractId);

  @Insert("""
      insert into contracts (
        id, tenant_id, contract_no, contract_name, related_order_id, supplier_id,
        amount, status, archive_status, fulfillment_progress, effective_date
      )
      values (
        #{id}, #{tenantId}, #{contractNo}, #{contractName}, #{relatedOrderId}, #{supplierId},
        #{amount}, #{status}, #{archiveStatus}, #{fulfillmentProgress}, #{effectiveDate}
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
      @Param("effectiveDate") LocalDate effectiveDate);

  @Update("""
      update contracts
      set contract_no = #{contractNo},
          contract_name = #{contractName},
          amount = #{amount},
          status = #{status},
          fulfillment_progress = #{fulfillmentProgress},
          effective_date = #{effectiveDate},
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
      @Param("effectiveDate") LocalDate effectiveDate);

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
}
