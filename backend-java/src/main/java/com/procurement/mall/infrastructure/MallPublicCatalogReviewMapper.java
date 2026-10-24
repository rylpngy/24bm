package com.procurement.mall.infrastructure;

import com.procurement.mall.domain.MallProduct;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * Audited platform-only scope exception: public products have no tenant owner.
 * All statements require BOTH public scope and a null tenant; no tenant product is mutable here.
 * The application boundary requires platform context and platform:* before locking or writing.
 * Regression coverage: ScopedMapperMutationTests and MallCatalogMaintenancePostgresIT.
 */
@Mapper
public interface MallPublicCatalogReviewMapper {
  @Select("select " + MallCatalogMapper.PRODUCT_COLUMNS + MallCatalogMapper.PRODUCT_FROM
      + " where p.id = #{id} and p.scope = 'public' and p.tenant_id is null for update of p")
  MallProduct lockPublicProduct(@Param("id") String id);

  @Select("select " + MallCatalogMapper.PRODUCT_COLUMNS + MallCatalogMapper.PRODUCT_FROM
      + " where p.scope = 'public' and p.tenant_id is null and p.status = '待审核' order by p.updated_at, p.id")
  List<MallProduct> listPublicPendingReview();

  @Update("""
      update mall_products set status = #{status}, review_comment = #{comment},
        reviewed_at = now(), updated_at = now()
      where id = #{id} and scope = 'public' and tenant_id is null and status = '待审核'
      """)
  int reviewPublicProduct(@Param("id") String id, @Param("status") String status,
      @Param("comment") String comment);
}
