package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.domain.QuoteLineItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QuoteLineItemMapper {

  @Insert("""
      insert into quote_line_items
        (id, tenant_id, quote_id, description, unit, quantity, unit_price, line_amount, sort_no)
      values
        (#{id}, #{tenantId}, #{quoteId}, #{description}, #{unit}, #{quantity}, #{unitPrice},
         #{lineAmount}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("quoteId") String quoteId,
      @Param("description") String description,
      @Param("unit") String unit,
      @Param("quantity") BigDecimal quantity,
      @Param("unitPrice") BigDecimal unitPrice,
      @Param("lineAmount") BigDecimal lineAmount,
      @Param("sortNo") int sortNo);

  @Delete("""
      delete from quote_line_items
      where tenant_id = #{tenantId} and quote_id = #{quoteId}
      """)
  void deleteByQuote(@Param("tenantId") String tenantId, @Param("quoteId") String quoteId);

  @Select("""
      select id, tenant_id, quote_id, description, unit, quantity, unit_price, line_amount, sort_no
      from quote_line_items
      where tenant_id = #{tenantId} and quote_id = #{quoteId}
      order by sort_no asc, id asc
      """)
  List<QuoteLineItem> listByQuote(
      @Param("tenantId") String tenantId, @Param("quoteId") String quoteId);
}
