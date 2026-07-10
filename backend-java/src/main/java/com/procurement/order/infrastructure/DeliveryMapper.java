package com.procurement.order.infrastructure;

import com.procurement.order.domain.Delivery;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface DeliveryMapper {

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
