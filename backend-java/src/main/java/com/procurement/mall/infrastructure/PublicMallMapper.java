package com.procurement.mall.infrastructure;

import com.procurement.mall.api.PublicMallOverviewResponse;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

// 公开商城概览查询:跨租户只读(共享范围 mapper,已登记白名单);不暴露价格/租户/供应商。
@Mapper
public interface PublicMallMapper {

  @Select("""
      select m.category, count(*) as listing_count
      from mall_listings l
      join materials m on m.id = l.material_id and m.tenant_id = l.tenant_id
      where l.status = '在架'
      group by m.category
      order by listing_count desc
      """)
  List<PublicMallOverviewResponse.CategoryCount> listCategoryCounts();

  @Select("""
      select distinct on (m.name) m.name, m.category, l.unit
      from mall_listings l
      join materials m on m.id = l.material_id and m.tenant_id = l.tenant_id
      where l.status = '在架'
      order by m.name, l.created_at desc
      limit 8
      """)
  List<PublicMallOverviewResponse.FeaturedItem> listFeatured();
}
