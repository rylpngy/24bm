package com.procurement.sourcing.infrastructure;

import com.procurement.sourcing.api.PublicOpportunityResponse;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

// 公开商机查询:跨租户只读(共享范围 mapper,已登记 TenantIsolationArchitectureTests 白名单)。
// 仅暴露公开安全字段;草稿不可见,商城锚点不属于商机。
@Mapper
public interface PublicOpportunityMapper {

  String COLUMNS = """
      r.id, r.title, r.method, r.evaluation_method, r.status,
      r.deadline_at, r.created_at, r.result_announced_at,
      r.quote_requirement, r.delivery_requirement,
      t.name as buyer_name,
      (select coalesce(sum(pd.budget), 0)
         from rfq_demands rd
         join purchase_demands pd on pd.id = rd.demand_id and pd.tenant_id = rd.tenant_id
        where rd.rfq_id = r.id and rd.tenant_id = r.tenant_id) as budget,
      (select string_agg(distinct m.category, '、')
         from rfq_demands rd2
         join purchase_demand_items li on li.demand_id = rd2.demand_id and li.tenant_id = rd2.tenant_id
         join materials m on m.id = li.material_id and m.tenant_id = rd2.tenant_id
        where rd2.rfq_id = r.id and rd2.tenant_id = r.tenant_id) as categories
      """;

  @Select("""
      select
      """ + COLUMNS + """
      from rfqs r
      join tenants t on t.id = r.tenant_id
      where r.status in ('报价中', '已开标', '定标审批中', '已定标')
        and r.method <> '商城'
      order by r.created_at desc
      limit 200
      """)
  List<PublicOpportunityResponse> listPublicOpportunities();

  @Select("""
      select
      """ + COLUMNS + """
      from rfqs r
      join tenants t on t.id = r.tenant_id
      where r.id = #{rfqId}
        and r.status in ('报价中', '已开标', '定标审批中', '已定标')
        and r.method <> '商城'
      """)
  PublicOpportunityResponse findPublicOpportunityById(@Param("rfqId") String rfqId);

  @Select("""
      select r.tenant_id
      from rfqs r
      where r.id = #{rfqId} and r.status = '报价中' and r.method <> '商城'
      """)
  String findEnrollableTenantId(@Param("rfqId") String rfqId);

  @Select("""
      select e.id
      from enterprises e
      where e.name = #{companyName} and e.type = 'supplier' and e.verified = true
      """)
  String findVerifiedSupplierIdByName(@Param("companyName") String companyName);
}
