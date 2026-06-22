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

  @Select("""
      select count(1)
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId,jdbcType=VARCHAR}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
      """)
  int countSubmittedBySupplier(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("status") String status);

  @Insert("""
      insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status)
      values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{amount}, #{taxRate}, #{deliveryDays}, #{status,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("amount") BigDecimal amount,
      @Param("taxRate") BigDecimal taxRate,
      @Param("deliveryDays") Integer deliveryDays,
      @Param("status") String status);

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
          delivery_days = #{deliveryDays}
      where tenant_id = #{tenantId}
        and id = #{id}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
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
      """)
  Quote findSubmittedQuoteForAward(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("quoteId") String quoteId,
      @Param("status") String status);
}
