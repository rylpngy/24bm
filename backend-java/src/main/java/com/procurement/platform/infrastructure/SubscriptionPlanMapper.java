package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.PlanQuota;
import com.procurement.platform.domain.SubscriptionPlan;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SubscriptionPlanMapper {

  @Select("""
      select code, name, monthly_base_price
      from subscription_plans
      where code = #{code}
      """)
  SubscriptionPlan findPlan(@Param("code") String code);

  @Select("""
      select plan_code, metric, included_quota, overage_unit_price
      from plan_quotas
      where plan_code = #{planCode}
      order by metric
      """)
  List<PlanQuota> listQuotas(@Param("planCode") String planCode);
}
