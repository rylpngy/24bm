package com.procurement.order.infrastructure;

import com.procurement.order.domain.Delivery;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DeliveryMapper {

  @Insert("""
      insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status)
      values (#{id}, #{tenantId}, #{orderId}, #{supplierId}, #{carrier}, #{trackingNo}, #{status,jdbcType=VARCHAR})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("supplierId") String supplierId,
      @Param("carrier") String carrier,
      @Param("trackingNo") String trackingNo,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at
      from deliveries
      where tenant_id = #{tenantId} and id = #{id}
      """)
  Delivery findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

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
      <script>
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at
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
}
