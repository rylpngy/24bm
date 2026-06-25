package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.domain.ThreeWayMatchLineRow;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ThreeWayMatchMapper {

  // 行级对账:以订单行项为脊柱,左连收货行项(按 order_line_id)与该发票的发票行项。
  @Select("""
      select ol.id              as order_line_id,
             ol.description      as description,
             ol.unit             as unit,
             ol.quantity         as ordered_quantity,
             ol.unit_price       as order_unit_price,
             ol.line_amount      as order_line_amount,
             rl.received_quantity   as received_quantity,
             rl.qualified_quantity  as qualified_quantity,
             il.quantity         as invoiced_quantity,
             il.unit_price       as invoice_unit_price,
             il.line_amount      as invoice_line_amount
      from order_line_items ol
      left join receipt_line_items rl
        on rl.order_line_id = ol.id and rl.tenant_id = ol.tenant_id
      left join invoice_line_items il
        on il.order_line_id = ol.id and il.tenant_id = ol.tenant_id
        and il.invoice_id = #{invoiceId}
      where ol.tenant_id = #{tenantId} and ol.order_id = #{orderId}
      order by ol.sort_no asc, ol.id asc
      """)
  List<ThreeWayMatchLineRow> listLineReconciliation(
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      <script>
      select id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
             invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness,
             created_at, updated_at
      from three_way_matches
      where tenant_id = #{tenantId}
        <if test="matchStatus != null and matchStatus != ''">
        and match_status = #{matchStatus}
        </if>
        <if test="supplierId != null and supplierId != ''">
        and supplier_id = #{supplierId}
        </if>
        <if test="orderId != null and orderId != ''">
        and order_id = #{orderId}
        </if>
        <if test="invoiceId != null and invoiceId != ''">
        and invoice_id = #{invoiceId}
        </if>
      order by updated_at desc, created_at desc
      </script>
      """)
  List<ThreeWayMatch> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("matchStatus") String matchStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
             invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness,
             created_at, updated_at
      from three_way_matches
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  ThreeWayMatch findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into three_way_matches (
        id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
        invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness
      )
      select
        #{id},
        invoice.tenant_id,
        invoice.id,
        invoice.supplier_id,
        invoice.order_id,
        purchase_order.amount,
        case
          when purchase_order.status in ('已收货', '已完成') then '已收货'
          else '待收货'
        end,
        invoice.amount,
        invoice.amount - purchase_order.amount,
        case
          when invoice.amount <> purchase_order.amount then '金额差异'
          when purchase_order.status not in ('已收货', '已完成') then '待收货'
          else '三单匹配通过'
        end,
        case
          when invoice.amount <> purchase_order.amount then '发票金额与订单金额不一致'
          when purchase_order.status not in ('已收货', '已完成') then '订单尚未完成收货验收'
          else '订单、收货、发票一致'
        end,
        case
          when invoice.amount <> purchase_order.amount then '需处理差异'
          when purchase_order.status not in ('已收货', '已完成') then '等待收货'
          when invoice.payment_status = '已付款' then '已付款归档'
          when invoice.payment_status = '部分付款' then '部分付款跟进'
          else '可申请付款'
        end
      from invoices invoice
      join purchase_orders purchase_order
        on purchase_order.tenant_id = invoice.tenant_id
       and purchase_order.id = invoice.order_id
      where invoice.tenant_id = #{tenantId}
        and invoice.id = #{invoiceId}
      on conflict (tenant_id, invoice_id) do update
      set supplier_id = excluded.supplier_id,
          order_id = excluded.order_id,
          order_amount = excluded.order_amount,
          receipt_status = excluded.receipt_status,
          invoice_amount = excluded.invoice_amount,
          variance_amount = excluded.variance_amount,
          match_status = excluded.match_status,
          blocking_reason = excluded.blocking_reason,
          payment_readiness = excluded.payment_readiness,
          updated_at = now()
      """)
  void upsertFromInvoice(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId);

  @Select("""
      insert into three_way_matches (
        id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
        invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness
      )
      select
        concat('match-', gen_random_uuid()),
        invoice.tenant_id,
        invoice.id,
        invoice.supplier_id,
        invoice.order_id,
        purchase_order.amount,
        case
          when purchase_order.status in ('已收货', '已完成') then '已收货'
          else '待收货'
        end,
        invoice.amount,
        invoice.amount - purchase_order.amount,
        case
          when invoice.amount <> purchase_order.amount then '金额差异'
          when purchase_order.status not in ('已收货', '已完成') then '待收货'
          else '三单匹配通过'
        end,
        case
          when invoice.amount <> purchase_order.amount then '发票金额与订单金额不一致'
          when purchase_order.status not in ('已收货', '已完成') then '订单尚未完成收货验收'
          else '订单、收货、发票一致'
        end,
        case
          when invoice.amount <> purchase_order.amount then '需处理差异'
          when purchase_order.status not in ('已收货', '已完成') then '等待收货'
          when invoice.payment_status = '已付款' then '已付款归档'
          when invoice.payment_status = '部分付款' then '部分付款跟进'
          else '可申请付款'
        end
      from invoices invoice
      join purchase_orders purchase_order
        on purchase_order.tenant_id = invoice.tenant_id
       and purchase_order.id = invoice.order_id
      where invoice.tenant_id = #{tenantId}
      on conflict (tenant_id, invoice_id) do update
      set supplier_id = excluded.supplier_id,
          order_id = excluded.order_id,
          order_amount = excluded.order_amount,
          receipt_status = excluded.receipt_status,
          invoice_amount = excluded.invoice_amount,
          variance_amount = excluded.variance_amount,
          match_status = excluded.match_status,
          blocking_reason = excluded.blocking_reason,
          payment_readiness = excluded.payment_readiness,
          updated_at = now()
      returning id
      """)
  List<String> rebuildByTenant(@Param("tenantId") String tenantId);
}
