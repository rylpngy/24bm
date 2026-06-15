package com.procurement.order.infrastructure;

import com.procurement.order.domain.Delivery;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DeliveryMapper {

  @Insert("""
      insert into deliveries (id, tenant_id, order_id, supplier_id, carrier, tracking_no, status)
      values (#{id}, #{tenantId}, #{orderId}, #{supplierId}, #{carrier}, #{trackingNo}, #{status})
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
  @Results(id = "deliveryResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "tracking_no", property = "trackingNo"),
      @Result(column = "created_at", property = "createdAt")
  })
  Delivery findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select count(1)
      from deliveries
      where tenant_id = #{tenantId}
        and order_id = #{orderId}
      """)
  int countByTenantAndOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId);

  @Select("""
      select count(1)
      from deliveries
      where tenant_id = #{tenantId}
        and order_id = #{orderId}
        and status = #{status}
      """)
  int countByTenantOrderAndStatus(
      @Param("tenantId") String tenantId,
      @Param("orderId") String orderId,
      @Param("status") String status);

  @Select("""
      select id, tenant_id, order_id, supplier_id, carrier, tracking_no, status, created_at
      from deliveries
      where supplier_id = #{supplierId}
        and (#{status} is null or status = #{status})
        and (#{orderId} is null or order_id = #{orderId})
      order by created_at desc
      """)
  @Results(id = "supplierDeliveryListResults", value = {
      @Result(column = "tenant_id", property = "tenantId"),
      @Result(column = "order_id", property = "orderId"),
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "tracking_no", property = "trackingNo"),
      @Result(column = "created_at", property = "createdAt")
  })
  List<Delivery> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("orderId") String orderId);
}
