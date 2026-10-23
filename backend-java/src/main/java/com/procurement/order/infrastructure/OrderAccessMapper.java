package com.procurement.order.infrastructure;

import com.procurement.identity.domain.DataScope;
import java.util.Set;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface OrderAccessMapper {
  // An order is indivisible: a department must cover every demand in a merged RFQ.
  String RFQS = com.procurement.common.data.ProcurementScopeSql.RFQS;

  @Select("<script>select id from purchase_orders where tenant_id = #{tenantId} and rfq_id in (" + RFQS + ")</script>")
  Set<String> visibleOrderIds(@Param("tenantId") String tenantId, @Param("scope") DataScope scope);

  @Select("<script>select exists (select 1 from (" + RFQS + ") visible where visible.id = #{rfqId})</script>")
  boolean canAccessRfq(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId, @Param("scope") DataScope scope);

  @Select("<script>select exists (select 1 from purchase_orders where tenant_id = #{tenantId} and id = #{orderId} and rfq_id in (" + RFQS + "))</script>")
  boolean canAccessOrder(@Param("tenantId") String tenantId, @Param("orderId") String orderId, @Param("scope") DataScope scope);
}
