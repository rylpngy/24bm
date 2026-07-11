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

  // 占用判定:已流标/已废标的项目不再占用需求(流标后需求可重新立项)。
  @Select("""
      select count(1)
      from rfq_demands rd
      join rfqs r on r.tenant_id = rd.tenant_id and r.id = rd.rfq_id
      where rd.tenant_id = #{tenantId} and rd.demand_id = #{demandId}
        and r.status not in ('已流标', '已废标')
      """)
  int countByTenantAndDemand(@Param("tenantId") String tenantId, @Param("demandId") String demandId);

  @Select("""
      select rd.rfq_id
      from rfq_demands rd
      join rfqs r on r.tenant_id = rd.tenant_id and r.id = rd.rfq_id
      where rd.tenant_id = #{tenantId} and rd.demand_id = #{demandId}
        and r.status not in ('已流标', '已废标')
      order by r.created_at desc
      limit 1
      """)
  String findLatestRfqIdByDemand(@Param("tenantId") String tenantId, @Param("demandId") String demandId);

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
