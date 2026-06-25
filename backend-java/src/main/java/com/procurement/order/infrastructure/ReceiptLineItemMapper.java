package com.procurement.order.infrastructure;

import com.procurement.order.domain.ReceiptLineItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ReceiptLineItemMapper {

  @Insert("""
      insert into receipt_line_items
        (id, tenant_id, receipt_id, order_line_id, description, unit,
         ordered_quantity, received_quantity, qualified_quantity, sort_no)
      values
        (#{id}, #{tenantId}, #{receiptId}, #{orderLineId}, #{description}, #{unit},
         #{orderedQuantity}, #{receivedQuantity}, #{qualifiedQuantity}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("receiptId") String receiptId,
      @Param("orderLineId") String orderLineId,
      @Param("description") String description,
      @Param("unit") String unit,
      @Param("orderedQuantity") BigDecimal orderedQuantity,
      @Param("receivedQuantity") BigDecimal receivedQuantity,
      @Param("qualifiedQuantity") BigDecimal qualifiedQuantity,
      @Param("sortNo") int sortNo);

  @Select("""
      select id, tenant_id, receipt_id, order_line_id, description, unit,
             ordered_quantity, received_quantity, qualified_quantity, sort_no
      from receipt_line_items
      where tenant_id = #{tenantId} and receipt_id = #{receiptId}
      order by sort_no asc, id asc
      """)
  List<ReceiptLineItem> listByReceipt(
      @Param("tenantId") String tenantId, @Param("receiptId") String receiptId);
}
