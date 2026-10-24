package com.procurement.order.infrastructure;

import com.procurement.order.domain.Delivery;
import com.procurement.order.domain.OrderFulfillmentLine;
import com.procurement.order.api.DeliveryLineItemRequest;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DeliveryMapper {

  @Select("""
      select l.id as order_line_id, l.quantity as ordered_quantity,
        coalesce((select sum(dli.shipped_quantity) from delivery_line_items dli
          join deliveries d on d.id = dli.delivery_id and d.tenant_id = dli.tenant_id
          where d.tenant_id = l.tenant_id and d.order_id = l.order_id and dli.order_line_id = l.id), 0) as shipped_quantity,
        coalesce((select sum(rli.received_quantity) from receipt_line_items rli
          join receipts r on r.id = rli.receipt_id and r.tenant_id = rli.tenant_id
          where r.tenant_id = l.tenant_id and r.order_id = l.order_id and rli.order_line_id = l.id), 0) as received_quantity,
        coalesce((select sum(rli.qualified_quantity) from receipt_line_items rli
          join receipts r on r.id = rli.receipt_id and r.tenant_id = rli.tenant_id
          where r.tenant_id = l.tenant_id and r.order_id = l.order_id and rli.order_line_id = l.id), 0) as qualified_quantity
      from order_line_items l where l.tenant_id = #{tenantId} and l.order_id = #{orderId}
      order by l.sort_no, l.id
      """)
  List<OrderFulfillmentLine> fulfillmentLines(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  // Historical headers cannot safely be attributed to arbitrary order lines.
  @Select("""
      select (select count(*) from deliveries d where d.tenant_id = #{tenantId} and d.order_id = #{orderId}
        and (d.shipped_quantity <= 0 or d.shipped_quantity <> coalesce((select sum(li.shipped_quantity)
          from delivery_line_items li where li.tenant_id = d.tenant_id and li.delivery_id = d.id), 0)
          or exists (select 1 from delivery_line_items li left join order_line_items ol
            on ol.id = li.order_line_id and ol.tenant_id = d.tenant_id and ol.order_id = d.order_id
            where li.delivery_id = d.id and (li.tenant_id <> d.tenant_id or ol.id is null or li.shipped_quantity <= 0))))
      + (select count(*) from receipts r where r.tenant_id = #{tenantId} and r.order_id = #{orderId}
        and (r.received_quantity <= 0 or r.qualified_quantity < 0 or r.qualified_quantity > r.received_quantity
          or r.received_quantity <> coalesce((select sum(li.received_quantity)
          from receipt_line_items li where li.tenant_id = r.tenant_id and li.receipt_id = r.id), 0)
          or r.qualified_quantity <> coalesce((select sum(li.qualified_quantity)
          from receipt_line_items li where li.tenant_id = r.tenant_id and li.receipt_id = r.id), 0)
          or exists (select 1 from receipt_line_items li left join order_line_items ol
            on ol.id = li.order_line_id and ol.tenant_id = r.tenant_id and ol.order_id = r.order_id
            where li.receipt_id = r.id and (li.tenant_id <> r.tenant_id or ol.id is null
              or li.received_quantity <= 0 or li.qualified_quantity < 0 or li.qualified_quantity > li.received_quantity))
          or exists (select 1 from receipt_line_items li where li.receipt_id = r.id
            group by li.order_line_id having count(*) > 1)))
      """)
  int countUnattributedHistory(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Insert("""
      insert into delivery_line_items (id, tenant_id, delivery_id, order_line_id, shipped_quantity)
      values (#{id}, #{tenantId}, #{deliveryId}, #{orderLineId}, #{quantity})
      """)
  void insertLine(@Param("id") String id, @Param("tenantId") String tenantId,
      @Param("deliveryId") String deliveryId, @Param("orderLineId") String orderLineId,
      @Param("quantity") BigDecimal quantity);

  @Select("""
      select order_line_id, shipped_quantity from delivery_line_items
      where tenant_id = #{tenantId} and delivery_id = #{deliveryId} order by id
      """)
  List<DeliveryLineItemRequest> listLines(@Param("tenantId") String tenantId, @Param("deliveryId") String deliveryId);

  @Insert("""
      insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status,
                              shipped_quantity, shipped_date, estimated_arrival, logistics_note)
      values (#{id}, #{tenantId}, #{orderId}, #{supplierId}, #{carrier}, #{trackingNo}, #{status,jdbcType=VARCHAR},
              #{shippedQuantity}, #{shippedDate,jdbcType=DATE}, #{estimatedArrival,jdbcType=DATE}, #{logisticsNote})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("supplierId") String supplierId,
      @Param("carrier") String carrier,
      @Param("trackingNo") String trackingNo,
      @Param("status") String status,
      @Param("shippedQuantity") Integer shippedQuantity,
      @Param("shippedDate") java.time.LocalDate shippedDate,
      @Param("estimatedArrival") java.time.LocalDate estimatedArrival,
      @Param("logisticsNote") String logisticsNote);

  @Select("""
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at, shipped_quantity, shipped_date, estimated_arrival, logistics_note
      from deliveries
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Delivery findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at, shipped_quantity, shipped_date, estimated_arrival, logistics_note
      from deliveries
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and id = #{id}
      """)
  Delivery findBySupplierAndId(@Param("supplierId") String supplierId, @Param("id") String id);

  @Select("""
      select count(1)
      from deliveries
      where tenant_id = #{tenantId}
        and order_id = #{orderId,jdbcType=VARCHAR}
      """)
  int countByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select count(1)
      from deliveries
      where tenant_id = #{tenantId}
        and order_id = #{orderId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
      """)
  int countByTenantOrderAndStatus(
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at, shipped_quantity, shipped_date, estimated_arrival, logistics_note
      from deliveries
      where tenant_id = #{tenantId}
      order by created_at desc
      """)
  List<Delivery> listByTenant(@Param("tenantId") String tenantId);

  @Select("""
      <script>
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at, shipped_quantity, shipped_date, estimated_arrival, logistics_note
      from deliveries
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        <if test="status != null and status != ''">
        and status = #{status}
        </if>
        <if test="orderId != null and orderId != ''">
        and order_id = #{orderId}
        </if>
      order by created_at desc
      </script>
      """)
  List<Delivery> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("orderId") String orderId);

  @Update("""
      update deliveries
      set carrier = #{carrier},
          tracking_no = #{trackingNo},
          shipped_quantity = coalesce(#{shippedQuantity,jdbcType=INTEGER}, shipped_quantity),
          shipped_date = coalesce(#{shippedDate,jdbcType=DATE}, shipped_date),
          estimated_arrival = coalesce(#{estimatedArrival,jdbcType=DATE}, estimated_arrival),
          logistics_note = coalesce(#{logisticsNote,jdbcType=VARCHAR}, logistics_note)
      where tenant_id = #{tenantId}
        and id = #{id}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
      """)
  int updateSupplierDelivery(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("carrier") String carrier,
      @Param("trackingNo") String trackingNo,
      @Param("shippedQuantity") Integer shippedQuantity,
      @Param("shippedDate") java.time.LocalDate shippedDate,
      @Param("estimatedArrival") java.time.LocalDate estimatedArrival,
      @Param("logisticsNote") String logisticsNote);
}
