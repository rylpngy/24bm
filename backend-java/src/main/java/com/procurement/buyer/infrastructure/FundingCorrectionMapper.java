package com.procurement.buyer.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FundingCorrectionMapper {
  record Original(
      String fundId,
      String code,
      String name,
      String period,
      String changeId,
      String projectId,
      BigDecimal amount,
      BigDecimal entryAmount) {}

  @Select(
      "select a.fund_id,f.code,f.name,f.period,a.change_id,a.project_id,a.amount,e.amount"
          + " entry_amount from funding_payment_allocations a join special_funds f on"
          + " f.tenant_id=a.tenant_id and f.id=a.fund_id join invoice_payment_entries e on"
          + " e.tenant_id=a.tenant_id and e.id=a.entry_id where a.tenant_id=#{t} and"
          + " a.entry_id=#{e} and e.invoice_id=#{invoice} order by a.fund_id")
  List<Original> original(
      @Param("t") String t, @Param("invoice") String invoice, @Param("e") String e);

  @Select(
      "select count(*) from frozen_payment_corrections where tenant_id=#{t} and project_id=#{p} and"
          + " status='submitted' and id<>#{ignore}")
  int pending(@Param("t") String t, @Param("p") String p, @Param("ignore") String ignore);

  @Insert(
      "insert into"
          + " funding_correction_allocations(tenant_id,correction_id,project_id,entry_id,source_fund_id,target_fund_id,plan_id,amount,created_by)"
          + " values(#{t},#{correction},#{p},#{entry},#{source},#{target},#{plan},#{amount},#{actor})")
  void restore(
      @Param("t") String t,
      @Param("correction") String correction,
      @Param("p") String p,
      @Param("entry") String entry,
      @Param("source") String source,
      @Param("target") String target,
      @Param("plan") String plan,
      @Param("amount") BigDecimal amount,
      @Param("actor") String actor);
}
