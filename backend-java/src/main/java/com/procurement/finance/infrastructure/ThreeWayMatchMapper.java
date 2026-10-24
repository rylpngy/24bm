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
      left join lateral (
        select sum(rli.received_quantity) as received_quantity,
               sum(rli.qualified_quantity) as qualified_quantity
        from receipt_line_items rli
        join receipts r on r.tenant_id=rli.tenant_id and r.id=rli.receipt_id and r.order_id=ol.order_id
        where rli.order_line_id=ol.id and rli.tenant_id=ol.tenant_id
      ) rl on true
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

  default List<ThreeWayMatch> listByTenantFiltered(
      @Param("tenantId") String tenantId,
      @Param("matchStatus") String matchStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId) {
    return listVisible(tenantId, matchStatus, supplierId, orderId, invoiceId, com.procurement.identity.domain.DataScope.unrestricted());
  }

  @Select("""
      <script>
      select id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
             invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness,
             created_at, updated_at
      from finance_three_way_match_checks
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
      and order_id in (
      """ + FinanceScopeSql.ORDERS + """
      )
      order by updated_at desc, created_at desc
      </script>
      """)
  List<ThreeWayMatch> listVisible(
      @Param("tenantId") String tenantId,
      @Param("matchStatus") String matchStatus,
      @Param("supplierId") String supplierId,
      @Param("orderId") String orderId,
      @Param("invoiceId") String invoiceId,
      @Param("scope") com.procurement.identity.domain.DataScope scope);

  @Select("""
      select id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
             invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness,
             created_at, updated_at
      from finance_three_way_match_checks
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  ThreeWayMatch findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  String MATCH_BODY = """
        i.tenant_id, i.id, i.supplier_id, i.order_id, checks.order_amount,
        case when f.blocking_reason is null then '已收货' else '待核验' end,
        i.amount, i.amount-checks.order_amount,
        case when checks.blocking_reason is null then '三单匹配通过'
             when checks.blocking_reason like '%金额%' then '金额差异' else '履约待核验' end,
        coalesce(checks.blocking_reason,'订单、收货、发票一致'),
        case when checks.blocking_reason is not null then '需处理差异'
             when i.payment_status='已付款' then '已付款归档'
             when i.payment_status='部分付款' then '部分付款跟进' else '可申请付款' end
      from invoices i
      join finance_invoice_closeout_checks checks on checks.tenant_id=i.tenant_id and checks.invoice_id=i.id
      left join finance_fulfillment_checks f on f.tenant_id=i.tenant_id and f.order_id=i.order_id
      where i.tenant_id=#{tenantId}
      """;

  String MATCH_INSERT = """
      insert into three_way_matches (
        id, tenant_id, invoice_id, supplier_id, order_id, order_amount, receipt_status,
        invoice_amount, variance_amount, match_status, blocking_reason, payment_readiness)
      """;

  String MATCH_CONFLICT = """
      on conflict (tenant_id, invoice_id) do update
      set supplier_id=excluded.supplier_id, order_id=excluded.order_id,
          order_amount=excluded.order_amount, receipt_status=excluded.receipt_status,
          invoice_amount=excluded.invoice_amount, variance_amount=excluded.variance_amount,
          match_status=excluded.match_status, blocking_reason=excluded.blocking_reason,
          payment_readiness=excluded.payment_readiness, updated_at=now()
      """;

  @Select("select blocking_reason from finance_invoice_closeout_checks where tenant_id=#{tenantId} and invoice_id=#{invoiceId}")
  String paymentBlockingReason(@Param("tenantId") String tenantId, @Param("invoiceId") String invoiceId);

  @Insert(MATCH_INSERT + " select #{id}, " + MATCH_BODY + " and i.id=#{invoiceId} " + MATCH_CONFLICT)
  void upsertFromInvoice(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId);

  @Select(MATCH_INSERT + " select concat('match-', gen_random_uuid()), " + MATCH_BODY
      + MATCH_CONFLICT + " returning id")
  List<String> rebuildByTenant(@Param("tenantId") String tenantId);
}
