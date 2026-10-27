package com.procurement.buyer.infrastructure;

import java.math.BigDecimal;
import org.apache.ibatis.annotations.*;

@Mapper
public interface FundingReallocationMapper {
  @Select(
      "select (select count(*) from procurement_project_lifecycle_requests where tenant_id=#{t} and"
          + " project_id=#{p} and status='submitted')+(select count(*) from"
          + " procurement_project_changes where tenant_id=#{t} and project_id=#{p} and status in"
          + " ('draft','submitted'))+(select count(*) from order_settlements s join purchase_orders"
          + " o on o.tenant_id=s.tenant_id and o.id=s.order_id where s.tenant_id=#{t} and s.status"
          + " not in ('withdrawn','rejected') and exists(select 1 from rfq_demands rd join"
          + " procurement_project_demands d on d.tenant_id=rd.tenant_id and"
          + " d.demand_id=rd.demand_id where rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id and"
          + " d.project_id=#{p}))")
  int conflicts(@Param("t") String t, @Param("p") String p);

  @Insert(
      "insert into"
          + " funding_reallocation_lines(tenant_id,change_id,project_id,plan_id,fund_id,before_amount,after_amount,created_by)"
          + " values(#{t},#{c},#{p},#{plan},#{f},#{before},#{after},#{actor})")
  void line(
      @Param("t") String t,
      @Param("c") String c,
      @Param("p") String p,
      @Param("plan") String plan,
      @Param("f") String f,
      @Param("before") BigDecimal before,
      @Param("after") BigDecimal after,
      @Param("actor") String actor);
}
