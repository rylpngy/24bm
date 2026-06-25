package com.procurement.platform.infrastructure;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 用量计量:按租户统计各计量项的实际用量(均按 tenant_id 限定)。
@Mapper
public interface UsageMeteringMapper {

  @Select("select count(1) from purchase_orders where tenant_id = #{tenantId}")
  int countOrders(@Param("tenantId") String tenantId);

  @Select("select count(1) from invoices where tenant_id = #{tenantId}")
  int countInvoices(@Param("tenantId") String tenantId);

  @Select("select count(1) from rfqs where tenant_id = #{tenantId}")
  int countRfqs(@Param("tenantId") String tenantId);

  @Select("select count(1) from users where tenant_id = #{tenantId} and status = 'active'")
  int countActiveUsers(@Param("tenantId") String tenantId);
}
