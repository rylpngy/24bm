package com.procurement.finance.infrastructure;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface InvoiceReconciliationMapper {

  @Insert("""
      insert into invoice_reconciliations (id, tenant_id, invoice_id, supplier_id, order_id, stage, next_action)
      values (#{id}, #{tenantId}, #{invoiceId}, #{supplierId}, #{orderId}, #{stage}, #{nextAction})
      on conflict (tenant_id, invoice_id) do nothing
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("stage") String stage,
      @Param("nextAction") String nextAction);

  @Update("""
      update invoice_reconciliations
      set stage = #{stage},
          next_action = #{nextAction},
          updated_at = now()
      where tenant_id = #{tenantId}
        and invoice_id = #{invoiceId}
      """)
  int updateStageByInvoice(
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId,
      @Param("stage") String stage,
      @Param("nextAction") String nextAction);
}
