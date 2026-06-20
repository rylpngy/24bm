package com.procurement.demand.infrastructure;

import com.procurement.demand.domain.PurchaseDemandItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PurchaseDemandItemMapper {

  @Select("""
      select id, tenant_id, demand_id, material_id, quantity
      from purchase_demand_items
      where tenant_id = #{tenantId} and demand_id = #{demandId}
      order by id
      """)
  List<PurchaseDemandItem> listByDemand(@Param("tenantId") String tenantId, @Param("demandId") String demandId);

  @Delete("""
      delete from purchase_demand_items
      where tenant_id = #{tenantId} and demand_id = #{demandId}
      """)
  int deleteByDemand(@Param("tenantId") String tenantId, @Param("demandId") String demandId);

  @Insert("""
      insert into purchase_demand_items (id, tenant_id, demand_id, material_id, quantity)
      values (#{id}, #{tenantId}, #{demandId}, #{materialId}, #{quantity})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("demandId") String demandId,
      @Param("materialId") String materialId,
      @Param("quantity") BigDecimal quantity);
}
