package com.procurement.supplier.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface InvitationNotificationMapper {
  @Select("select id from users where supplier_id=#{supplierId} and tenant_id is null and status='active' order by id")
  List<String> supplierRecipients(@Param("supplierId") String supplierId);

  @Select("select id from users where tenant_id=#{tenantId} and supplier_id is null and status='active' order by id")
  List<String> buyerRecipients(@Param("tenantId") String tenantId);
}
