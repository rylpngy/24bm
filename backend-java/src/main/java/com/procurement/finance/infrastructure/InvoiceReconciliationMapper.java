package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.InvoiceReconciliation;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
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

  @Select("""
      select
        reconciliation.id,
        reconciliation.tenant_id,
        reconciliation.invoice_id,
        reconciliation.supplier_id,
        reconciliation.order_id,
        reconciliation.stage,
        reconciliation.next_action,
        purchase_order.amount as order_amount,
        invoice.amount as invoice_amount,
        invoice.amount - purchase_order.amount as variance_amount,
        case
          when purchase_order.status in ('已收货', '已完成') then '已收货'
          else '待收货'
        end as receipt_status,
        invoice.payment_status,
        reconciliation.created_at,
        reconciliation.updated_at
      from invoice_reconciliations reconciliation
      join invoices invoice
        on invoice.tenant_id = reconciliation.tenant_id
       and invoice.id = reconciliation.invoice_id
      join purchase_orders purchase_order
        on purchase_order.tenant_id = reconciliation.tenant_id
       and purchase_order.id = reconciliation.order_id
      where reconciliation.tenant_id = #{tenantId}
        and (#{stage} is null or reconciliation.stage = #{stage})
        and (#{supplierId} is null or reconciliation.supplier_id = #{supplierId})
        and (#{orderId} is null or reconciliation.order_id = #{orderId})
      order by reconciliation.updated_at desc, reconciliation.created_at desc
      """)
  List<InvoiceReconciliation> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("stage") String stage,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId);
}
