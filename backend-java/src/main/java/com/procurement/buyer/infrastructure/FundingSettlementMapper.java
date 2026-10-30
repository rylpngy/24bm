package com.procurement.buyer.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FundingSettlementMapper {
  record Cash(String source, String fundId, BigDecimal amount) {}

  record Entry(String evidenceId, String fundId, String code, String name, BigDecimal amount) {}

  @Select(
      "select i.id source,a.fund_id,sum(a.amount) amount from funding_payment_allocations a join"
          + " invoice_payment_entries e on e.tenant_id=a.tenant_id and e.id=a.entry_id join"
          + " invoices i on i.tenant_id=e.tenant_id and i.id=e.invoice_id where a.tenant_id=#{t}"
          + " and i.order_id=#{o} group by i.id,a.fund_id order by i.id,a.fund_id")
  List<Cash> original(@Param("t") String t, @Param("o") String o);

  @Select(
      "select e.source,a.fund_id,sum(a.amount) amount from funding_settlement_allocations a join"
          + " order_settlement_evidence e on e.tenant_id=a.tenant_id and e.id=a.evidence_id where"
          + " a.tenant_id=#{t} and e.settlement_id=#{s} group by e.source,a.fund_id order by"
          + " e.source,a.fund_id")
  List<Cash> current(@Param("t") String t, @Param("s") String s);

  @Select(
      "select a.evidence_id,a.fund_id,f.code,f.name,a.amount from funding_settlement_allocations a"
          + " join special_funds f on f.tenant_id=a.tenant_id and f.id=a.fund_id join"
          + " order_settlement_evidence e on e.tenant_id=a.tenant_id and e.id=a.evidence_id where"
          + " a.tenant_id=#{t} and e.settlement_id=#{s} order by e.created_at,e.id,a.fund_id")
  List<Entry> entries(@Param("t") String t, @Param("s") String s);

  @Select(
      "select a.evidence_id,a.fund_id,f.code,f.name,a.amount from funding_settlement_allocations a"
          + " join special_funds f on f.tenant_id=a.tenant_id and f.id=a.fund_id where"
          + " a.tenant_id=#{t} and a.evidence_id=#{e} order by a.fund_id")
  List<Entry> evidence(@Param("t") String t, @Param("e") String e);

  @Select(
      "select count(*) from order_settlements s where s.tenant_id=#{t} and s.id<>#{ignore} and"
          + " s.status not in ('withdrawn','rejected','settled') and exists(select 1 from"
          + " purchase_orders o join rfq_demands rd on rd.tenant_id=o.tenant_id and"
          + " rd.rfq_id=o.rfq_id join procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where o.tenant_id=s.tenant_id and o.id=s.order_id and"
          + " d.project_id=#{p})")
  int pending(@Param("t") String t, @Param("p") String p, @Param("ignore") String ignore);

  @Select(
      "select exists(select 1 from funding_payment_allocations a join invoice_payment_entries e on"
          + " e.tenant_id=a.tenant_id and e.id=a.entry_id join invoices i on"
          + " i.tenant_id=e.tenant_id and i.id=e.invoice_id where i.tenant_id=#{t} and"
          + " i.order_id=#{o} and a.change_id<>#{plan})")
  boolean historical(@Param("t") String t, @Param("o") String o, @Param("plan") String plan);

  @Insert(
      "insert into"
          + " funding_settlement_allocations(tenant_id,evidence_id,project_id,fund_id,change_id,amount,created_by)"
          + " values(#{t},#{e},#{p},#{f},#{plan},#{amount},#{actor})")
  void insert(
      @Param("t") String t,
      @Param("e") String e,
      @Param("p") String p,
      @Param("f") String f,
      @Param("plan") String plan,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);
}
