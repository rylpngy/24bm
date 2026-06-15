package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.Quote;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QuoteMapper {

  @Select("""
      select count(1)
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId}
        and supplier_id = #{supplierId}
        and status = #{status}
      """)
  int countSubmittedBySupplier(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("supplierId") String supplierId,
      @Param("status") String status);

  @Insert("""
      insert into quotes (id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status)
      values (#{id}, #{tenantId}, #{rfqId}, #{supplierId}, #{amount}, #{taxRate}, #{deliveryDays}, #{status})
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
  @Results(id = "quoteResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "tax_rate", property = "taxRate"),
      @Result(column = "delivery_days", property = "deliveryDays"),
      @Result(column = "submitted_at", property = "submittedAt")
  })
  Quote findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where supplier_id = #{supplierId}
      order by submitted_at desc
      """)
  @Results(id = "supplierQuoteListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "tax_rate", property = "taxRate"),
      @Result(column = "delivery_days", property = "deliveryDays"),
      @Result(column = "submitted_at", property = "submittedAt")
  })
  List<Quote> listBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      select id, tenant_id, rfq_id, supplier_id, amount, tax_rate, delivery_days, status, submitted_at
      from quotes
      where tenant_id = #{tenantId}
        and rfq_id = #{rfqId}
        and id = #{quoteId}
        and status = #{status}
      """)
  @Results(id = "submittedQuoteForAwardResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "rfq_id", property = "rfqId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "tax_rate", property = "taxRate"),
      @Result(column = "delivery_days", property = "deliveryDays"),
      @Result(column = "submitted_at", property = "submittedAt")
  })
  Quote findSubmittedQuoteForAward(
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("quoteId") String quoteId,
      @Param("status") String status);
}
