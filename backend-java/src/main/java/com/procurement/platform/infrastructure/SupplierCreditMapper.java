package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.SupplierCreditFacts;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 供应商信用画像事实数据:跨租户只读聚合(平台运营端专用,已登记租户隔离白名单)。
 * 仅按 supplier 维度输出计数与金额,不下发任何单据明细。
 */
@Mapper
public interface SupplierCreditMapper {

  String FACTS = """
      select e.id as supplier_id,
             e.name as supplier_name,
             coalesce(e.verified, false) as verified,
             -- 参与项目:提交过报价的询比/竞价项目 + 递交过投标的招标项目
             (select count(distinct q.rfq_id) from quotes q where q.supplier_id = e.id)
               + (select count(distinct b.tender_id) from tender_bids b where b.supplier_id = e.id)
               as participated_projects,
             -- 中标项目:RFQ 定标 + 招标定标
             (select count(1) from rfqs r where r.awarded_supplier_id = e.id)
               + (select count(1) from tenders t
                    join tender_bids tb on tb.id = t.awarded_bid_id
                   where tb.supplier_id = e.id)
               as awarded_projects,
             (select count(1) from purchase_orders po where po.supplier_id = e.id) as order_count,
             (select count(1) from purchase_orders po
               where po.supplier_id = e.id and po.status = '已收货') as completed_order_count,
             -- 准时交付:验收时间不晚于订单预计到货日
             (select count(1) from receipts rc
                join purchase_orders po2 on po2.id = rc.order_id and po2.tenant_id = rc.tenant_id
               where po2.supplier_id = e.id
                 and rc.received_at::date <= po2.expected_receipt_date) as on_time_receipt_count,
             (select count(1) from invoice_reconciliations ir where ir.supplier_id = e.id) as invoice_count,
             (select count(1) from invoice_reconciliations ir
               where ir.supplier_id = e.id and ir.stage = '三单匹配通过') as clean_reconciliation_count,
             (select count(distinct po.tenant_id) from purchase_orders po where po.supplier_id = e.id)
               as served_tenant_count,
             (select coalesce(sum(po.amount), 0) from purchase_orders po where po.supplier_id = e.id)
               as total_order_amount
      from enterprises e
      where e.type = 'supplier'
      """;

  @Select(FACTS + " order by e.name")
  List<SupplierCreditFacts> listAll();

  @Select(FACTS + " and e.id = #{supplierId}")
  SupplierCreditFacts findBySupplier(@Param("supplierId") String supplierId);
}
