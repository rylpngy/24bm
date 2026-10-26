package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.Quote;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface QuoteMapper {
  @Select("select full_quote_required from rfq_quotation_policies where tenant_id=#{tenant} and rfq_id=#{rfq}")
  Boolean fullQuotationRequired(@Param("tenant")String tenant,@Param("rfq")String rfq);
  @Select("select * from rfq_quotation_policies where tenant_id=#{tenant} and rfq_id=#{rfq}")
  QuotationMapper.Policy quotationPolicy(@Param("tenant")String tenant,@Param("rfq")String rfq);
  @Select("select count(*) from rfq_deadline_extensions where tenant_id=#{tenant} and rfq_id=#{rfq} and round=#{round} and mode='automatic'")
  int automaticExtensions(@Param("tenant")String tenant,@Param("rfq")String rfq,@Param("round")int round);
  @Select("""
      select count(distinct q.supplier_id) from quotes q
      where q.tenant_id=#{tenant} and q.rfq_id=#{rfq} and q.round=#{round} and q.status='已提交' and q.amount>0
      and exists(select 1 from rfq_invites i where i.tenant_id=q.tenant_id and i.rfq_id=q.rfq_id and i.supplier_id=q.supplier_id)
      and (not #{strict} or coalesce((select (v.snapshot_json->>'complete')::boolean from quote_versions v
        where v.tenant_id=q.tenant_id and v.quote_id=q.id order by v.version_no desc limit 1),false))
      """)
  int validQuotationCount(@Param("tenant")String tenant,@Param("rfq")String rfq,@Param("round")int round,@Param("strict")boolean strict);

  // 当前轮去重:同一供应商在同一轮只能有一份报价(允许跨轮再报)。
  @Select("""
      select min(amount)
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and round = #{round}
        and amount is not null
      """)
  java.math.BigDecimal findLowestSubmittedAmount(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("round") int round);

  @Select("""
      select count(1)
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
        and round = #{round}
      """)
  int countSubmittedBySupplier(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("round") int round);

  @Insert("""
      insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, round)
      values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{amount}, #{taxRate}, #{deliveryDays}, #{status,jdbcType=VARCHAR}, #{round})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("taxRate") BigDecimal taxRate,
      @Param("deliveryDays") Integer deliveryDays,
      @Param("status") String status,
      @Param("round") int round);

  // 仅取某一轮的报价(评标/对比只看当前轮)。
  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where tenant_id = #{tenantId} and rfq_id = #{rfqId} and round = #{round}
      order by amount, submitted_at, id
      """)
  List<Quote> listByTenantAndRfqAndRound(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("round") int round);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Quote findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and id = #{id}
      """)
  Quote findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Update("""
      update quotes
      set amount = #{amount},
          tax_rate = #{taxRate},
          delivery_days = #{deliveryDays},
          submitted_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
        and round = (select r.current_round from rfqs r
                     where r.tenant_id = quotes.tenant_id and r.id = quotes.rfq_id)
      """)
  int updateSubmittedQuote(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("taxRate") BigDecimal taxRate,
      @Param("deliveryDays") Integer deliveryDays,
      @Param("status") String status);

  @Update("""
      update quotes
      set status = #{lockedStatus,jdbcType=VARCHAR}
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{submittedStatus,jdbcType=VARCHAR}
      """)
  int lockSubmittedQuoteForAward(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("submittedStatus") String submittedStatus,
      @Param("lockedStatus") String lockedStatus);

  @Update("""
      update quotes
      set status = #{submittedStatus,jdbcType=VARCHAR}
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{lockedStatus,jdbcType=VARCHAR}
      """)
  int unlockAwardQuote(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("lockedStatus") String lockedStatus,
      @Param("submittedStatus") String submittedStatus);

  @Update("""
      update quotes
      set status = #{awardedStatus,jdbcType=VARCHAR}
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{lockedStatus,jdbcType=VARCHAR}
      """)
  int markAwardedQuote(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("lockedStatus") String lockedStatus,
      @Param("awardedStatus") String awardedStatus);

  @Update("""
      update quotes
      set status = #{notSelectedStatus,jdbcType=VARCHAR}
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and id <> #{selectedQuoteId}
        and status = #{submittedStatus,jdbcType=VARCHAR}
      """)
  int closeUnawardedQuotes(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("selectedQuoteId") String selectedQuoteId,
      @Param("submittedStatus") String submittedStatus,
      @Param("notSelectedStatus") String notSelectedStatus);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
      order by submitted_at desc
      """)
  List<Quote> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        <if test="rfqId != null and rfqId != ''">
        and rfq_id = #{rfqId}
        </if>
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
      order by submitted_at desc
      </script>
      """)
  List<Quote> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("rfqId") String rfqId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
      order by amount asc, delivery_days asc, submitted_at asc
      """)
  List<Quote> listByTenantAndRfq(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and id = #{quoteId}
        and status = #{status,jdbcType=VARCHAR}
        and round = (select r.current_round from rfqs r
                     where r.tenant_id = quotes.tenant_id and r.id = quotes.rfq_id)
      """)
  Quote findSubmittedQuoteForAward(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("quoteId") String quoteId,
      @Param("status") String status);
}
