package com.procurement.order.infrastructure;

import com.procurement.order.domain.OrderLineItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OrderLineItemMapper {

  @Insert("""
      insert into order_line_items
        (id, tenant_id, order_id, description, unit, quantity, unit_price, line_amount, sort_no)
      values
        (#{id}, #{tenantId}, #{orderId}, #{description}, #{unit}, #{quantity}, #{unitPrice},
         #{lineAmount}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("description") String description,
      @Param("unit") String unit,
      @Param("quantity") BigDecimal quantity,
      @Param("unitPrice") BigDecimal unitPrice,
      @Param("lineAmount") BigDecimal lineAmount,
      @Param("sortNo") int sortNo);

  @Select("""
      select id, tenant_id, order_id, description, unit, quantity, unit_price, line_amount, sort_no
      from order_line_items
      where tenant_id = #{tenantId} and order_id = #{orderId}
      order by sort_no asc, id asc
      """)
  List<OrderLineItem> listByOrder(
      @Param("tenantId") String tenantId, @Param("orderId") String orderId);
}
