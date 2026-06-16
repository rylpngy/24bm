package com.procurement.sourcing.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface RfqDemandMapper {

  @Select("""
      select demand_id
      from rfq_demands
      where tenant_id = #{tenantId} and rfq_id = #{rfqId,jdbcType=VARCHAR}
      order by id
      """)
  List<String> listDemandIds(@Param("tenantId") String tenantId, @Param("rfqId") String rfqId);

  @Select("""
      select count(1)
      from rfq_demands
      where tenant_id = #{tenantId} and demand_id = #{demandId}
      """)
  int countByTenantAndDemand(@Param("tenantId") String tenantId, @Param("demandId") String demandId);

  @Insert("""
      insert into rfq_demands (id, tenant_id, rfq_id, demand_id)
      values (#{id}, #{tenantId}, #{rfqId}, #{demandId})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("rfqId") String rfqId,
      @Param("demandId") String demandId);
}
