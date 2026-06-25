package com.procurement.finance.infrastructure;

import com.procurement.finance.domain.InvoiceLineItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface InvoiceLineItemMapper {

  @Insert("""
      insert into invoice_line_items
        (id, tenant_id, invoice_id, order_line_id, description, unit,
         quantity, unit_price, line_amount, sort_no)
      values
        (#{id}, #{tenantId}, #{invoiceId}, #{orderLineId}, #{description}, #{unit},
         #{quantity}, #{unitPrice}, #{lineAmount}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("invoiceId") String invoiceId,
      @Param("orderLineId") String orderLineId,
      @Param("description") String description,
      @Param("unit") String unit,
      @Param("quantity") BigDecimal quantity,
      @Param("unitPrice") BigDecimal unitPrice,
      @Param("lineAmount") BigDecimal lineAmount,
      @Param("sortNo") int sortNo);

  @Select("""
      select id, tenant_id, invoice_id, order_line_id, description, unit,
             quantity, unit_price, line_amount, sort_no
      from invoice_line_items
      where tenant_id = #{tenantId} and invoice_id = #{invoiceId}
      order by sort_no asc, id asc
      """)
  List<InvoiceLineItem> listByInvoice(
      @Param("tenantId") String tenantId, @Param("invoiceId") String invoiceId);
}
