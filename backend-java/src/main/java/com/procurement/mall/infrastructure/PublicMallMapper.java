package com.procurement.mall.infrastructure;

import com.procurement.mall.api.PublicMallOverviewResponse;
import com.procurement.mall.domain.MallProduct;
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

  // M-1 公开专区:平台标准品统一定价,任何访客可浏览(私域协议价商品不在此列)。
  @Select("""
      select p.id, p.scope, p.tenant_id, p.supplier_id, e.name as supplier_name,
             p.category_id, c.name as category_name, p.name, p.brand, p.description_html,
             p.main_image_key, p.status, p.created_at, p.updated_at
      from mall_products p
      join enterprises e on e.id = p.supplier_id
      left join mall_categories c on c.id = p.category_id
      where p.scope = 'public' and p.status = '在架'
      order by p.updated_at desc
      """)
  List<MallProduct> listPublicProducts();
}
